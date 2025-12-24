"""
Celery tasks для автопродления подписок (recurring payments).

ВАЖНЫЕ ИНВАРИАНТЫ:
1. Эта задача НИКОГДА не обновляет даты подписки!
2. Только webhook payment.succeeded продляет подписку (SSOT)
3. Защита от двойного списания:
   - YooKassa idempotency key (первичная)
   - DB guard: Payment с (subscription, billing_period_end, status=PENDING/SUCCEEDED) (вторичная)

Расписание: каждый час (см. config/celery.py)
"""

from __future__ import annotations

from datetime import timedelta
import logging

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.billing.models import Payment, Subscription, SubscriptionPlan
from apps.billing.services import YooKassaService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    queue="billing",
    ack_late=True,
    max_retries=0,  # Не ретраим — следующий hour run подхватит
)
def process_due_renewals(self):
    """
    Обрабатывает подписки, требующие автопродления.

    Критерии выбора подписок:
    - is_active=True
    - auto_renew=True
    - plan.code != 'FREE'
    - yookassa_payment_method_id IS NOT NULL
    - end_date <= now + 24h (истекает в ближайшие 24 часа)
    - BILLING_RECURRING_ENABLED=True (feature flag)

    Для каждой подписки:
    1. Вычисляем idempotency_key = renewal:{sub.id}:{sub.end_date.date()}
    2. DB guard: если Payment для (subscription, billing_period_end) уже существует
       со статусом PENDING/SUCCEEDED → пропускаем
    3. Создаём recurring payment в YooKassa
    4. Создаём локальный Payment(PENDING)

    ВАЖНО: Эта задача НЕ продлевает подписку!
    Подписка продляется только при успешном webhook payment.succeeded.
    """
    # Feature flag check
    if not getattr(settings, "BILLING_RECURRING_ENABLED", False):
        logger.info("[RECURRING] Feature flag disabled, skipping")
        return {"status": "disabled", "processed": 0}

    now = timezone.now()
    renewal_window = now + timedelta(hours=24)

    # Выбираем eligible подписки
    subscriptions = (
        Subscription.objects.filter(
            is_active=True,
            auto_renew=True,
            yookassa_payment_method_id__isnull=False,
            end_date__lte=renewal_window,
        )
        .exclude(plan__code="FREE")
        .select_related("plan", "user")
    )

    total = subscriptions.count()
    processed = 0
    skipped = 0
    errors = 0

    logger.info("[RECURRING] Found %d eligible subscriptions for renewal", total)

    for sub in subscriptions:
        try:
            result = _process_single_renewal(sub)
            if result == "created":
                processed += 1
            elif result == "skipped":
                skipped += 1
        except Exception as e:
            errors += 1
            logger.error(
                "[RECURRING] Error processing sub_id=%s: %s", sub.id, str(e), exc_info=True
            )

    logger.info(
        "[RECURRING] Completed: processed=%d, skipped=%d, errors=%d, total=%d",
        processed,
        skipped,
        errors,
        total,
    )

    return {
        "status": "completed",
        "total": total,
        "processed": processed,
        "skipped": skipped,
        "errors": errors,
    }


def _process_single_renewal(sub: Subscription) -> str:
    """
    Обрабатывает одну подписку для автопродления.

    Returns:
        'created' — если платёж создан
        'skipped' — если платёж уже существует (DB guard)
    """
    plan: SubscriptionPlan = sub.plan
    billing_period_end = sub.end_date

    # Idempotency key для YooKassa:
    # Уникальный ключ = renewal + subscription_id + дата окончания периода
    idempotency_key = f"renewal:{sub.id}:{billing_period_end.date().isoformat()}"

    # DB Guard: проверяем, не создан ли уже платёж для этого периода
    existing_payment = Payment.objects.filter(
        subscription=sub,
        billing_period_end=billing_period_end,
        status__in=["PENDING", "SUCCEEDED"],
    ).exists()

    if existing_payment:
        logger.debug(
            "[RECURRING] Skipping sub_id=%s: payment for period %s already exists",
            sub.id,
            billing_period_end.date(),
        )
        return "skipped"

    # Цена и длительность ТОЛЬКО из БД (SubscriptionPlan)
    amount = plan.price
    duration_days = plan.duration_days

    if amount <= 0 or duration_days <= 0:
        logger.warning(
            "[RECURRING] Skipping sub_id=%s: invalid plan price=%s or duration=%s",
            sub.id,
            amount,
            duration_days,
        )
        return "skipped"

    # Создаём recurring payment
    with transaction.atomic():
        # Создаём локальный Payment
        payment = Payment.objects.create(
            user=sub.user,
            subscription=sub,
            plan=plan,
            amount=amount,
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            description=f"Автопродление {plan.display_name}",
            is_recurring=True,
            save_payment_method=False,  # Не нужно пересохранять
            billing_period_end=billing_period_end,
            metadata={
                "idempotency_key": idempotency_key,
                "renewal_type": "auto",
                "original_end_date": billing_period_end.isoformat(),
            },
        )

        try:
            yk = YooKassaService()
            yk_payment = yk.create_recurring_payment(
                amount=amount,
                description=payment.description,
                payment_method_id=sub.yookassa_payment_method_id,
                idempotency_key=idempotency_key,
                metadata={
                    "payment_id": str(payment.id),
                    "user_id": str(sub.user_id),
                    "plan_code": plan.code,
                    "renewal_type": "auto",
                },
            )

            payment.yookassa_payment_id = yk_payment["id"]
            payment.save(update_fields=["yookassa_payment_id", "updated_at"])

            logger.info(
                "[RECURRING] Payment created: payment_id=%s, yk_id=%s, sub_id=%s, user_id=%s",
                payment.id,
                yk_payment["id"],
                sub.id,
                sub.user_id,
            )

            return "created"

        except Exception as e:
            # Если YooKassa отклонила — помечаем платёж как FAILED
            payment.status = "FAILED"
            payment.error_message = str(e)[:500]
            payment.save(update_fields=["status", "error_message", "updated_at"])

            logger.error("[RECURRING] YooKassa error for sub_id=%s: %s", sub.id, str(e))
            raise

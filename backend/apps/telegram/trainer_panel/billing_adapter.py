"""
Billing adapter для Trainer Panel.

Зачем нужен этот модуль:
- Trainer Panel (панель тренера) не должна напрямую "лезть" во внутренности billing-приложения.
- Поэтому здесь лежит адаптер: аккуратные функции, которые возвращают данные в формате,
  удобном для панели (frontend).

Что тут важно для прода:
- Никаких N+1 запросов (batch функции обязаны быть)
- Метрики должны считаться корректно (иначе в панели будут фейковые цифры)
- Платёж учитываем только если он реально успешный (SUCCEEDED)
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional, TypedDict

from django.contrib.auth.models import User
from django.db.models import Sum
from django.utils import timezone

from apps.billing.models import Payment, Subscription

# -----------------------------------------------------------------------------
# Типы (подсказки для тебя и IDE)
# -----------------------------------------------------------------------------

class SubscriptionInfo(TypedDict):
    # 'free' | 'monthly' | 'yearly'
    plan_type: str
    # True, если подписка платная и активна на текущий момент
    is_paid: bool
    # 'active' | 'expired' | 'canceled' | 'unknown'
    status: str
    # ISO-строка окончания, либо None (обычно для free)
    paid_until: Optional[str]


class RevenueMetrics(TypedDict):
    total: Decimal
    mtd: Decimal
    last_30d: Decimal
    currency: str


class SubscribersCounts(TypedDict):
    free: int
    monthly: int
    yearly: int
    paid_total: int


# -----------------------------------------------------------------------------
# Внутренние функции
# -----------------------------------------------------------------------------

def _normalize_plan_code(code: str) -> str:
    """
    Приводим коды планов из billing к формату, который ожидает фронт.

    Billing может хранить:
    - FREE
    - PRO_MONTHLY / PRO_YEARLY
    - MONTHLY / YEARLY (legacy)
    """
    code_upper = (code or "").upper()

    if code_upper == "FREE":
        return "free"
    if code_upper in ("PRO_MONTHLY", "MONTHLY"):
        return "monthly"
    if code_upper in ("PRO_YEARLY", "YEARLY"):
        return "yearly"

    # Если какой-то новый код — безопаснее считать free, чем сломать панель
    return "free"


def _subscription_status(subscription: Subscription, now=None) -> str:
    """
    Статус подписки:
    - canceled: is_active=False
    - expired: end_date <= now
    - active: is_active=True и end_date > now
    """
    if now is None:
        now = timezone.now()

    if not subscription.is_active:
        return "canceled"

    if subscription.end_date and subscription.end_date <= now:
        return "expired"

    return "active"


def _build_subscription_info(subscription: Subscription, now=None) -> SubscriptionInfo:
    """
    Собираем SubscriptionInfo из модели Subscription.
    """
    if now is None:
        now = timezone.now()

    plan_type = _normalize_plan_code(subscription.plan.code)
    status = _subscription_status(subscription, now=now)

    # платная = monthly/yearly + статус active
    is_paid = (plan_type != "free") and (status == "active")

    paid_until: Optional[str] = None
    if plan_type != "free" and subscription.end_date:
        paid_until = subscription.end_date.isoformat()

    return SubscriptionInfo(
        plan_type=plan_type,
        is_paid=is_paid,
        status=status,
        paid_until=paid_until,
    )


def _default_free_info(status: str = "active") -> SubscriptionInfo:
    """
    Дефолтная инфа для бесплатного пользователя.
    В твоём проекте, судя по тестам, FREE подписка считается active.
    """
    return SubscriptionInfo(
        plan_type="free",
        is_paid=False,
        status=status,
        paid_until=None,
    )


# -----------------------------------------------------------------------------
# Публичные функции адаптера
# -----------------------------------------------------------------------------

def get_user_subscription_info(user: User) -> SubscriptionInfo:
    """
    Подписка одного пользователя.

    Важная идея:
    - В твоей системе, скорее всего, subscription создаётся сигналом автоматически.
      Поэтому "нет подписки" — редкий случай.
    - Но на всякий случай fallback оставляем.
    """
    now = timezone.now()

    try:
        subscription = user.subscription  # OneToOne relation
    except Subscription.DoesNotExist:
        # Если вдруг подписки нет — считаем как free active (безопасно и совпадает с тестами)
        return _default_free_info(status="active")

    # Если по какой-то причине план отсутствует — тоже не падаем
    if not getattr(subscription, "plan", None):
        return _default_free_info(status="unknown")

    return _build_subscription_info(subscription, now=now)


def get_subscriptions_for_users(user_ids: List[int]) -> Dict[int, SubscriptionInfo]:
    """
    Batch получение подписок для списка пользователей (чтобы не было N+1).
    Возвращаем словарь: user_id -> SubscriptionInfo

    Важно:
    - Даже если каких-то пользователей нет в Subscription таблице, мы вернём им free active.
    """
    now = timezone.now()

    # 1 запрос на все subscriptions + plan
    subs = (
        Subscription.objects.filter(user_id__in=user_ids)
        .select_related("plan")
        .only("user_id", "is_active", "end_date", "plan__code")
    )

    result: Dict[int, SubscriptionInfo] = {}
    for sub in subs:
        if sub.plan_id is None:
            result[sub.user_id] = _default_free_info(status="unknown")
        else:
            result[sub.user_id] = _build_subscription_info(sub, now=now)

    # заполняем отсутствующих
    for uid in user_ids:
        if uid not in result:
            result[uid] = _default_free_info(status="active")

    return result


def get_subscribers_metrics() -> SubscribersCounts:
    """
    Метрики подписчиков.

    Что считаем:
    - monthly/yearly: количество АКТИВНЫХ платных подписок
    - paid_total: monthly + yearly
    - free: все остальные пользователи (у кого нет активной платной подписки)
      (т.е. free = total_users - paid_total)
    """
    now = timezone.now()

    # Активные подписки (end_date > now, is_active=True)
    # Сюда попадут и FREE, если у него end_date может быть > now.
    # Поэтому мы ниже учитываем только monthly/yearly как paid.
    active_subs = (
        Subscription.objects.filter(is_active=True, end_date__gt=now)
        .select_related("plan")
        .only("plan__code")
    )

    monthly = 0
    yearly = 0

    for sub in active_subs:
        plan_type = _normalize_plan_code(sub.plan.code)
        if plan_type == "monthly":
            monthly += 1
        elif plan_type == "yearly":
            yearly += 1

    paid_total = monthly + yearly

    # free = все пользователи - платные активные
    # (простая и понятная формула для панели)
    total_users = User.objects.count()
    free = max(total_users - paid_total, 0)

    return SubscribersCounts(
        free=free,
        monthly=monthly,
        yearly=yearly,
        paid_total=paid_total,
    )


def get_revenue_metrics() -> RevenueMetrics:
    """
    Выручка по успешным платежам (SUCCEEDED).

    total     = за всё время
    mtd       = с начала текущего месяца
    last_30d  = за последние 30 дней
    """
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)

    succeeded = Payment.objects.filter(status="SUCCEEDED")

    total = succeeded.aggregate(v=Sum("amount"))["v"] or Decimal("0.00")
    mtd = succeeded.filter(paid_at__gte=month_start).aggregate(v=Sum("amount"))["v"] or Decimal("0.00")
    last_30d = succeeded.filter(paid_at__gte=thirty_days_ago).aggregate(v=Sum("amount"))["v"] or Decimal("0.00")

    return RevenueMetrics(total=total, mtd=mtd, last_30d=last_30d, currency="RUB")

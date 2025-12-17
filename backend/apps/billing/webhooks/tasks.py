"""
Celery tasks for async webhook processing.

Production-grade асинхронная обработка webhook'ов от YooKassa.
"""

from celery import shared_task
from django.utils import timezone

from apps.billing.models import WebhookLog
from apps.billing.webhooks.handlers import handle_yookassa_event

import logging

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=30,
    ack_late=True,       # P1-CEL-02: Acknowledge after processing to prevent loss on worker crash
    queue='billing',     # P1-CEL-01: Dedicated queue to prevent AI tasks from blocking billing
)
def process_yookassa_webhook(self, log_id: int):
    """
    Асинхронная обработка YooKassa webhook события.

    Args:
        log_id: ID записи WebhookLog для обработки

    Retry strategy:
        - max_retries=5: максимум 5 попыток
        - default_retry_delay=30: задержка 30 секунд между попытками
        - Экспоненциальный backoff (30s, 60s, 120s, 240s, 480s)
        - ack_late=True: задача подтверждается ПОСЛЕ успешного выполнения

    Queue:
        - billing: отдельная очередь для платёжных задач

    Поведение:
        1. Загружает WebhookLog по ID
        2. Извлекает payload и event_type
        3. Обновляет статус на PROCESSING
        4. Вызывает handle_yookassa_event() для бизнес-логики
        5. При успехе: статус SUCCESS, processed_at = now
        6. При ошибке: статус FAILED, error_message, processed_at = now, retry
    """
    try:
        log = WebhookLog.objects.get(id=log_id)
    except WebhookLog.DoesNotExist:
        logger.error("[WEBHOOK_TASK_ERROR] log_id=%s error=not_found", log_id)
        # Не ретраим если запись удалена
        return

    payload = log.raw_payload
    event_type = log.event_type

    try:
        # Обновляем статус на PROCESSING
        WebhookLog.objects.filter(id=log_id).update(status="PROCESSING")
        logger.info("[WEBHOOK_TASK_START] log_id=%s event=%s", log_id, event_type)

        # Основная бизнес-логика
        handle_yookassa_event(event_type=event_type, payload=payload)

        # Успех
        WebhookLog.objects.filter(id=log_id).update(
            status="SUCCESS",
            processed_at=timezone.now()
        )
        logger.info("[WEBHOOK_TASK_SUCCESS] log_id=%s event=%s", log_id, event_type)

    except Exception as e:
        # Логируем ошибку
        error_msg = str(e)
        logger.error(
            "[WEBHOOK_TASK_FAILED] log_id=%s event=%s error=%s retry=%s/%s",
            log_id, event_type, error_msg, self.request.retries, self.max_retries,
            exc_info=True
        )

        # Обновляем статус на FAILED
        WebhookLog.objects.filter(id=log_id).update(
            status="FAILED",
            error_message=error_msg[:500],  # ограничиваем длину
            processed_at=timezone.now()
        )

        # Ретраим задачу с экспоненциальным backoff
        if self.request.retries < self.max_retries:
            # Экспоненциальный backoff: 30, 60, 120, 240, 480 секунд
            delay = self.default_retry_delay * (2 ** self.request.retries)
            logger.info(
                "[WEBHOOK_TASK_RETRY] log_id=%s retry=%s delay=%ss",
                log_id, self.request.retries + 1, delay
            )
            raise self.retry(exc=e, countdown=delay)
        else:
            logger.error(
                "[WEBHOOK_TASK_EXHAUSTED] log_id=%s max_retries_reached",
                log_id
            )
            # Не ретраим дальше, ошибка уже залогирована


@shared_task(queue='billing')
def retry_stuck_webhooks():
    """
    P1-WH-01: Recovery для застрявших webhooks.

    Находит WebhookLog записи в статусе PROCESSING более 10 минут
    и перезапускает их обработку.

    Рекомендуется запускать через Celery Beat каждые 5 минут:
        'retry-stuck-webhooks': {
            'task': 'apps.billing.webhooks.tasks.retry_stuck_webhooks',
            'schedule': crontab(minute='*/5'),
        }
    """
    from datetime import timedelta

    stuck_threshold = timezone.now() - timedelta(minutes=10)

    stuck = WebhookLog.objects.filter(
        status="PROCESSING",
        created_at__lt=stuck_threshold
    )

    count = stuck.count()
    if count == 0:
        logger.info("[WEBHOOK_RECOVERY] no stuck webhooks found")
        return

    logger.warning("[WEBHOOK_RECOVERY] found %s stuck webhooks, retrying...", count)

    for log in stuck:
        log.status = "QUEUED"
        log.error_message = f"Auto-retry: was stuck in PROCESSING since {log.created_at}"
        log.save(update_fields=["status", "error_message"])
        process_yookassa_webhook.delay(str(log.id))
        logger.info("[WEBHOOK_RECOVERY] requeued log_id=%s", log.id)

    logger.info("[WEBHOOK_RECOVERY] requeued %s stuck webhooks", count)


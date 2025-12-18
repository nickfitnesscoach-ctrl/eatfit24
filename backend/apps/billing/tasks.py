"""
Billing app Celery tasks.

This file is required for Celery autodiscovery to find tasks.
It imports all tasks from submodules (webhooks, etc.)
"""

# Import webhook tasks so Celery can discover them
from apps.billing.webhooks.tasks import process_yookassa_webhook  # noqa: F401
from apps.billing.webhooks.tasks import retry_stuck_webhooks  # noqa: F401
from apps.billing.webhooks.tasks import alert_failed_webhooks  # noqa: F401
from apps.billing.webhooks.tasks import cleanup_pending_payments  # noqa: F401

__all__ = [
    "process_yookassa_webhook",
    "retry_stuck_webhooks",
    "alert_failed_webhooks",
    "cleanup_pending_payments",
]



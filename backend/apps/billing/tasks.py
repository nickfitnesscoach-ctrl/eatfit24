"""
Billing app Celery tasks.

This file is required for Celery autodiscovery to find tasks.
It imports all tasks from submodules (webhooks, etc.)
"""

# Import webhook tasks so Celery can discover them
from apps.billing.webhooks.tasks import process_yookassa_webhook  # noqa: F401

__all__ = ["process_yookassa_webhook"]

"""
Тесты идемпотентности webhook обработчиков.

Проверяют, что двойной webhook с тем же payment_id не продлевает подписку дважды.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.billing.models import Payment, SubscriptionPlan
from apps.billing.webhooks.handlers import handle_yookassa_event

User = get_user_model()


class TestWebhookIdempotency(TestCase):
    """Тесты идемпотентности webhook обработчиков."""

    def setUp(self):
        """Создаём тестовые данные."""
        # Планы (используем get_or_create)
        self.free_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="FREE",
            defaults={
                "display_name": "Free",
                "price": Decimal("0"),
                "duration_days": 0,
                "is_active": True,
            },
        )
        self.pro_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="PRO_MONTHLY",
            defaults={
                "display_name": "PRO Monthly",
                "price": Decimal("299"),
                "duration_days": 30,
                "is_active": True,
            },
        )

        # Пользователь
        self.user = User.objects.create_user(
            username="testwebhook",
            email="testwebhook@example.com",
            password="testpass123",
        )

        # Используем автосозданную подписку (FREE)
        self.subscription = self.user.subscription
        self.subscription.plan = self.free_plan
        self.subscription.start_date = timezone.now()
        self.subscription.end_date = timezone.now() + timedelta(days=365 * 10)
        self.subscription.is_active = True
        self.subscription.auto_renew = False
        self.subscription.save()

        # Платёж (PENDING)
        self.payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test_payment_123",
            description="Test payment",
        )

    def test_double_webhook_does_not_extend_twice(self):
        """Двойной webhook с тем же payment_id не продлевает подписку дважды."""
        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test_payment_123",
                "status": "succeeded",
                "payment_method": {
                    "id": "pm_123",
                    "card": {"last4": "1234", "card_type": "Visa"},
                },
            },
        }

        # Первый webhook — должен продлить подписку
        handle_yookassa_event(event_type="payment.succeeded", payload=payload)

        self.payment.refresh_from_db()
        self.subscription.refresh_from_db()

        self.assertEqual(self.payment.status, "SUCCEEDED")
        self.assertEqual(self.subscription.plan.code, "PRO_MONTHLY")
        first_end_date = self.subscription.end_date

        # Второй webhook — НЕ должен продлить ещё раз
        handle_yookassa_event(event_type="payment.succeeded", payload=payload)

        self.subscription.refresh_from_db()
        second_end_date = self.subscription.end_date

        # End date НЕ должен измениться
        self.assertEqual(first_end_date, second_end_date)

    def test_succeeded_payment_skipped_on_retry(self):
        """Если payment уже SUCCEEDED, webhook игнорируется."""
        # Сначала обрабатываем первый раз
        self.payment.status = "SUCCEEDED"
        self.payment.paid_at = timezone.now()
        self.payment.webhook_processed_at = timezone.now()
        self.payment.save()

        # Обновляем подписку вручную
        initial_end = timezone.now() + timedelta(days=30)
        self.subscription.plan = self.pro_plan
        self.subscription.end_date = initial_end
        self.subscription.save()

        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test_payment_123",
                "status": "succeeded",
            },
        }

        # Повторный webhook — должен быть пропущен
        handle_yookassa_event(event_type="payment.succeeded", payload=payload)

        self.subscription.refresh_from_db()

        # End date НЕ должен измениться
        self.assertEqual(self.subscription.end_date, initial_end)

    def test_payment_canceled_does_not_extend(self):
        """Если payment CANCELED или FAILED, он не может стать SUCCEEDED."""
        self.payment.status = "CANCELED"
        self.payment.save()

        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test_payment_123",
                "status": "succeeded",
            },
        }

        # Webhook должен быть проигнорирован
        handle_yookassa_event(event_type="payment.succeeded", payload=payload)

        self.payment.refresh_from_db()
        self.subscription.refresh_from_db()

        # Статус остаётся CANCELED
        self.assertEqual(self.payment.status, "CANCELED")
        # Подписка остаётся FREE
        self.assertEqual(self.subscription.plan.code, "FREE")

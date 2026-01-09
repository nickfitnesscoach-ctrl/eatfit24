"""
Тесты для P0-A, P0-B, P0-C: автопродление подписок через YooKassa API.

Acceptance Criteria:
AC-1: Сохранение карты после первого платежа
AC-2: Toggle auto-renew защищён
AC-3: Guard от дублей работает
AC-4: Идемпотентность webhook
"""

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.billing.models import Payment, Subscription, SubscriptionPlan
from apps.billing.webhooks.handlers import (
    _handle_payment_succeeded,
    _handle_payment_canceled,
    _extract_payment_method_info,
)
from apps.billing.tasks_recurring import _process_single_renewal

User = get_user_model()


class TestP0APaymentMethodSaving(TestCase):
    """
    P0-A: Сохранение payment_method из webhook payment.succeeded.

    AC-1: Сохранение карты после первого платежа.
    """

    def setUp(self):
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
        self.user = User.objects.create_user(
            username="test_p0a",
            email="test_p0a@example.com",
            password="testpass123",
        )

    def test_extract_payment_method_info_with_saved_true(self):
        """Тест извлечения payment_method с saved=True."""
        payload_obj = {
            "id": "test-payment-123",
            "payment_method": {
                "id": "pm-abc123",
                "type": "bank_card",
                "saved": True,
                "card": {
                    "last4": "4444",
                    "card_type": "MasterCard",
                },
            },
        }

        payment_method_id, card_mask, card_brand, saved = _extract_payment_method_info(payload_obj)

        self.assertEqual(payment_method_id, "pm-abc123")
        self.assertEqual(card_mask, "•••• 4444")
        self.assertEqual(card_brand, "MasterCard")
        self.assertTrue(saved)

    def test_extract_payment_method_info_with_saved_false(self):
        """Тест извлечения payment_method с saved=False."""
        payload_obj = {
            "id": "test-payment-123",
            "payment_method": {
                "id": "pm-abc123",
                "type": "bank_card",
                "saved": False,
                "card": {
                    "last4": "4444",
                    "card_type": "Visa",
                },
            },
        }

        payment_method_id, card_mask, card_brand, saved = _extract_payment_method_info(payload_obj)

        self.assertEqual(payment_method_id, "pm-abc123")
        self.assertEqual(card_mask, "•••• 4444")
        self.assertEqual(card_brand, "Visa")
        self.assertFalse(saved)

    def test_extract_payment_method_info_no_payment_method(self):
        """Тест извлечения когда payment_method отсутствует."""
        payload_obj = {
            "id": "test-payment-123",
        }

        payment_method_id, card_mask, card_brand, saved = _extract_payment_method_info(payload_obj)

        self.assertIsNone(payment_method_id)
        self.assertIsNone(card_mask)
        self.assertIsNone(card_brand)
        self.assertFalse(saved)

    def test_payment_method_saved_on_first_payment_success(self):
        """
        AC-1: После webhook payment.succeeded с save_payment_method=true и saved=true,
        карта должна быть сохранена в Subscription.
        """
        # Создаём payment с save_payment_method=True
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.user.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-pm-save-123",
            description="Test payment",
            save_payment_method=True,
            is_recurring=False,
        )

        # Webhook payload с saved=True
        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test-pm-save-123",
                "status": "succeeded",
                "payment_method": {
                    "id": "pm-saved-abc",
                    "type": "bank_card",
                    "saved": True,
                    "card": {
                        "last4": "1234",
                        "card_type": "Visa",
                    },
                },
            },
        }

        # Обработка webhook
        _handle_payment_succeeded(payload, trace_id="test-trace-p0a-1")

        # Проверяем Payment
        payment.refresh_from_db()
        self.assertEqual(payment.status, "SUCCEEDED")
        self.assertEqual(payment.yookassa_payment_method_id, "pm-saved-abc")

        # Проверяем Subscription (AC-1)
        subscription = self.user.subscription
        subscription.refresh_from_db()
        self.assertEqual(subscription.yookassa_payment_method_id, "pm-saved-abc")
        self.assertEqual(subscription.card_mask, "•••• 1234")
        self.assertEqual(subscription.card_brand, "Visa")
        self.assertTrue(subscription.auto_renew)

    def test_payment_method_not_saved_if_saved_false(self):
        """Если payment_method.saved=False, то НЕ сохраняем в Subscription."""
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.user.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-pm-not-saved-123",
            description="Test payment",
            save_payment_method=True,
            is_recurring=False,
        )

        # Webhook payload с saved=False
        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test-pm-not-saved-123",
                "status": "succeeded",
                "payment_method": {
                    "id": "pm-not-saved-abc",
                    "type": "bank_card",
                    "saved": False,
                    "card": {
                        "last4": "5555",
                        "card_type": "MasterCard",
                    },
                },
            },
        }

        _handle_payment_succeeded(payload, trace_id="test-trace-p0a-2")

        # Проверяем Payment — payment_method_id НЕ должен сохраниться
        payment.refresh_from_db()
        self.assertEqual(payment.status, "SUCCEEDED")
        self.assertIsNone(payment.yookassa_payment_method_id)

        # Проверяем Subscription — НЕ должны быть сохранены данные карты
        subscription = self.user.subscription
        subscription.refresh_from_db()
        self.assertIsNone(subscription.yookassa_payment_method_id)
        self.assertIsNone(subscription.card_mask)
        self.assertIsNone(subscription.card_brand)
        self.assertFalse(subscription.auto_renew)

    def test_recurring_payment_does_not_update_subscription_payment_method(self):
        """
        Для recurring платежей мы НЕ обновляем payment_method в Subscription
        (он уже сохранён при первом платеже).
        """
        # Настраиваем Subscription с уже сохранённым payment_method
        subscription = self.user.subscription
        subscription.yookassa_payment_method_id = "pm-original"
        subscription.card_mask = "•••• 9999"
        subscription.card_brand = "Visa"
        subscription.auto_renew = True
        subscription.save()

        # Создаём recurring payment
        payment = Payment.objects.create(
            user=self.user,
            subscription=subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-recurring-123",
            description="Recurring payment",
            save_payment_method=False,
            is_recurring=True,
        )

        # Webhook payload (recurring payment успешен)
        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test-recurring-123",
                "status": "succeeded",
                "payment_method": {
                    "id": "pm-original",
                    "type": "bank_card",
                    "saved": True,
                    "card": {
                        "last4": "9999",
                        "card_type": "Visa",
                    },
                },
            },
        }

        _handle_payment_succeeded(payload, trace_id="test-trace-p0a-3")

        # Проверяем Subscription — payment_method НЕ должен измениться
        subscription.refresh_from_db()
        self.assertEqual(subscription.yookassa_payment_method_id, "pm-original")
        self.assertEqual(subscription.card_mask, "•••• 9999")
        self.assertEqual(subscription.card_brand, "Visa")
        self.assertTrue(subscription.auto_renew)


class TestP0BRecurringGuard(TestCase):
    """
    P0-B: Recurring processing guard от дублей.

    AC-3: Guard от дублей работает.
    """

    def setUp(self):
        self.pro_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="PRO_MONTHLY",
            defaults={
                "display_name": "PRO Monthly",
                "price": Decimal("299"),
                "duration_days": 30,
                "is_active": True,
            },
        )
        self.user = User.objects.create_user(
            username="test_p0b",
            email="test_p0b@example.com",
            password="testpass123",
        )
        self.subscription = self.user.subscription
        self.subscription.plan = self.pro_plan
        self.subscription.auto_renew = True
        self.subscription.yookassa_payment_method_id = "pm-test-123"
        self.subscription.end_date = timezone.now()
        self.subscription.save()

    def test_db_guard_prevents_duplicate_payment_creation(self):
        """
        AC-3: Если Payment уже существует для (subscription, billing_period_end, status=PENDING/SUCCEEDED),
        то повторный вызов process_single_renewal должен вернуть 'skipped'.
        """
        billing_period_end = self.subscription.end_date

        # Создаём первый платёж
        Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-guard-123",
            is_recurring=True,
            billing_period_end=billing_period_end,
        )

        # Пытаемся создать второй платёж для того же периода
        with patch("apps.billing.tasks_recurring.YooKassaService") as mock_yk:
            result = _process_single_renewal(self.subscription)

        # Должно вернуться 'skipped', YooKassa НЕ должна быть вызвана
        self.assertEqual(result, "skipped")
        mock_yk.assert_not_called()

        # Проверяем, что в БД только 1 платёж для этого периода
        payments_count = Payment.objects.filter(
            subscription=self.subscription,
            billing_period_end=billing_period_end,
        ).count()
        self.assertEqual(payments_count, 1)

    def test_db_guard_allows_payment_if_previous_failed(self):
        """DB guard НЕ блокирует создание платежа, если предыдущий имеет status=FAILED."""
        billing_period_end = self.subscription.end_date

        # Создаём FAILED платёж
        Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="FAILED",
            provider="YOOKASSA",
            yookassa_payment_id="test-guard-failed",
            is_recurring=True,
            billing_period_end=billing_period_end,
        )

        # Пытаемся создать новый платёж
        with patch("apps.billing.tasks_recurring.YooKassaService") as mock_yk:
            mock_yk.return_value.create_recurring_payment.return_value = {
                "id": "yk-new-payment-123",
                "status": "pending",
            }

            result = _process_single_renewal(self.subscription)

        # Должно вернуться 'created' (guard не блокирует FAILED)
        self.assertEqual(result, "created")

    def test_idempotency_key_format(self):
        """Проверяем формат idempotency_key для YooKassa."""
        # Idempotency key должен быть детерминированным
        billing_period_end = self.subscription.end_date
        expected_key = f"renewal:{self.subscription.id}:{billing_period_end.date().isoformat()}"

        with patch("apps.billing.tasks_recurring.YooKassaService") as mock_yk:
            mock_yk.return_value.create_recurring_payment.return_value = {
                "id": "yk-idempotency-test",
                "status": "pending",
            }

            _process_single_renewal(self.subscription)

            # Проверяем, что YooKassa был вызван с правильным idempotency_key
            mock_yk.return_value.create_recurring_payment.assert_called_once()
            call_kwargs = mock_yk.return_value.create_recurring_payment.call_args.kwargs
            self.assertEqual(call_kwargs["idempotency_key"], expected_key)


class TestP0CPaymentCanceled(TestCase):
    """
    P0-C: Обработка payment.canceled для recurring платежей.

    AC-4: Идемпотентность webhook + обработка cancellation_details.reason.
    """

    def setUp(self):
        self.pro_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="PRO_MONTHLY",
            defaults={
                "display_name": "PRO Monthly",
                "price": Decimal("299"),
                "duration_days": 30,
                "is_active": True,
            },
        )
        self.user = User.objects.create_user(
            username="test_p0c",
            email="test_p0c@example.com",
            password="testpass123",
        )
        self.subscription = self.user.subscription
        self.subscription.plan = self.pro_plan
        self.subscription.auto_renew = True
        self.subscription.yookassa_payment_method_id = "pm-test-cancel"
        self.subscription.card_mask = "•••• 1234"
        self.subscription.card_brand = "Visa"
        self.subscription.save()

    def test_permission_revoked_disables_auto_renew(self):
        """
        Если cancellation_details.reason = "permission_revoked",
        то auto_renew должен быть выключен и payment_method очищен.
        """
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-cancel-permission",
            is_recurring=True,
        )

        payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": "test-cancel-permission",
                "status": "canceled",
                "cancellation_details": {
                    "reason": "permission_revoked",
                },
            },
        }

        _handle_payment_canceled(payload, trace_id="test-trace-p0c-1")

        # Проверяем Payment
        payment.refresh_from_db()
        self.assertEqual(payment.status, "CANCELED")
        self.assertIn("permission_revoked", payment.error_message)

        # Проверяем Subscription — auto_renew должен быть выключен
        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.auto_renew)
        self.assertIsNone(self.subscription.yookassa_payment_method_id)
        self.assertIsNone(self.subscription.card_mask)
        self.assertIsNone(self.subscription.card_brand)

    def test_card_expired_disables_auto_renew(self):
        """
        Если cancellation_details.reason = "card_expired",
        то auto_renew должен быть выключен и payment_method очищен.
        """
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-cancel-expired",
            is_recurring=True,
        )

        payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": "test-cancel-expired",
                "status": "canceled",
                "cancellation_details": {
                    "reason": "card_expired",
                },
            },
        }

        _handle_payment_canceled(payload, trace_id="test-trace-p0c-2")

        # Проверяем Subscription
        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.auto_renew)
        self.assertIsNone(self.subscription.yookassa_payment_method_id)

    def test_insufficient_funds_keeps_auto_renew_enabled(self):
        """
        Если cancellation_details.reason = "insufficient_funds",
        то auto_renew НЕ должен быть выключен (разрешаем retry).
        """
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-cancel-funds",
            is_recurring=True,
        )

        payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": "test-cancel-funds",
                "status": "canceled",
                "cancellation_details": {
                    "reason": "insufficient_funds",
                },
            },
        }

        _handle_payment_canceled(payload, trace_id="test-trace-p0c-3")

        # Проверяем Payment
        payment.refresh_from_db()
        self.assertEqual(payment.status, "CANCELED")

        # Проверяем Subscription — auto_renew должен остаться включённым
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.auto_renew)
        self.assertEqual(self.subscription.yookassa_payment_method_id, "pm-test-cancel")
        self.assertEqual(self.subscription.card_mask, "•••• 1234")

    def test_other_cancellation_reasons_keep_auto_renew(self):
        """
        Для других cancellation reasons (кроме permission_revoked, card_expired)
        auto_renew должен остаться включённым.
        """
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-cancel-other",
            is_recurring=True,
        )

        payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": "test-cancel-other",
                "status": "canceled",
                "cancellation_details": {
                    "reason": "3d_secure_failed",
                },
            },
        }

        _handle_payment_canceled(payload, trace_id="test-trace-p0c-4")

        # Проверяем Subscription — auto_renew должен остаться включённым
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.auto_renew)
        self.assertEqual(self.subscription.yookassa_payment_method_id, "pm-test-cancel")

    def test_non_recurring_payment_canceled_ignores_cancellation_logic(self):
        """
        Для non-recurring платежей обработка cancellation_details.reason НЕ применяется.
        """
        # Создаём non-recurring payment
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-cancel-non-recurring",
            is_recurring=False,
        )

        payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": "test-cancel-non-recurring",
                "status": "canceled",
                "cancellation_details": {
                    "reason": "permission_revoked",
                },
            },
        }

        _handle_payment_canceled(payload, trace_id="test-trace-p0c-5")

        # Payment должен быть CANCELED
        payment.refresh_from_db()
        self.assertEqual(payment.status, "CANCELED")

        # Subscription должна остаться без изменений (is_recurring=False)
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.auto_renew)
        self.assertEqual(self.subscription.yookassa_payment_method_id, "pm-test-cancel")


class TestWebhookIdempotency(TestCase):
    """AC-4: Идемпотентность webhook."""

    def setUp(self):
        self.pro_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="PRO_MONTHLY",
            defaults={
                "display_name": "PRO Monthly",
                "price": Decimal("299"),
                "duration_days": 30,
                "is_active": True,
            },
        )
        self.user = User.objects.create_user(
            username="test_idempotency",
            email="test_idempotency@example.com",
            password="testpass123",
        )

    def test_duplicate_payment_succeeded_webhook_is_no_op(self):
        """
        AC-4: Повторный webhook payment.succeeded для уже обработанного платежа
        должен быть no-op (не изменять состояние).
        """
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.user.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-idempotency-123",
            save_payment_method=True,
            is_recurring=False,
        )

        payload = {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {
                "id": "test-idempotency-123",
                "status": "succeeded",
                "payment_method": {
                    "id": "pm-idempotency",
                    "type": "bank_card",
                    "saved": True,
                    "card": {
                        "last4": "7777",
                        "card_type": "Visa",
                    },
                },
            },
        }

        # Первый вызов
        _handle_payment_succeeded(payload, trace_id="test-trace-idem-1")

        payment.refresh_from_db()
        first_paid_at = payment.paid_at
        self.assertEqual(payment.status, "SUCCEEDED")

        subscription = self.user.subscription
        subscription.refresh_from_db()
        first_end_date = subscription.end_date

        # Второй вызов (дубликат webhook)
        _handle_payment_succeeded(payload, trace_id="test-trace-idem-2")

        # Проверяем, что состояние НЕ изменилось
        payment.refresh_from_db()
        self.assertEqual(payment.status, "SUCCEEDED")
        self.assertEqual(payment.paid_at, first_paid_at)

        subscription.refresh_from_db()
        self.assertEqual(subscription.end_date, first_end_date)

    def test_duplicate_payment_canceled_webhook_is_no_op(self):
        """Повторный webhook payment.canceled для уже отменённого платежа — no-op."""
        payment = Payment.objects.create(
            user=self.user,
            subscription=self.user.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            yookassa_payment_id="test-cancel-idempotency",
            is_recurring=True,
        )

        payload = {
            "type": "notification",
            "event": "payment.canceled",
            "object": {
                "id": "test-cancel-idempotency",
                "status": "canceled",
                "cancellation_details": {
                    "reason": "permission_revoked",
                },
            },
        }

        # Первый вызов
        _handle_payment_canceled(payload, trace_id="test-trace-cancel-idem-1")

        payment.refresh_from_db()
        first_webhook_processed_at = payment.webhook_processed_at
        self.assertEqual(payment.status, "CANCELED")

        # Второй вызов (дубликат)
        _handle_payment_canceled(payload, trace_id="test-trace-cancel-idem-2")

        payment.refresh_from_db()
        self.assertEqual(payment.status, "CANCELED")
        self.assertEqual(payment.webhook_processed_at, first_webhook_processed_at)

"""
Тесты для recurring payments (автопродление подписок).

Проверяют:
1. DB guard предотвращает создание дубликатов платежей
2. Задача выбирает только eligible подписки
3. Задача НЕ продлевает подписку (только webhook делает это)
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.billing.models import Payment, SubscriptionPlan
from apps.billing.tasks_recurring import _process_single_renewal, process_due_renewals

User = get_user_model()


class TestRecurringRenewals(TestCase):
    """Тесты для recurring payments."""

    def setUp(self):
        """Создаём тестовые данные."""
        # Планы (используем get_or_create чтобы избежать unique constraint)
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
            username="testrecurring",
            email="testrecurring@example.com",
            password="testpass123",
        )

        # Подписка PRO, истекает через 12 часов
        # Используем автосозданную подписку от сигнала
        self.subscription = self.user.subscription
        self.subscription.plan = self.pro_plan
        self.subscription.start_date = timezone.now() - timedelta(days=30)
        self.subscription.end_date = timezone.now() + timedelta(hours=12)
        self.subscription.is_active = True
        self.subscription.auto_renew = True
        self.subscription.yookassa_payment_method_id = "pm_saved_123"
        self.subscription.save()

    @override_settings(BILLING_RECURRING_ENABLED=True)
    @patch("apps.billing.tasks_recurring.YooKassaService")
    def test_db_guard_prevents_duplicate_payment(self, mock_yk_service):
        """Если Payment для периода существует (PENDING/SUCCEEDED), новый не создаётся."""
        # Создаём существующий PENDING платёж для этого периода
        Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.pro_plan,
            amount=Decimal("299"),
            currency="RUB",
            status="PENDING",
            provider="YOOKASSA",
            billing_period_end=self.subscription.end_date,
            yookassa_payment_id="existing_123",
        )

        # Пытаемся создать новый платёж
        result = _process_single_renewal(self.subscription)

        # Должен быть пропущен
        self.assertEqual(result, "skipped")

        # YooKassa НЕ должен быть вызван
        mock_yk_service.assert_not_called()

        # Новый платёж НЕ должен быть создан
        payments_count = Payment.objects.filter(subscription=self.subscription).count()
        self.assertEqual(payments_count, 1)

    @override_settings(BILLING_RECURRING_ENABLED=True)
    @patch("apps.billing.tasks_recurring.YooKassaService")
    def test_payment_created_when_no_existing(self, mock_yk_service):
        """Если платёж для периода не существует, создаётся новый."""
        # Мокаем YooKassa
        mock_instance = MagicMock()
        mock_instance.create_recurring_payment.return_value = {
            "id": "yk_new_payment_123",
            "status": "pending",
            "amount": "299",
            "currency": "RUB",
            "payment_method_id": "pm_saved_123",
        }
        mock_yk_service.return_value = mock_instance

        # Создаём платёж
        result = _process_single_renewal(self.subscription)

        # Должен быть создан
        self.assertEqual(result, "created")

        # YooKassa был вызван
        mock_instance.create_recurring_payment.assert_called_once()

        # Проверяем созданный платёж
        payment = Payment.objects.get(
            subscription=self.subscription,
            billing_period_end=self.subscription.end_date,
        )
        self.assertEqual(payment.status, "PENDING")
        self.assertEqual(payment.yookassa_payment_id, "yk_new_payment_123")
        self.assertTrue(payment.is_recurring)

    @override_settings(BILLING_RECURRING_ENABLED=True)
    @patch("apps.billing.tasks_recurring.YooKassaService")
    def test_task_does_not_extend_subscription(self, mock_yk_service):
        """Задача НЕ меняет end_date подписки (только webhook делает это)."""
        mock_instance = MagicMock()
        mock_instance.create_recurring_payment.return_value = {
            "id": "yk_payment_123",
            "status": "pending",
            "amount": "299",
            "currency": "RUB",
            "payment_method_id": "pm_saved_123",
        }
        mock_yk_service.return_value = mock_instance

        original_end_date = self.subscription.end_date

        # Запускаем задачу
        _process_single_renewal(self.subscription)

        # Обновляем подписку
        self.subscription.refresh_from_db()

        # End date НЕ должен измениться
        self.assertEqual(self.subscription.end_date, original_end_date)

    @override_settings(BILLING_RECURRING_ENABLED=False)
    def test_feature_flag_disabled_skips_processing(self):
        """Если feature flag выключен, задача не обрабатывает подписки."""
        result = process_due_renewals()

        self.assertEqual(result["status"], "disabled")
        self.assertEqual(result["processed"], 0)

    @override_settings(BILLING_RECURRING_ENABLED=True)
    def test_free_plan_not_selected(self):
        """FREE подписки не выбираются для автопродления."""
        # Переводим подписку в FREE
        self.subscription.plan = self.free_plan
        self.subscription.save()

        result = process_due_renewals()

        # Не должно быть обработанных
        self.assertEqual(result["processed"], 0)

    @override_settings(BILLING_RECURRING_ENABLED=True)
    def test_auto_renew_disabled_not_selected(self):
        """Подписки с auto_renew=False не выбираются."""
        self.subscription.auto_renew = False
        self.subscription.save()

        result = process_due_renewals()

        self.assertEqual(result["processed"], 0)

    @override_settings(BILLING_RECURRING_ENABLED=True)
    def test_no_payment_method_not_selected(self):
        """Подписки без payment_method_id не выбираются."""
        self.subscription.yookassa_payment_method_id = None
        self.subscription.save()

        result = process_due_renewals()

        self.assertEqual(result["processed"], 0)

    @override_settings(BILLING_RECURRING_ENABLED=True)
    def test_far_future_end_date_not_selected(self):
        """Подписки с end_date далеко в будущем не выбираются."""
        self.subscription.end_date = timezone.now() + timedelta(days=30)
        self.subscription.save()

        result = process_due_renewals()

        self.assertEqual(result["processed"], 0)

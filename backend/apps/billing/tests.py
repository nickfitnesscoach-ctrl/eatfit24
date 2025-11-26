"""
Тесты для billing приложения.
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status as http_status
from datetime import timedelta

from .models import SubscriptionPlan, Subscription, Payment
from .services import create_monthly_subscription_payment, activate_or_extend_subscription, get_effective_plan_for_user
from .usage import DailyUsage


class SubscriptionPlanTestCase(TestCase):
    """Тесты для модели SubscriptionPlan."""

    def setUp(self):
        """Создаем тестовые планы."""
        self.free_plan = SubscriptionPlan.objects.create(
            name='FREE',
            display_name='Бесплатный',
            price=Decimal('0.00'),
            duration_days=0,
            max_photos_per_day=3,
            is_active=True
        )

        self.monthly_plan = SubscriptionPlan.objects.create(
            name='MONTHLY',
            display_name='Pro Месячный',
            price=Decimal('199.00'),
            duration_days=30,
            max_photos_per_day=-1,
            is_active=True
        )

    def test_plan_creation(self):
        """Тест создания планов."""
        self.assertEqual(SubscriptionPlan.objects.count(), 2)
        self.assertEqual(self.free_plan.name, 'FREE')
        self.assertEqual(self.monthly_plan.price, Decimal('199.00'))


class CreateMonthlyPaymentTestCase(TestCase):
    """Тесты для создания платежей через API."""

    def setUp(self):
        """Настройка тестовых данных."""
        self.client = APIClient()

        # Создаем пользователя
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Создаем планы
        self.free_plan = SubscriptionPlan.objects.create(
            name='FREE',
            display_name='Бесплатный',
            price=Decimal('0.00'),
            duration_days=0,
            is_active=True
        )

        self.monthly_plan = SubscriptionPlan.objects.create(
            name='MONTHLY',
            display_name='Pro Месячный',
            price=Decimal('199.00'),
            duration_days=30,
            is_active=True
        )

        # Создаем бесплатную подписку для пользователя
        self.subscription = Subscription.objects.create(
            user=self.user,
            plan=self.free_plan,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=365),
            is_active=True
        )

    @patch('apps.billing.yookassa_client.YooKassaClient.create_payment')
    def test_create_plus_payment_api(self, mock_create_payment):
        """Тест создания платежа через API endpoint."""
        # Мокаем ответ от YooKassa
        mock_create_payment.return_value = {
            'id': 'test-payment-id-123',
            'status': 'pending',
            'amount': {'value': '199.00', 'currency': 'RUB'},
            'confirmation': {
                'type': 'redirect',
                'confirmation_url': 'https://yookassa.ru/payments/test-payment-id-123'
            },
            'metadata': {}
        }

        # Авторизуемся
        self.client.force_authenticate(user=self.user)

        # Отправляем запрос
        url = reverse('billing:create-plus-payment')
        response = self.client.post(url, {}, format='json')

        # Проверяем ответ
        self.assertEqual(response.status_code, http_status.HTTP_201_CREATED)
        self.assertIn('payment_id', response.data)
        self.assertIn('yookassa_payment_id', response.data)
        self.assertIn('confirmation_url', response.data)
        self.assertEqual(response.data['yookassa_payment_id'], 'test-payment-id-123')

        # Проверяем, что платеж создан в БД
        payment = Payment.objects.get(yookassa_payment_id='test-payment-id-123')
        self.assertEqual(payment.status, 'PENDING')
        self.assertEqual(payment.user, self.user)
        self.assertEqual(payment.plan, self.monthly_plan)
        self.assertEqual(payment.amount, Decimal('199.00'))

    def test_create_plus_payment_without_auth(self):
        """Тест создания платежа без авторизации."""
        url = reverse('billing:create-plus-payment')
        response = self.client.post(url, {}, format='json')

        # Должны получить 401 Unauthorized
        self.assertEqual(response.status_code, http_status.HTTP_401_UNAUTHORIZED)


class WebhookPaymentSucceededTestCase(TestCase):
    """Тесты для webhook обработчика payment.succeeded."""

    def setUp(self):
        """Настройка тестовых данных."""
        self.client = APIClient()

        # Создаем пользователя
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Создаем планы
        self.free_plan = SubscriptionPlan.objects.create(
            name='FREE',
            display_name='Бесплатный',
            price=Decimal('0.00'),
            duration_days=0,
            is_active=True
        )

        self.monthly_plan = SubscriptionPlan.objects.create(
            name='MONTHLY',
            display_name='Pro Месячный',
            price=Decimal('199.00'),
            duration_days=30,
            is_active=True
        )

        # Создаем подписку
        self.subscription = Subscription.objects.create(
            user=self.user,
            plan=self.free_plan,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=365),
            is_active=True
        )

        # Создаем платеж
        self.payment = Payment.objects.create(
            user=self.user,
            subscription=self.subscription,
            plan=self.monthly_plan,
            amount=Decimal('199.00'),
            currency='RUB',
            status='PENDING',
            yookassa_payment_id='test-payment-id-webhook',
            provider='YOOKASSA'
        )

    @patch('apps.billing.webhooks.YooKassaService.parse_webhook_notification')
    def test_webhook_payment_succeeded_creates_subscription(self, mock_parse):
        """Тест обработки webhook payment.succeeded."""
        # Мокаем webhook notification
        mock_notification = MagicMock()
        mock_notification.event = 'payment.succeeded'
        mock_notification.object.id = 'test-payment-id-webhook'
        mock_notification.object.payment_method = None
        mock_parse.return_value = mock_notification

        # Отправляем webhook
        url = reverse('billing:yookassa-webhook')
        webhook_data = {
            'type': 'notification',
            'event': 'payment.succeeded',
            'object': {
                'id': 'test-payment-id-webhook',
                'status': 'succeeded',
                'amount': {'value': '199.00', 'currency': 'RUB'}
            }
        }

        response = self.client.post(url, webhook_data, format='json')

        # Проверяем ответ
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)

        # Проверяем, что платеж обновлен
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, 'SUCCEEDED')
        self.assertIsNotNone(self.payment.paid_at)

        # Проверяем, что подписка обновлена
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan, self.monthly_plan)
        self.assertTrue(self.subscription.is_active)


class GetSubscriptionStatusTestCase(TestCase):
    """Тесты для endpoint /billing/me/."""

    def setUp(self):
        """Настройка тестовых данных."""
        self.client = APIClient()

        # Создаем пользователя
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Создаем план
        self.monthly_plan = SubscriptionPlan.objects.create(
            name='MONTHLY',
            display_name='Pro Месячный',
            price=Decimal('199.00'),
            duration_days=30,
            is_active=True
        )

        # Создаем подписку
        self.subscription = Subscription.objects.create(
            user=self.user,
            plan=self.monthly_plan,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

    def test_get_subscription_status(self):
        """Тест получения статуса подписки."""
        self.client.force_authenticate(user=self.user)

        url = reverse('billing:subscription-status')
        response = self.client.get(url)

        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        self.assertEqual(response.data['plan_code'], 'MONTHLY')
        self.assertEqual(response.data['plan_name'], 'Pro Месячный')
        self.assertTrue(response.data['is_active'])
        self.assertIsNotNone(response.data['expires_at'])

    def test_get_subscription_status_without_auth(self):
        """Тест получения статуса без авторизации."""
        url = reverse('billing:subscription-status')
        response = self.client.get(url)

        self.assertEqual(response.status_code, http_status.HTTP_401_UNAUTHORIZED)


class ActivateOrExtendSubscriptionTestCase(TestCase):
    """Тесты для сервиса activate_or_extend_subscription."""

    def setUp(self):
        """Настройка тестовых данных."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        self.monthly_plan = SubscriptionPlan.objects.create(
            name='MONTHLY',
            display_name='Pro Месячный',
            price=Decimal('199.00'),
            duration_days=30,
            is_active=True
        )

        self.free_plan = SubscriptionPlan.objects.create(
            name='FREE',
            display_name='Бесплатный',
            price=Decimal('0.00'),
            duration_days=0,
            is_active=True
        )

    def test_activate_new_subscription(self):
        """Тест активации новой подписки."""
        # Создаем бесплатную подписку
        subscription = Subscription.objects.create(
            user=self.user,
            plan=self.free_plan,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=365),
            is_active=True
        )

        # Активируем месячную подписку
        updated_subscription = activate_or_extend_subscription(
            user=self.user,
            plan_code='MONTHLY',
            duration_days=30
        )

        self.assertEqual(updated_subscription.plan, self.monthly_plan)
        self.assertTrue(updated_subscription.is_active)

    def test_extend_active_subscription(self):
        """Тест продления активной подписки."""
        now = timezone.now()
        end_date = now + timedelta(days=10)

        subscription = Subscription.objects.create(
            user=self.user,
            plan=self.monthly_plan,
            start_date=now,
            end_date=end_date,
            is_active=True
        )

        # Продлеваем подписку
        updated_subscription = activate_or_extend_subscription(
            user=self.user,
            plan_code='MONTHLY',
            duration_days=30
        )

        # Проверяем, что дата окончания увеличилась
        expected_end_date = end_date + timedelta(days=30)
        self.assertAlmostEqual(
            updated_subscription.end_date.timestamp(),
            expected_end_date.timestamp(),
            delta=1
        )


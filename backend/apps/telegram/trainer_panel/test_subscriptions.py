"""
ТЕСТЫ: Trainer Panel — Billing Adapter (подписки и выручка)

Зачем нужен этот файл:
- Billing adapter — это слой, который "склеивает" billing-модуль и trainer panel.
- Он должен корректно:
  1) Определять статус подписки (free / monthly / yearly, active / expired)
  2) Возвращать информацию по подписке для 1 юзера и пачкой (batch)
  3) Считать метрики подписчиков (сколько платных/бесплатных)
  4) Считать выручку по успешным платежам (total / mtd / last_30d)

Почему это важно:
- Ошибка тут = неправильные цифры в панели тренера и/или неверные статусы подписки у пользователей.
- Это "денежная" зона, поэтому тесты обязаны быть.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.billing.models import Payment, SubscriptionPlan
from apps.telegram.trainer_panel.billing_adapter import (
    get_revenue_metrics,
    get_subscribers_metrics,
    get_subscriptions_for_users,
    get_user_subscription_info,
)


class BillingAdapterTestCase(TestCase):
    """
    Интеграционные тесты адаптера биллинга:
    - создаём планы/пользователей/платежи
    - проверяем ответы функций адаптера
    """

    @classmethod
    def setUpTestData(cls):
        """
        Создаём планы 1 раз на весь класс.
        (Это быстрее, чем пересоздавать в каждом тесте.)
        """
        cls.free_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="FREE",
            defaults={"display_name": "Free Plan", "price": 0, "duration_days": 0},
        )
        cls.monthly_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="PRO_MONTHLY",
            defaults={"display_name": "Pro Monthly", "price": 999, "duration_days": 30},
        )
        cls.yearly_plan, _ = SubscriptionPlan.objects.get_or_create(
            code="PRO_YEARLY",
            defaults={"display_name": "Pro Yearly", "price": 9990, "duration_days": 365},
        )

    def setUp(self):
        """
        Для каждого теста создаём пользователей заново.
        Так тесты независимы и не влияют друг на друга.
        """
        self.user_free = User.objects.create_user("user_free", "free@test.com", "password")
        self.user_monthly = User.objects.create_user("user_monthly", "monthly@test.com", "password")
        self.user_yearly = User.objects.create_user("user_yearly", "yearly@test.com", "password")
        self.user_expired = User.objects.create_user("user_expired", "expired@test.com", "password")

        now = timezone.now()

        # Важно: предполагаем, что у каждого User автоматически создаётся subscription сигналом.
        # Если сигнал отключат — тесты должны упасть с понятной причиной.
        for u in [self.user_free, self.user_monthly, self.user_yearly, self.user_expired]:
            self.assertTrue(hasattr(u, "subscription"), "У пользователя должен быть subscription (создаётся сигналом)")

        # Monthly active
        monthly_sub = self.user_monthly.subscription
        monthly_sub.plan = self.monthly_plan
        monthly_sub.end_date = now + timedelta(days=30)
        monthly_sub.save()

        # Yearly active
        yearly_sub = self.user_yearly.subscription
        yearly_sub.plan = self.yearly_plan
        yearly_sub.end_date = now + timedelta(days=365)
        yearly_sub.save()

        # Expired monthly
        expired_sub = self.user_expired.subscription
        expired_sub.plan = self.monthly_plan
        expired_sub.start_date = now - timedelta(days=60)
        expired_sub.end_date = now - timedelta(days=30)
        expired_sub.save()

    # ---------------------------------------------------------------------
    # 1) get_user_subscription_info
    # ---------------------------------------------------------------------

    def test_get_user_subscription_info_free(self):
        info = get_user_subscription_info(self.user_free)

        self.assertEqual(info["plan_type"], "free")
        self.assertFalse(info["is_paid"])
        self.assertEqual(info["status"], "active")
        self.assertIsNone(info["paid_until"])

    def test_get_user_subscription_info_monthly_active(self):
        info = get_user_subscription_info(self.user_monthly)

        self.assertEqual(info["plan_type"], "monthly")
        self.assertTrue(info["is_paid"])
        self.assertEqual(info["status"], "active")
        self.assertIsNotNone(info["paid_until"])

    def test_get_user_subscription_info_yearly_active(self):
        info = get_user_subscription_info(self.user_yearly)

        self.assertEqual(info["plan_type"], "yearly")
        self.assertTrue(info["is_paid"])
        self.assertEqual(info["status"], "active")
        self.assertIsNotNone(info["paid_until"])

    def test_get_user_subscription_info_expired(self):
        info = get_user_subscription_info(self.user_expired)

        self.assertEqual(info["plan_type"], "monthly")
        self.assertFalse(info["is_paid"])
        self.assertEqual(info["status"], "expired")
        self.assertIsNotNone(info["paid_until"])

    def test_get_user_subscription_info_auto_free(self):
        """
        Если user только создан — у него должна быть FREE подписка от сигнала.
        """
        user_no_sub = User.objects.create_user("no_sub", "nosub@test.com", "password")
        self.assertTrue(hasattr(user_no_sub, "subscription"))

        info = get_user_subscription_info(user_no_sub)
        self.assertEqual(info["plan_type"], "free")
        self.assertFalse(info["is_paid"])
        self.assertEqual(info["status"], "active")
        self.assertIsNone(info["paid_until"])

    # ---------------------------------------------------------------------
    # 2) get_subscriptions_for_users (batch)
    # ---------------------------------------------------------------------

    def test_get_subscriptions_for_users_batch(self):
        user_ids = [self.user_free.id, self.user_monthly.id, self.user_yearly.id, self.user_expired.id]
        subscriptions_map = get_subscriptions_for_users(user_ids)

        self.assertEqual(len(subscriptions_map), 4)

        self.assertEqual(subscriptions_map[self.user_free.id]["plan_type"], "free")
        self.assertFalse(subscriptions_map[self.user_free.id]["is_paid"])

        self.assertEqual(subscriptions_map[self.user_monthly.id]["plan_type"], "monthly")
        self.assertTrue(subscriptions_map[self.user_monthly.id]["is_paid"])

        self.assertEqual(subscriptions_map[self.user_yearly.id]["plan_type"], "yearly")
        self.assertTrue(subscriptions_map[self.user_yearly.id]["is_paid"])

        self.assertEqual(subscriptions_map[self.user_expired.id]["plan_type"], "monthly")
        self.assertFalse(subscriptions_map[self.user_expired.id]["is_paid"])

    # ---------------------------------------------------------------------
    # 3) Метрики подписчиков
    # ---------------------------------------------------------------------

    def test_get_subscribers_metrics(self):
        metrics = get_subscribers_metrics()

        # В этом наборе данных: 1 monthly active + 1 yearly active = 2 платных
        self.assertEqual(metrics["monthly"], 1)
        self.assertEqual(metrics["yearly"], 1)
        self.assertEqual(metrics["paid_total"], 2)

    # ---------------------------------------------------------------------
    # 4) Выручка
    # ---------------------------------------------------------------------

    def test_get_revenue_metrics_no_payments(self):
        revenue = get_revenue_metrics()

        self.assertEqual(revenue["total"], Decimal("0.00"))
        self.assertEqual(revenue["mtd"], Decimal("0.00"))
        self.assertEqual(revenue["last_30d"], Decimal("0.00"))
        self.assertEqual(revenue["currency"], "RUB")

    def test_get_revenue_metrics_with_payments(self):
        now = timezone.now()

        # Payment 1: успешно, сегодня
        Payment.objects.create(
            user=self.user_monthly,
            subscription=self.user_monthly.subscription,
            plan=self.monthly_plan,
            amount=Decimal("999.00"),
            status="SUCCEEDED",
            paid_at=now,
        )

        # Payment 2: успешно, 20 дней назад (это НЕ обязательно прошлый месяц)
        Payment.objects.create(
            user=self.user_yearly,
            subscription=self.user_yearly.subscription,
            plan=self.yearly_plan,
            amount=Decimal("9990.00"),
            status="SUCCEEDED",
            paid_at=now - timedelta(days=20),
        )

        # Payment 3: failed — в выручку НЕ должен попасть
        Payment.objects.create(
            user=self.user_expired,
            subscription=self.user_expired.subscription,
            plan=self.monthly_plan,
            amount=Decimal("999.00"),
            status="FAILED",
            paid_at=now,
        )

        # Payment 4: успешно, 60 дней назад — в total попадёт, в last_30d нет
        Payment.objects.create(
            user=self.user_monthly,
            subscription=self.user_monthly.subscription,
            plan=self.monthly_plan,
            amount=Decimal("999.00"),
            status="SUCCEEDED",
            paid_at=now - timedelta(days=60),
        )

        revenue = get_revenue_metrics()

        # Total: 999 + 9990 + 999 = 11988
        self.assertEqual(revenue["total"], Decimal("11988.00"))

        # MTD: минимум сегодняшние 999 должны быть
        self.assertGreaterEqual(revenue["mtd"], Decimal("999.00"))

        # Last 30d: 999 + 9990 = 10989
        self.assertEqual(revenue["last_30d"], Decimal("10989.00"))
        self.assertEqual(revenue["currency"], "RUB")

    def test_legacy_plan_codes_normalization(self):
        """
        Старые коды планов (MONTHLY/YEARLY) должны нормально приводиться к monthly/yearly.
        """
        legacy_monthly, _ = SubscriptionPlan.objects.get_or_create(
            code="MONTHLY",
            defaults={"display_name": "Legacy Monthly", "price": 999, "duration_days": 30},
        )

        user_legacy = User.objects.create_user("legacy", "legacy@test.com", "password")
        now = timezone.now()

        legacy_sub = user_legacy.subscription
        legacy_sub.plan = legacy_monthly
        legacy_sub.end_date = now + timedelta(days=30)
        legacy_sub.save()

        info = get_user_subscription_info(user_legacy)
        self.assertEqual(info["plan_type"], "monthly")

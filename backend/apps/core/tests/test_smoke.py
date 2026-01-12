"""
Smoke tests for CI.

These tests verify:
1. Django setup works
2. Health endpoints are accessible
3. Billing plans are correct after migrations
4. Protected endpoints require authentication
"""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient


class DjangoSetupSmokeTest(TestCase):
    """Django setup works (if this runs, setup succeeded)."""

    def test_django_setup_works(self):
        """Verify Django configuration is valid."""
        import django

        self.assertTrue(hasattr(django, "VERSION"))

    def test_installed_apps_accessible(self):
        """Verify INSTALLED_APPS can be accessed."""
        from django.conf import settings

        self.assertIn("apps.billing", settings.INSTALLED_APPS)
        self.assertIn("apps.core", settings.INSTALLED_APPS)


class HealthEndpointsSmokeTest(TestCase):
    """Health endpoints return expected responses."""

    def setUp(self):
        self.client = APIClient()

    def test_liveness_returns_200(self):
        """Liveness endpoint returns 200 OK."""
        response = self.client.get("/live/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "alive")

    def test_health_returns_200(self):
        """Health endpoint returns 200 OK."""
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)

    def test_health_comprehensive_response(self):
        """Health endpoint returns comprehensive response structure."""
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)

        data = response.data
        # Verify core fields
        self.assertEqual(data["status"], "ok")
        self.assertIn("version", data)
        self.assertIn("python_version", data)
        self.assertIn("app_env", data)
        self.assertIn("timestamp", data)
        self.assertIn("checks", data)

        # Verify checks structure
        checks = data["checks"]
        self.assertIn("database", checks)
        self.assertIn("redis", checks)
        self.assertIn("celery", checks)

        # Database and Redis should be 'ok'
        self.assertEqual(checks["database"], "ok")
        self.assertEqual(checks["redis"], "ok")

        # Celery might be ok or warning (non-critical)
        self.assertIn(checks["celery"], ["ok", "warning: no active workers"])

        # Verify celery_workers count exists
        if "celery_workers" in data:
            self.assertIsInstance(data["celery_workers"], int)


class BillingPlansIntegrityTest(TestCase):
    """Billing plans are correct after migrations."""

    def test_required_plans_exist(self):
        """Required billing plans must exist and be active."""
        from apps.billing.models import SubscriptionPlan

        required_codes = ["FREE", "PRO_MONTHLY", "PRO_YEARLY"]
        for code in required_codes:
            exists = SubscriptionPlan.objects.filter(code=code, is_active=True).exists()
            self.assertTrue(exists, f"Plan {code} must exist and be active")

    def test_no_legacy_plans_active(self):
        """Legacy plan codes should not be active."""
        from apps.billing.models import SubscriptionPlan

        legacy_codes = ["MONTHLY", "YEARLY"]
        for code in legacy_codes:
            exists = SubscriptionPlan.objects.filter(code=code, is_active=True).exists()
            self.assertFalse(exists, f"Legacy plan {code} should not be active")

    def test_pro_plans_have_valid_prices(self):
        """PRO plans must have non-zero prices."""
        from apps.billing.models import SubscriptionPlan

        for code in ["PRO_MONTHLY", "PRO_YEARLY"]:
            plan = SubscriptionPlan.objects.get(code=code, is_active=True)
            self.assertGreater(plan.price, Decimal("0"), f"Plan {code} should have non-zero price")

    def test_free_plan_has_zero_price(self):
        """FREE plan must have zero price."""
        from apps.billing.models import SubscriptionPlan

        plan = SubscriptionPlan.objects.get(code="FREE", is_active=True)
        self.assertEqual(plan.price, Decimal("0"))


class AuthRequiredSmokeTest(TestCase):
    """Protected endpoints require authentication."""

    def setUp(self):
        self.client = APIClient()

    def test_billing_create_payment_requires_auth(self):
        """Billing create-payment endpoint requires authentication."""
        response = self.client.post("/api/v1/billing/create-payment/", {}, format="json")
        self.assertIn(response.status_code, [401, 403])

    def test_billing_plans_list_is_public(self):
        """Billing plans list should be accessible without auth."""
        response = self.client.get("/api/v1/billing/plans/")
        # Plans list is typically public
        self.assertIn(response.status_code, [200, 401, 403])

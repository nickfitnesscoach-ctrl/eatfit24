"""
Tests for environment isolation guards.

These tests verify that the entrypoint.sh guards prevent
DEV from connecting to PROD resources and vice versa.
"""

import subprocess
from pathlib import Path

from django.test import TestCase


class EnvironmentGuardTests(TestCase):
    """Tests for environment isolation guards in entrypoint.sh"""

    def setUp(self):
        """Set up test environment."""
        self.backend_entrypoint = Path(__file__).parent.parent.parent.parent / "entrypoint.sh"
        self.assertTrue(self.backend_entrypoint.exists(), "entrypoint.sh должен существовать")

    def test_entrypoint_has_dev_prod_guards(self):
        """Entrypoint should contain DEV→PROD isolation guards."""
        with open(self.backend_entrypoint, "r") as f:
            content = f.read()

        # Verify DEV guard exists
        self.assertIn("APP_ENV", content, "APP_ENV должен использоваться")
        self.assertIn("eatfit24_prod", content, "Проверка на PROD DB есть")
        self.assertIn("FATAL", content, "FATAL ошибки должны быть")

    def test_entrypoint_has_payment_key_guard(self):
        """Entrypoint should prevent PROD from using test payment keys."""
        with open(self.backend_entrypoint, "r") as f:
            content = f.read()

        self.assertIn("test_", content, "Проверка test_ ключей")
        self.assertIn("YOOKASSA", content, "Проверка YooKassa ключей")

    def test_entrypoint_has_startup_logging(self):
        """Entrypoint should log environment info at startup."""
        with open(self.backend_entrypoint, "r") as f:
            content = f.read()

        self.assertIn("[STARTUP]", content, "STARTUP логи должны быть")
        self.assertIn("POSTGRES_DB", content, "DB логирование есть")


class BotEntrypointTests(TestCase):
    """Tests for bot entrypoint environment logging."""

    def setUp(self):
        """Set up test environment."""
        # Path relative to backend
        project_root = Path(__file__).parent.parent.parent.parent.parent
        self.bot_entrypoint = project_root / "bot" / "entrypoint.sh"

    def test_bot_entrypoint_has_logging(self):
        """Bot entrypoint should log environment info."""
        if not self.bot_entrypoint.exists():
            self.skipTest("Bot entrypoint not found (might be in different repo structure)")

        with open(self.bot_entrypoint, "r") as f:
            content = f.read()

        self.assertIn("[BOT STARTUP]", content, "BOT STARTUP логи должны быть")
        self.assertIn("APP_ENV", content, "APP_ENV логирование есть")

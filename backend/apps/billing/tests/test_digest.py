"""
Tests for weekly billing digest task.

Purpose: Verify that weekly digest correctly aggregates webhook stats and formats messages.

Coverage:
    - No errors case (short success digest)
    - With errors case (full breakdown + top errors)
    - Empty period case (no events)
"""

from datetime import timedelta
from unittest.mock import patch
import uuid

from django.core.cache import cache
from django.utils import timezone
import pytest

from apps.billing.models import WebhookLog
from apps.billing.tasks_digest import (
    CACHE_KEY_HEALTH_ALERTED,
    CACHE_KEY_LAST_SUCCESS,
    _format_weekly_digest,
    _group_errors_by_signature,
    check_weekly_digest_health,
    send_weekly_billing_digest,
)


@pytest.mark.django_db
class TestWeeklyBillingDigest:
    """Test suite for weekly billing digest functionality."""

    def test_no_errors_short_digest(self):
        """
        Test case: Week without errors produces short success digest.

        Expected behavior:
            - Message contains "✅ Все billing webhooks обработаны успешно"
            - Shows total event count
            - Shows "Ошибок нет"
            - Does NOT show breakdown or top errors sections
        """
        # Create 10 successful webhook events in last 7 days
        now = timezone.now()
        for i in range(10):
            WebhookLog.objects.create(
                event_type="payment.succeeded",
                event_id=f"evt_success_{i}_{uuid.uuid4().hex[:8]}",
                status="SUCCESS",
                raw_payload={"object": {"id": f"payment_{i}"}},
                created_at=now - timedelta(days=i % 7),
                processed_at=now - timedelta(days=i % 7, hours=1),
            )

        # Build stats
        stats = {
            "total_events": 10,
            "success_count": 10,
            "failed_count": 0,
            "period_start": "2026-01-07",
            "period_end": "2026-01-14",
        }

        # Format message
        message = _format_weekly_digest(stats)

        # Verify format
        assert "📊 <b>WEEKLY BILLING DIGEST</b>" in message
        assert "2026-01-07 → 2026-01-14" in message
        assert "✅ <b>Все billing webhooks обработаны успешно</b>" in message
        assert "Всего событий: 10" in message
        assert "Ошибок нет" in message

        # Verify sections NOT present
        assert "Ошибки по типам:" not in message
        assert "Топ ошибок:" not in message

    def test_with_errors_full_breakdown(self):
        """
        Test case: Week with errors produces full digest with breakdown.

        Expected behavior:
            - Message shows general summary (total, success, failed)
            - Includes "Ошибки по типам:" section
            - Includes "Топ ошибок:" section (max 3 errors)
            - Error signatures are grouped correctly
        """
        now = timezone.now()

        # Create 15 successful events
        for i in range(15):
            WebhookLog.objects.create(
                event_type="payment.succeeded",
                event_id=f"evt_ok_{i}_{uuid.uuid4().hex[:8]}",
                status="SUCCESS",
                raw_payload={"object": {"id": f"payment_{i}"}},
                created_at=now - timedelta(days=i % 7),
                processed_at=now - timedelta(days=i % 7, hours=1),
            )

        # Create 5 failed events: payment.canceled
        for i in range(5):
            WebhookLog.objects.create(
                event_type="payment.canceled",
                event_id=f"evt_fail_canceled_{i}_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="OperationalError: FOR UPDATE cannot be applied to the nullable side of an outer join",
                raw_payload={"object": {"id": f"payment_canceled_{i}"}},
                created_at=now - timedelta(days=i % 7),
                processed_at=now - timedelta(days=i % 7, hours=1),
            )

        # Create 3 failed events: refund.succeeded
        for i in range(3):
            WebhookLog.objects.create(
                event_type="refund.succeeded",
                event_id=f"evt_fail_refund_{i}_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="Timeout: waiting for YooKassa API response",
                raw_payload={"object": {"id": f"refund_{i}"}},
                created_at=now - timedelta(days=i % 3),
                processed_at=now - timedelta(days=i % 3, hours=1),
            )

        # Query events for stats (simulate task logic)
        # Use a wide enough range to catch all test events
        start_date = now - timedelta(days=8)
        end_date = now + timedelta(hours=1)  # Add buffer for timing differences
        events_in_period = WebhookLog.objects.filter(
            created_at__gte=start_date, created_at__lte=end_date
        )
        total_events = events_in_period.count()
        success_count = events_in_period.filter(status="SUCCESS").count()
        failed_events = events_in_period.filter(status="FAILED")
        failed_count = failed_events.count()

        # Debug assertion to ensure events were created correctly
        assert (
            total_events == 23
        ), f"Expected 23 events (15 success + 5 canceled + 3 refund), got {total_events}"

        # Group by event_type
        failed_by_type_counts = {}
        for event in failed_events:
            event_type = event.event_type
            failed_by_type_counts[event_type] = failed_by_type_counts.get(event_type, 0) + 1

        # Group errors by signature
        error_signatures = _group_errors_by_signature(failed_events)
        top_errors = sorted(error_signatures.items(), key=lambda x: x[1], reverse=True)[:3]

        # Build stats
        stats = {
            "total_events": total_events,
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_by_type": failed_by_type_counts,
            "top_errors": top_errors,
            "period_start": "2026-01-07",
            "period_end": "2026-01-14",
        }

        # Format message
        message = _format_weekly_digest(stats)

        # Verify general summary
        assert "📊 <b>WEEKLY BILLING DIGEST</b>" in message
        assert "2026-01-07 → 2026-01-14" in message
        assert f"Всего webhook событий: {total_events}" in message
        assert f"Успешно обработано: {success_count}" in message
        assert f"Failed webhooks: {failed_count} ⚠️" in message

        # Verify breakdown by event_type
        assert "Ошибки по типам:" in message
        assert "payment.canceled" in message
        assert "refund.succeeded" in message

        # Verify top errors section
        assert "Топ ошибок:" in message
        assert "FOR UPDATE cannot be applied" in message
        assert "Timeout: waiting for YooKassa API" in message

        # Verify correct counts
        assert failed_by_type_counts["payment.canceled"] == 5
        assert failed_by_type_counts["refund.succeeded"] == 3
        assert (
            error_signatures[
                "OperationalError: FOR UPDATE cannot be applied to the nullable side of an outer join"
            ]
            == 5
        )
        assert error_signatures["Timeout: waiting for YooKassa API response"] == 3

    def test_empty_period_correct_message(self):
        """
        Test case: Empty period (no events) produces correct message.

        Expected behavior:
            - Message shows header
            - Shows "⚠️ Нет webhook событий за период"
            - Does NOT show any stats or breakdowns
        """
        # No events created

        # Build stats for empty period
        stats = {
            "total_events": 0,
            "success_count": 0,
            "failed_count": 0,
            "period_start": "2026-01-07",
            "period_end": "2026-01-14",
        }

        # Format message
        message = _format_weekly_digest(stats)

        # Verify format
        assert "📊 <b>WEEKLY BILLING DIGEST</b>" in message
        assert "2026-01-07 → 2026-01-14" in message
        assert "⚠️ Нет webhook событий за период" in message

        # Verify sections NOT present
        assert "Всего webhook событий:" not in message
        assert "Успешно обработано:" not in message
        assert "Ошибки по типам:" not in message
        assert "Топ ошибок:" not in message

    def test_group_errors_by_signature(self):
        """
        Test case: Error grouping correctly handles various error formats.

        Expected behavior:
            - Groups errors by first line of error message
            - Handles empty error messages
            - Handles multiline error messages
            - Truncates long lines to 100 chars
        """
        now = timezone.now()

        # Create events with different error formats
        events = [
            # Same error (should be grouped)
            WebhookLog(
                event_type="test.event",
                event_id=f"evt_1_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="DatabaseError: connection lost\nLine 2",
                created_at=now,
            ),
            WebhookLog(
                event_type="test.event",
                event_id=f"evt_2_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="DatabaseError: connection lost\nDifferent line 2",
                created_at=now,
            ),
            # Different error
            WebhookLog(
                event_type="test.event",
                event_id=f"evt_3_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="TimeoutError: API not responding",
                created_at=now,
            ),
            # Empty error message
            WebhookLog(
                event_type="test.event",
                event_id=f"evt_4_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="",
                created_at=now,
            ),
            # No error message
            WebhookLog(
                event_type="test.event",
                event_id=f"evt_5_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message=None,
                created_at=now,
            ),
        ]

        # Group errors
        result = _group_errors_by_signature(events)

        # Verify grouping
        assert result["DatabaseError: connection lost"] == 2
        assert result["TimeoutError: API not responding"] == 1
        # Both empty and None should be grouped as "(no error message)"
        assert result["(no error message)"] == 2

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_send_weekly_billing_digest_task(self, mock_send_alert):
        """
        Test case: Full task execution with mocked Telegram sending.

        Expected behavior:
            - Task queries WebhookLog for last 7 days
            - Aggregates stats correctly
            - Formats message
            - Sends to Telegram
            - Returns success status
        """
        mock_send_alert.return_value = {
            "success": True,
            "deliveries": [{"chat_id": 123, "message_id": 456, "parse_mode": "HTML"}],
            "errors": [],
        }

        now = timezone.now()

        # Create mix of events
        for i in range(5):
            WebhookLog.objects.create(
                event_type="payment.succeeded",
                event_id=f"evt_ok_{i}_{uuid.uuid4().hex[:8]}",
                status="SUCCESS",
                raw_payload={"object": {"id": f"payment_{i}"}},
                created_at=now - timedelta(days=i),
                processed_at=now - timedelta(days=i, hours=1),
            )

        for i in range(2):
            WebhookLog.objects.create(
                event_type="payment.canceled",
                event_id=f"evt_fail_{i}_{uuid.uuid4().hex[:8]}",
                status="FAILED",
                error_message="Test error",
                raw_payload={"object": {"id": f"payment_{i}"}},
                created_at=now - timedelta(days=i),
                processed_at=now - timedelta(days=i, hours=1),
            )

        # Run task
        result = send_weekly_billing_digest()

        # Verify task result
        assert result["success"] is True
        assert result["total_events"] == 7
        assert result["failed_count"] == 2

        # Verify Telegram alert was called
        mock_send_alert.assert_called_once()
        message = mock_send_alert.call_args[0][0]

        # Verify message content
        assert "📊 <b>WEEKLY BILLING DIGEST</b>" in message
        assert "Всего webhook событий: 7" in message
        assert "Failed webhooks: 2 ⚠️" in message

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_send_weekly_billing_digest_task_no_events(self, mock_send_alert):
        """
        Test case: Task execution with no events in period.

        Expected behavior:
            - Task handles empty period gracefully
            - Sends message with "no events" notice
            - Returns success status
        """
        mock_send_alert.return_value = {
            "success": True,
            "deliveries": [{"chat_id": 123, "message_id": 456, "parse_mode": "HTML"}],
            "errors": [],
        }

        # No events created

        # Run task
        result = send_weekly_billing_digest()

        # Verify task result
        assert result["success"] is True
        assert result["total_events"] == 0
        assert result["failed_count"] == 0

        # Verify Telegram alert was called
        mock_send_alert.assert_called_once()
        message = mock_send_alert.call_args[0][0]

        # Verify message content
        assert "📊 <b>WEEKLY BILLING DIGEST</b>" in message
        assert "⚠️ Нет webhook событий за период" in message

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_send_weekly_billing_digest_task_telegram_failure(self, mock_send_alert):
        """
        Test case: Task handles Telegram sending failure gracefully.

        Expected behavior:
            - Task completes even if Telegram fails
            - Returns success=False
            - Does NOT raise exception (safety requirement)
        """
        mock_send_alert.return_value = {
            "success": False,
            "deliveries": [],
            "errors": [{"chat_id": 123, "error": "Telegram API timeout"}],
        }

        now = timezone.now()
        WebhookLog.objects.create(
            event_type="payment.succeeded",
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            status="SUCCESS",
            raw_payload={},
            created_at=now,
            processed_at=now,
        )

        # Run task (should not raise exception)
        result = send_weekly_billing_digest()

        # Verify task result
        assert result["success"] is False
        assert result["total_events"] == 1

        # Verify Telegram alert was attempted
        mock_send_alert.assert_called_once()


@pytest.mark.django_db
class TestWeeklyDigestHealthCheck:
    """Test suite for weekly digest health check functionality."""

    def setup_method(self):
        """Clear cache before each test."""
        cache.clear()

    def test_no_baseline_fresh_deployment(self):
        """
        Test case: Health check on fresh deployment (no last_success timestamp).

        Expected behavior:
            - Returns status="no_baseline"
            - Logs warning (not error)
            - Does NOT send alert
        """
        # No last_success timestamp in cache

        # Run health check
        result = check_weekly_digest_health()

        # Verify result
        assert result["status"] == "no_baseline"
        assert "fresh deployment" in result["message"].lower()

    def test_healthy_state_recent_success(self):
        """
        Test case: Health check with recent successful digest (3 days ago).

        Expected behavior:
            - Returns status="healthy"
            - Includes days_since and last_success timestamp
            - Does NOT send alert
        """
        # Set last_success to 3 days ago
        last_success = timezone.now() - timedelta(days=3)
        cache.set(CACHE_KEY_LAST_SUCCESS, last_success.isoformat(), timeout=None)

        # Run health check
        result = check_weekly_digest_health()

        # Verify result
        assert result["status"] == "healthy"
        assert result["days_since"] == 3
        assert result["last_success"] == last_success.isoformat()

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_degradation_detected_sends_alert(self, mock_send_alert):
        """
        Test case: Health check detects degradation (9 days without success).

        Expected behavior:
            - Returns status="degradation_detected"
            - Sends Telegram alert with degradation details
            - Sets anti-spam cache flag
            - Returns alerted=True
        """
        mock_send_alert.return_value = {
            "success": True,
            "deliveries": [{"chat_id": 123, "message_id": 456, "parse_mode": "HTML"}],
            "errors": [],
        }

        # Set last_success to 9 days ago (triggers >8 days threshold)
        last_success = timezone.now() - timedelta(days=9)
        cache.set(CACHE_KEY_LAST_SUCCESS, last_success.isoformat(), timeout=None)

        # Run health check
        result = check_weekly_digest_health()

        # Verify result
        assert result["status"] == "degradation_detected"
        assert result["days_since"] == 9
        assert result["alerted"] is True
        assert len(result["deliveries"]) == 1

        # Verify alert was sent
        mock_send_alert.assert_called_once()
        message = mock_send_alert.call_args[0][0]
        assert "WEEKLY DIGEST DEGRADATION" in message
        assert "9 дней назад" in message
        assert "Celery Beat schedule" in message

        # Verify anti-spam flag was set
        assert cache.get(CACHE_KEY_HEALTH_ALERTED) is True

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_degradation_anti_spam_prevents_duplicate_alert(self, mock_send_alert):
        """
        Test case: Anti-spam prevents duplicate alerts within 24h.

        Expected behavior:
            - First check: sends alert and sets anti-spam flag
            - Second check (within 24h): does NOT send alert
            - Returns alerted=False with reason="anti-spam"
        """
        mock_send_alert.return_value = {
            "success": True,
            "deliveries": [{"chat_id": 123, "message_id": 456, "parse_mode": "HTML"}],
            "errors": [],
        }

        # Set last_success to 9 days ago
        last_success = timezone.now() - timedelta(days=9)
        cache.set(CACHE_KEY_LAST_SUCCESS, last_success.isoformat(), timeout=None)

        # First health check - should send alert
        result1 = check_weekly_digest_health()
        assert result1["alerted"] is True
        assert mock_send_alert.call_count == 1

        # Second health check (within 24h) - should NOT send alert
        result2 = check_weekly_digest_health()
        assert result2["status"] == "degradation_detected"
        assert result2["days_since"] == 9
        assert result2["alerted"] is False
        assert "anti-spam" in result2["reason"]

        # Verify alert was NOT sent again
        assert mock_send_alert.call_count == 1  # Still only 1 call

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_degradation_alert_delivery_failure(self, mock_send_alert):
        """
        Test case: Health check handles Telegram delivery failure gracefully.

        Expected behavior:
            - Detects degradation
            - Attempts to send alert
            - Alert delivery fails
            - Returns alerted=False with reason="alert delivery failed"
            - Includes error details
            - Does NOT raise exception
        """
        mock_send_alert.return_value = {
            "success": False,
            "deliveries": [],
            "errors": [{"chat_id": 123, "error": "HTTP 500: Internal Server Error"}],
        }

        # Set last_success to 9 days ago
        last_success = timezone.now() - timedelta(days=9)
        cache.set(CACHE_KEY_LAST_SUCCESS, last_success.isoformat(), timeout=None)

        # Run health check (should not raise exception)
        result = check_weekly_digest_health()

        # Verify result
        assert result["status"] == "degradation_detected"
        assert result["days_since"] == 9
        assert result["alerted"] is False
        assert result["reason"] == "alert delivery failed"
        assert len(result["errors"]) == 1
        assert "HTTP 500" in result["errors"][0]["error"]

        # Verify alert was attempted
        mock_send_alert.assert_called_once()

    def test_threshold_boundary_8_days_no_alert(self):
        """
        Test case: Exactly 8 days since last success (boundary case).

        Expected behavior:
            - 8 days is NOT > 8 days threshold
            - Returns status="healthy"
            - Does NOT send alert
        """
        # Set last_success to exactly 8 days ago
        last_success = timezone.now() - timedelta(days=8)
        cache.set(CACHE_KEY_LAST_SUCCESS, last_success.isoformat(), timeout=None)

        # Run health check
        result = check_weekly_digest_health()

        # Verify result - 8 days is still healthy (threshold is >8)
        assert result["status"] == "healthy"
        assert result["days_since"] == 8

    @patch("apps.billing.tasks_digest._send_telegram_alert")
    def test_threshold_boundary_9_days_triggers_alert(self, mock_send_alert):
        """
        Test case: Exactly 9 days since last success (just over threshold).

        Expected behavior:
            - 9 days IS > 8 days threshold
            - Returns status="degradation_detected"
            - Sends alert
        """
        mock_send_alert.return_value = {
            "success": True,
            "deliveries": [{"chat_id": 123, "message_id": 456, "parse_mode": "HTML"}],
            "errors": [],
        }

        # Set last_success to exactly 9 days ago
        last_success = timezone.now() - timedelta(days=9)
        cache.set(CACHE_KEY_LAST_SUCCESS, last_success.isoformat(), timeout=None)

        # Run health check
        result = check_weekly_digest_health()

        # Verify result
        assert result["status"] == "degradation_detected"
        assert result["days_since"] == 9
        assert result["alerted"] is True

        # Verify alert was sent
        mock_send_alert.assert_called_once()

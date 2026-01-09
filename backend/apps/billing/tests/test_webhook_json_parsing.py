"""
Unit-тесты для безопасного парсинга JSON в webhook endpoint.

Проверяет обработку различных edge cases:
- Валидный JSON
- JSON с BOM (Byte Order Mark)
- Пустое body
- Невалидный JSON
- Не-UTF-8 encoding
- Non-JSON content (plain text)
"""

import json
from unittest.mock import Mock

from django.test import TestCase
from django.http import HttpRequest

from apps.billing.webhooks.views import _parse_webhook_body


class WebhookJSONParsingTestCase(TestCase):
    """Тесты для _parse_webhook_body()"""

    def _make_request(self, body: bytes, content_type: str = "application/json") -> HttpRequest:
        """Helper: создать mock request с заданным body"""
        request = Mock(spec=HttpRequest)
        request.body = body
        request.META = {"CONTENT_TYPE": content_type}
        return request

    def test_valid_json(self):
        """Валидный JSON должен парситься успешно"""
        body = b'{"event": "payment.succeeded", "object": {"id": "test123"}}'
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(error)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["event"], "payment.succeeded")
        self.assertEqual(payload["object"]["id"], "test123")

    def test_json_with_bom(self):
        """JSON с BOM (UTF-8-SIG) должен парситься корректно"""
        # BOM: EF BB BF в начале файла
        bom = b"\xef\xbb\xbf"
        json_data = b'{"event": "payment.succeeded"}'
        body = bom + json_data

        request = self._make_request(body)
        payload, error = _parse_webhook_body(request)

        self.assertIsNone(error)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["event"], "payment.succeeded")

    def test_empty_body(self):
        """Пустое body должно возвращать EMPTY_BODY ошибку"""
        request = self._make_request(b"")

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(payload)
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 400)
        response_data = json.loads(error.content)
        self.assertEqual(response_data["error"], "EMPTY_BODY")

    def test_invalid_json(self):
        """Невалидный JSON должен возвращать INVALID_JSON ошибку"""
        body = b'{"event": "payment.succeeded", invalid json here}'
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(payload)
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 400)
        response_data = json.loads(error.content)
        self.assertEqual(response_data["error"], "INVALID_JSON")
        self.assertIn("line", response_data)
        self.assertIn("column", response_data)

    def test_non_json_plain_text(self):
        """Plain text (не JSON) должен возвращать INVALID_JSON"""
        body = b"OK"
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(payload)
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 400)
        response_data = json.loads(error.content)
        self.assertEqual(response_data["error"], "INVALID_JSON")

    def test_bad_encoding(self):
        """Некорректная кодировка (не UTF-8) должна возвращать BAD_ENCODING"""
        # Latin-1 encoded текст (не UTF-8)
        body = b"\xe9\xe8\xe7"  # Невалидный UTF-8
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(payload)
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 400)
        response_data = json.loads(error.content)
        self.assertEqual(response_data["error"], "BAD_ENCODING")

    def test_json_array_not_object(self):
        """JSON array (не object) должен возвращать NOT_OBJECT"""
        body = b'["item1", "item2"]'
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(payload)
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 400)
        response_data = json.loads(error.content)
        self.assertEqual(response_data["error"], "NOT_OBJECT")

    def test_json_number_not_object(self):
        """JSON number (не object) должен возвращать NOT_OBJECT"""
        body = b"12345"
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(payload)
        self.assertIsNotNone(error)
        response_data = json.loads(error.content)
        self.assertEqual(response_data["error"], "NOT_OBJECT")

    def test_unexpected_content_type(self):
        """Неожиданный Content-Type должен логироваться warning, но не блокировать"""
        body = b'{"event": "test"}'
        request = self._make_request(body, content_type="text/plain")

        payload, error = _parse_webhook_body(request)

        # Всё равно парсится, просто warning в логе
        self.assertIsNone(error)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["event"], "test")

    def test_large_json(self):
        """Большой JSON должен парситься корректно"""
        large_payload = {
            "event": "payment.succeeded",
            "object": {
                "id": "test123",
                "metadata": {"key" + str(i): "value" + str(i) for i in range(1000)},
            },
        }
        body = json.dumps(large_payload).encode("utf-8")
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(error)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["event"], "payment.succeeded")
        self.assertEqual(len(payload["object"]["metadata"]), 1000)

    def test_unicode_characters(self):
        """JSON с Unicode символами должен парситься корректно"""
        body = '{"event": "тест", "emoji": "🎉", "chinese": "测试"}'.encode("utf-8")
        request = self._make_request(body)

        payload, error = _parse_webhook_body(request)

        self.assertIsNone(error)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["event"], "тест")
        self.assertEqual(payload["emoji"], "🎉")
        self.assertEqual(payload["chinese"], "测试")

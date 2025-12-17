"""
Webhook endpoint для YooKassa.

Задачи этого файла:
- принять webhook-запрос от YooKassa
- проверить, что запрос пришёл с разрешённого IP
- распарсить событие
- обеспечить ИДЕМПОТЕНТНОСТЬ (одно событие = одна обработка)
- передать событие в handlers
- всегда быстро отвечать 200 OK (если запрос валиден)

ВАЖНО:
- здесь НЕТ бизнес-логики
- здесь НЕТ работы с подписками напрямую
- этот файл — "контроллер + firewall"

БЕЗОПАСНОСТЬ (2024-12):
- Rate limiting: 100 req/hour per IP (WebhookThrottle)
- IP Allowlist: только IP-адреса YooKassa (см. utils.py)
- XFF Spoofing Protection: по умолчанию НЕ доверяем X-Forwarded-For
  (см. WEBHOOK_TRUST_XFF в settings)
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict

from django.conf import settings
from django.db import transaction
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny

from apps.billing.models import WebhookLog
from apps.billing.throttles import WebhookThrottle

from .handlers import handle_yookassa_event
from .utils import is_ip_allowed

logger = logging.getLogger(__name__)


def _parse_webhook_body(request: HttpRequest) -> tuple[Dict[str, Any] | None, JsonResponse | None]:
    """
    Безопасный парсинг webhook body с подробным логированием.

    Returns:
        (payload, error_response)
        - Если успешно: (parsed_dict, None)
        - Если ошибка: (None, JsonResponse с 400)

    Обрабатывает:
    - Пустое body
    - BOM (UTF-8-SIG)
    - Некорректная кодировка
    - Невалидный JSON
    - Неподдерживаемый Content-Type
    """
    # Метаданные запроса для безопасного логирования
    content_type = request.META.get("CONTENT_TYPE", "")
    content_length = len(request.body)

    # SHA256 хеш для идентификации дубликатов (без раскрытия содержимого)
    body_hash = hashlib.sha256(request.body).hexdigest()[:16]

    logger.info(
        f"[WEBHOOK_BODY] "
        f"Content-Type={content_type}, "
        f"Length={content_length}, "
        f"SHA256={body_hash}"
    )

    # 1. Проверка: пустое body
    if content_length == 0:
        logger.error("[WEBHOOK_ERROR] EMPTY_BODY: Request body is empty")
        return None, JsonResponse(
            {"error": "EMPTY_BODY", "message": "Request body cannot be empty"},
            status=400
        )

    # 2. Проверка Content-Type (опционально, но рекомендуется)
    if content_type and "application/json" not in content_type.lower():
        logger.warning(
            f"[WEBHOOK_WARNING] Unexpected Content-Type: {content_type}. "
            f"Expected application/json"
        )

    # 3. Декодирование с поддержкой BOM (utf-8-sig)
    try:
        # utf-8-sig автоматически удаляет BOM (Byte Order Mark) если он есть
        body_str = request.body.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        logger.error(
            f"[WEBHOOK_ERROR] BAD_ENCODING: Failed to decode body as UTF-8: {e}. "
            f"Length={content_length}, Hash={body_hash}"
        )
        return None, JsonResponse(
            {"error": "BAD_ENCODING", "message": "Body must be valid UTF-8"},
            status=400
        )

    # 4. Логирование snippet (первые 200 символов) для debugging
    snippet = body_str[:200]
    if len(body_str) > 200:
        snippet += "..."
    logger.debug(f"[WEBHOOK_SNIPPET] {snippet}")

    # 5. Парсинг JSON
    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError as e:
        logger.error(
            f"[WEBHOOK_ERROR] INVALID_JSON: {e}. "
            f"Line={e.lineno}, Column={e.colno}, "
            f"Length={content_length}, Hash={body_hash}, "
            f"Snippet={snippet[:100]}"
        )
        return None, JsonResponse(
            {
                "error": "INVALID_JSON",
                "message": f"Invalid JSON: {e.msg}",
                "line": e.lineno,
                "column": e.colno
            },
            status=400
        )

    # 6. Проверка что результат - dictionary
    if not isinstance(payload, dict):
        logger.error(
            f"[WEBHOOK_ERROR] NOT_OBJECT: Parsed JSON is not an object. "
            f"Type={type(payload).__name__}, Hash={body_hash}"
        )
        return None, JsonResponse(
            {
                "error": "NOT_OBJECT",
                "message": f"Expected JSON object, got {type(payload).__name__}"
            },
            status=400
        )

    logger.info(f"[WEBHOOK_PARSED] Successfully parsed payload with {len(payload)} keys")
    return payload, None


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])  # Webhook публичный, но защищён IP allowlist
@throttle_classes([WebhookThrottle])  # [SECURITY] Rate limit: 100 req/hour per IP
def yookassa_webhook(request):
    """
    Единственная точка входа для webhook YooKassa.

    URL:
        POST /api/v1/billing/webhooks/yookassa

    Поведение:
    - если IP не разрешён → 403
    - если payload невалиден → 400
    - если событие уже обработано → 200 (идемпотентность)
    - если всё ок → передаём в handlers → 200

    Безопасность:
    - Rate limit: 100/hour (WebhookThrottle)
    - IP allowlist (YooKassa IPs only)
    - XFF доверяется ТОЛЬКО если WEBHOOK_TRUST_XFF=True в settings
    """

    client_ip = _get_client_ip_secure(request)

    # 1️⃣ Проверка IP (базовая защита)
    if not is_ip_allowed(client_ip):
        logger.warning(
            f"[WEBHOOK_BLOCKED] IP={client_ip} не в allowlist YooKassa. "
            f"Path={request.path}"
        )
        return JsonResponse(
            {"error": "forbidden"},
            status=403
        )

    # 2️⃣ Парсинг JSON (безопасный парсер с детальными ошибками)
    payload, error_response = _parse_webhook_body(request)
    if error_response is not None:
        return error_response

    event_type = payload.get("event")
    event_object = payload.get("object", {})
    event_id = event_object.get("id")  # payment_id или refund_id

    if not event_type or not event_id:
        logger.error(f"Malformed webhook payload: {payload}")
        return JsonResponse(
            {"error": "invalid_payload"},
            status=400
        )

    # 3️⃣ Идемпотентность по event_id
    # Один webhook от YooKassa = один WebhookLog
    with transaction.atomic():
        webhook_log, created = WebhookLog.objects.select_for_update().get_or_create(
            event_id=event_id,
            defaults={
                "event_type": event_type,
                "payment_id": _extract_payment_id(payload),
                "status": "RECEIVED",
                "raw_payload": payload,
                "client_ip": client_ip,
            }
        )

        if not created:
            # webhook уже был получен ранее
            logger.info(
                f"Duplicate YooKassa webhook ignored: event_id={event_id}, status={webhook_log.status}"
            )
            webhook_log.status = "DUPLICATE"
            webhook_log.processed_at = timezone.now()
            webhook_log.save(update_fields=["status", "processed_at"])
            return JsonResponse({"status": "ok"})  # ВСЕГДА 200 для YooKassa

        # помечаем, что начали обработку
        webhook_log.status = "PROCESSING"
        webhook_log.attempts += 1
        webhook_log.save(update_fields=["status", "attempts"])

    # 4️⃣ Передаём событие в бизнес-обработчик
    try:
        handle_yookassa_event(event_type=event_type, payload=payload)

        # если всё прошло успешно
        webhook_log.status = "SUCCESS"
        webhook_log.processed_at = timezone.now()
        webhook_log.save(update_fields=["status", "processed_at"])

    except Exception as e:
        # ошибка обработки — webhook считается FAILED,
        # но YooKassa всё равно получит 200 (иначе будет ретраить)
        logger.error(
            f"Webhook processing error for event_id={event_id}: {str(e)}",
            exc_info=True
        )
        webhook_log.status = "FAILED"
        webhook_log.error_message = str(e)
        webhook_log.processed_at = timezone.now()
        webhook_log.save(update_fields=["status", "error_message", "processed_at"])

    # 5️⃣ Ответ YooKassa
    # ВАЖНО: всегда 200, если IP и JSON валидны
    return JsonResponse({"status": "ok"})


# ---------------------------------------------------------------------
# helpers (локальные, не бизнес-логика)
# ---------------------------------------------------------------------

def _is_trusted_proxy(ip: str) -> bool:
    """
    Проверяет, является ли IP адрес доверенным прокси (nginx, docker gateway).

    Поддерживает:
    - Одиночные IP: "127.0.0.1"
    - CIDR подсети: "172.23.0.0/16"
    """
    import ipaddress

    trusted_proxies = getattr(settings, "WEBHOOK_TRUSTED_PROXIES", ["127.0.0.1"])

    try:
        ip_obj = ipaddress.ip_address(ip)
        for proxy in trusted_proxies:
            try:
                # Проверяем CIDR подсеть
                if "/" in proxy:
                    network = ipaddress.ip_network(proxy, strict=False)
                    if ip_obj in network:
                        return True
                # Проверяем точное совпадение IP
                elif ip == proxy:
                    return True
            except ValueError:
                logger.warning(f"[WEBHOOK_SECURITY] Invalid proxy IP/CIDR: {proxy}")
                continue
    except ValueError:
        logger.warning(f"[WEBHOOK_SECURITY] Invalid IP address: {ip}")
        return False

    return False


def _get_client_ip_secure(request: HttpRequest) -> str | None:
    """
    Безопасное извлечение IP клиента.

    [SECURITY FIX 2024-12-17]:
    По умолчанию НЕ доверяем X-Forwarded-For, так как его можно подделать.
    Используем XFF только если:
    - settings.WEBHOOK_TRUST_XFF == True (явно включено)
    - И REMOTE_ADDR принадлежит доверенным прокси (settings.WEBHOOK_TRUSTED_PROXIES)

    Если WEBHOOK_TRUST_XFF=False (default) → используем только REMOTE_ADDR.
    """
    remote_addr = request.META.get("REMOTE_ADDR", "")
    trust_xff = getattr(settings, "WEBHOOK_TRUST_XFF", False)

    if trust_xff:
        # Проверяем, что запрос пришёл от доверенного прокси
        if not _is_trusted_proxy(remote_addr):
            logger.warning(
                f"[WEBHOOK_SECURITY] X-Forwarded-For ignored: REMOTE_ADDR={remote_addr} "
                f"not in trusted proxies list"
            )
        else:
            # Доверенный прокси: берём первый IP из XFF
            xff = request.META.get("HTTP_X_FORWARDED_FOR")
            if xff:
                real_ip = xff.split(",")[0].strip()
                logger.info(
                    f"[WEBHOOK] Using X-Forwarded-For IP: {real_ip} "
                    f"(from trusted proxy {remote_addr})"
                )
                return real_ip

    # По умолчанию или если XFF отсутствует: используем REMOTE_ADDR
    # Логируем, если XFF присутствует, но мы его игнорируем
    if not trust_xff and request.META.get("HTTP_X_FORWARDED_FOR"):
        logger.warning(
            f"[WEBHOOK_SECURITY] X-Forwarded-For present but ignored "
            f"(WEBHOOK_TRUST_XFF=False). Using REMOTE_ADDR={remote_addr}"
        )

    return remote_addr


def _extract_payment_id(payload: Dict[str, Any]) -> str | None:
    """
    Извлекает payment_id из payload, если он есть.
    Нужно для удобной фильтрации логов.
    """
    obj = payload.get("object", {})
    if obj.get("object") == "payment":
        return obj.get("id")
    if obj.get("object") == "refund":
        return obj.get("payment_id")
    return None


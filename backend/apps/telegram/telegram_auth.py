"""
apps/telegram/telegram_auth.py

Единая защита Telegram Admin доступа (панель тренера / dj-admin).

Важно:
- Единственный источник истины для проверки initData — WebAppAuthService.
- Никаких debug-bypass в production.
- Никаких логов request.headers / initData.
"""

from __future__ import annotations

from functools import wraps
import logging
from typing import Optional, Set

from django.conf import settings
from django.http import HttpResponseForbidden
from django.utils.deprecation import MiddlewareMixin

from apps.telegram.auth.services.webapp_auth import get_webapp_auth_service

logger = logging.getLogger(__name__)

DEFAULT_MAX_INIT_DATA_LEN = 8192
MAX_INIT_DATA_LEN: int = int(
    getattr(settings, "TELEGRAM_INIT_DATA_MAX_LEN", DEFAULT_MAX_INIT_DATA_LEN)
)

_REQ_CACHE_FLAG = "_tg_admin_checked"
_REQ_CACHE_ALLOWED = "_tg_admin_allowed"


def _forbidden() -> HttpResponseForbidden:
    return HttpResponseForbidden("Нет доступа")


def _get_init_data_from_request(request) -> Optional[str]:
    raw = request.headers.get("X-Telegram-Init-Data") or request.META.get(
        "HTTP_X_TELEGRAM_INIT_DATA"
    )
    if not raw:
        return None
    if len(raw) > MAX_INIT_DATA_LEN:
        logger.warning("X-Telegram-Init-Data too long (rejected). len=%s", len(raw))
        return None
    return raw


def _parse_telegram_admins() -> Set[int]:
    # В идеале TELEGRAM_ADMINS уже list[int] (в base.py мы так и сделали).
    raw = getattr(settings, "TELEGRAM_ADMINS", [])
    admins: Set[int] = set()
    if not raw:
        return admins
    if isinstance(raw, (list, tuple, set)):
        items = raw
    else:
        items = [raw]
    for item in items:
        try:
            admins.add(int(item))
        except (TypeError, ValueError):
            logger.warning("Invalid TELEGRAM_ADMINS item: %r", item)
    return admins


def _is_debug_bypass_allowed(request) -> bool:
    """
    Debug bypass разрешаем ТОЛЬКО в DEV и только при DEBUG=True.

    Никаких логов headers целиком.
    """
    if not getattr(settings, "DEBUG", False):
        return False
    if getattr(settings, "APP_ENV", "") != "dev":
        return False
    if not bool(getattr(settings, "WEBAPP_DEBUG_MODE_ENABLED", False)):
        return False

    return (request.headers.get("X-Debug-Mode") == "true") or (
        request.META.get("HTTP_X_DEBUG_MODE") == "true"
    )


def _get_debug_user_id(request) -> int:
    """
    Debug user id берём из X-Debug-User-Id.
    Это dev-only.
    """
    raw = (
        request.headers.get("X-Debug-User-Id")
        or request.META.get("HTTP_X_DEBUG_USER_ID")
        or "999999999"
    )
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 999999999


def _is_telegram_admin(request) -> bool:
    if getattr(request, _REQ_CACHE_FLAG, False):
        return bool(getattr(request, _REQ_CACHE_ALLOWED, False))
    setattr(request, _REQ_CACHE_FLAG, True)

    admins = _parse_telegram_admins()

    # DEV debug bypass
    if _is_debug_bypass_allowed(request):
        debug_id = _get_debug_user_id(request)
        allowed = debug_id in admins
        setattr(request, _REQ_CACHE_ALLOWED, allowed)
        if allowed:
            request.telegram_init_data = {"user": {"id": debug_id}, "auth_date": 0}
            request.telegram_user_id = debug_id
        return allowed

    raw_init_data = _get_init_data_from_request(request)
    if not raw_init_data:
        setattr(request, _REQ_CACHE_ALLOWED, False)
        return False

    # Для админки TTL лучше делать короче (уменьшает replay-риск)
    admin_ttl = int(getattr(settings, "TELEGRAM_ADMIN_INITDATA_MAX_AGE", 60 * 30))  # 30 минут

    auth_service = get_webapp_auth_service()
    parsed = auth_service.validate_init_data(raw_init_data, max_age_seconds=admin_ttl)
    if not parsed:
        setattr(request, _REQ_CACHE_ALLOWED, False)
        return False

    user_id = auth_service.get_user_id_from_init_data(parsed)
    allowed = bool(user_id is not None and user_id in admins)

    setattr(request, _REQ_CACHE_ALLOWED, allowed)
    if allowed:
        request.telegram_init_data = parsed
        request.telegram_user_id = user_id

    return allowed


def telegram_admin_required(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not _is_telegram_admin(request):
            return _forbidden()
        return view_func(request, *args, **kwargs)

    return _wrapped


class TelegramAdminOnlyMiddleware(MiddlewareMixin):
    """
    Защищает /dj-admin/*
    - Django staff/superuser по сессии проходят
    - остальные — только Telegram admin через initData
    """

    protected_prefixes = ("/dj-admin", "/dj-admin/")

    def process_request(self, request):
        path = request.path or "/"

        if path.rstrip("/") == "/dj-admin/login":
            return None

        if path.startswith(self.protected_prefixes):
            user = getattr(request, "user", None)
            if user and user.is_authenticated and (user.is_staff or user.is_superuser):
                return None

            if not _is_telegram_admin(request):
                return _forbidden()

        return None


try:
    from rest_framework.permissions import BasePermission
except Exception:
    BasePermission = object


class TelegramAdminPermission(BasePermission):
    message = "Нет доступа"

    def has_permission(self, request, view):
        return _is_telegram_admin(request)

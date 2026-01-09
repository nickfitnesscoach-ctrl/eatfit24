"""
DRF authentication backends для Telegram WebApp.

Три режима:
1) TelegramWebAppAuthentication — основной, безопасный (подпись initData)
2) DebugModeAuthentication — ТОЛЬКО DEV (без Telegram)
3) TelegramHeaderAuthentication — опционально, по умолчанию выключено (опасно)
"""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Any, Dict, Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import authentication, exceptions

from apps.telegram.auth.services.webapp_auth import get_webapp_auth_service
from apps.telegram.models import TelegramUser
from apps.users.models import Profile

User = get_user_model()
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TelegramIdentity:
    telegram_id: int
    username: str = ""
    first_name: str = ""
    last_name: str = ""
    language_code: str = "ru"
    is_premium: bool = False


def _get_header(request, name: str) -> str:
    meta_key = "HTTP_" + name.upper().replace("-", "_")
    return (request.META.get(meta_key) or request.headers.get(name) or "").strip()


def _parse_int(value: str, field_name: str) -> int:
    try:
        x = int(value)
    except (ValueError, TypeError):
        raise exceptions.AuthenticationFailed(f"Invalid {field_name}")
    if x <= 0:
        raise exceptions.AuthenticationFailed(f"Invalid {field_name}")
    return x


def _is_dev_debug_allowed() -> bool:
    # Debug auth должен работать ТОЛЬКО в DEV.
    if not getattr(settings, "DEBUG", False):
        return False
    if getattr(settings, "APP_ENV", "") != "dev":
        return False
    return bool(getattr(settings, "WEBAPP_DEBUG_MODE_ENABLED", False))


def _ensure_user_and_profiles(identity: TelegramIdentity) -> User:
    """
    Создание/обновление связок:
    - Django User (основной пользователь)
    - TelegramUser (telegram_id -> user)
    - Profile (обязателен)

    Важно: устойчивость к гонкам:
    - если TelegramUser уже есть, он является SSOT и определяет user.
    """
    telegram_id = int(identity.telegram_id)
    django_username = f"tg_{telegram_id}"

    with transaction.atomic():
        tg = TelegramUser.objects.select_related("user").filter(telegram_id=telegram_id).first()
        if tg:
            user = tg.user
        else:
            user, _ = User.objects.get_or_create(
                username=django_username,
                defaults={
                    "email": f"tg{telegram_id}@telegram.user",
                    "first_name": (identity.first_name or "")[:150],
                    "last_name": (identity.last_name or "")[:150],
                },
            )
            # пароль не нужен
            try:
                user.set_unusable_password()
                user.save(update_fields=["password"])
            except Exception:
                pass

            try:
                tg = TelegramUser.objects.create(
                    telegram_id=telegram_id,
                    user=user,
                    username=identity.username or "",
                    first_name=identity.first_name or "",
                    last_name=identity.last_name or "",
                    language_code=identity.language_code or "ru",
                    is_premium=bool(identity.is_premium),
                )
                logger.info("[Auth] Created TelegramUser telegram_id=%s", telegram_id)
            except IntegrityError:
                # Гонка: кто-то создал TelegramUser раньше
                tg = TelegramUser.objects.select_related("user").get(telegram_id=telegram_id)
                user = tg.user

        # Обновление данных при каждом логине — нормально
        changed = False
        if tg.username != (identity.username or ""):
            tg.username = identity.username or ""
            changed = True
        if tg.first_name != (identity.first_name or ""):
            tg.first_name = identity.first_name or ""
            changed = True
        if tg.last_name != (identity.last_name or ""):
            tg.last_name = identity.last_name or ""
            changed = True
        if tg.language_code != (identity.language_code or "ru"):
            tg.language_code = identity.language_code or "ru"
            changed = True
        if tg.is_premium != bool(identity.is_premium):
            tg.is_premium = bool(identity.is_premium)
            changed = True

        if changed:
            tg.save(
                update_fields=["username", "first_name", "last_name", "language_code", "is_premium"]
            )

        Profile.objects.get_or_create(user=user)

    return user


class DebugModeAuthentication(authentication.BaseAuthentication):
    """
    DEV-only auth: для разработки фронта без Telegram.

    Включение:
    - DEBUG=True
    - APP_ENV=dev
    - WEBAPP_DEBUG_MODE_ENABLED=True
    - header: X-Debug-Mode: true

    Важно:
    - не логируем заголовки целиком
    """

    DEFAULT_DEBUG_USER_ID = 999999999

    def authenticate(self, request) -> Optional[Tuple[User, Dict[str, Any]]]:
        if _get_header(request, "X-Debug-Mode").lower() != "true":
            return None

        if not _is_dev_debug_allowed():
            raise exceptions.AuthenticationFailed("Debug mode is disabled")

        raw_id = _get_header(request, "X-Debug-User-Id") or str(self.DEFAULT_DEBUG_USER_ID)
        telegram_id = _parse_int(raw_id, "debug_user_id")

        identity = TelegramIdentity(
            telegram_id=telegram_id,
            first_name=_get_header(request, "X-Telegram-First-Name") or "Debug",
            last_name=_get_header(request, "X-Telegram-Last-Name") or "User",
            username=_get_header(request, "X-Telegram-Username") or "eatfit24_debug",
            language_code=_get_header(request, "X-Telegram-Language-Code") or "ru",
            is_premium=False,
        )

        user = _ensure_user_and_profiles(identity)
        logger.warning("[SECURITY] DebugModeAuthentication used (DEV only). path=%s", request.path)
        return user, {"auth": "debug"}

    def authenticate_header(self, request) -> str:
        return 'DebugMode realm="api"'


class TelegramWebAppAuthentication(authentication.BaseAuthentication):
    """
    Основной безопасный путь: проверяем initData подписью Telegram.
    """

    def authenticate(self, request) -> Optional[Tuple[User, Dict[str, Any]]]:
        init_data = _get_header(request, "X-Telegram-Init-Data")

        # Для POST/PUT/PATCH допускаем initData в body, но НЕ требуем.
        if not init_data and request.method in {"POST", "PUT", "PATCH"}:
            try:
                init_data = (
                    request.data.get("initData") or request.data.get("init_data") or ""
                ).strip()
            except Exception:
                init_data = ""

        if not init_data:
            return None

        auth_service = get_webapp_auth_service()
        parsed = auth_service.validate_init_data(init_data)
        if not parsed:
            # Никаких prefix initData в логах
            logger.warning(
                "[TelegramAuth] invalid initData signature. path=%s len=%d",
                request.path,
                len(init_data),
            )
            raise exceptions.AuthenticationFailed("Invalid Telegram initData signature")

        user_data = auth_service.get_user_data_from_init_data(parsed)
        if not user_data or not user_data.get("id"):
            raise exceptions.AuthenticationFailed("Invalid Telegram user data")

        identity = TelegramIdentity(
            telegram_id=int(user_data["id"]),
            first_name=user_data.get("first_name", "") or "",
            last_name=user_data.get("last_name", "") or "",
            username=user_data.get("username", "") or "",
            language_code=user_data.get("language_code", "ru") or "ru",
            is_premium=bool(user_data.get("is_premium", False)),
        )

        user = _ensure_user_and_profiles(identity)
        return user, {"auth": "telegram_webapp"}


class TelegramHeaderAuthentication(authentication.BaseAuthentication):
    """
    ОПАСНЫЙ режим: доверие заголовкам.

    Разрешаем только:
    - в DEV, или
    - если backend реально недоступен напрямую (твоя архитектура должна это гарантировать)

    По умолчанию выключено (settings.TELEGRAM_HEADER_AUTH_ENABLED=False).
    """

    def authenticate(self, request) -> Optional[Tuple[User, Dict[str, Any]]]:
        if not bool(getattr(settings, "TELEGRAM_HEADER_AUTH_ENABLED", False)):
            return None

        # В проде запрещаем, если нет явного INTERNAL_ONLY флага.
        if getattr(settings, "APP_ENV", "") == "prod" and not bool(
            getattr(settings, "INTERNAL_ONLY", False)
        ):
            raise exceptions.AuthenticationFailed(
                "Header auth is forbidden in production without INTERNAL_ONLY"
            )

        telegram_id_raw = _get_header(request, "X-Telegram-Id")
        if not telegram_id_raw:
            return None

        telegram_id = _parse_int(telegram_id_raw, "telegram_id")
        identity = TelegramIdentity(
            telegram_id=telegram_id,
            first_name=_get_header(request, "X-Telegram-First-Name") or "",
            last_name=_get_header(request, "X-Telegram-Last-Name") or "",
            username=_get_header(request, "X-Telegram-Username") or "",
            language_code=_get_header(request, "X-Telegram-Language-Code") or "ru",
            is_premium=False,
        )

        user = _ensure_user_and_profiles(identity)
        return user, {"auth": "telegram_headers"}

    def authenticate_header(self, request) -> str:
        return 'TelegramHeader realm="api"'

"""
Единый сервис проверки Telegram WebApp initData.

Важные правила:
- Никогда не логируем initData и его куски (там PII).
- Проверяем TTL по auth_date.
- Проверяем подпись через HMAC (WebAppData).
- Отсекаем мусор по длине и дубликатам ключей.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
import json
import logging
import time
from typing import Dict, Optional, Tuple
from urllib.parse import parse_qsl

from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24  # 24 часа (для обычного входа)
DEFAULT_MAX_INIT_DATA_LENGTH = 10_000


@dataclass(frozen=True)
class ValidationResult:
    parsed: Dict[str, str]  # parsed без hash
    auth_date: int


class TelegramWebAppAuthService:
    def __init__(self, bot_token: str):
        self._bot_token = bot_token or ""

    def validate_init_data(
        self,
        raw_init_data: str,
        *,
        max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
    ) -> Optional[Dict[str, str]]:
        r = self.validate_init_data_detailed(raw_init_data, max_age_seconds=max_age_seconds)
        return r.parsed if r else None

    def validate_init_data_detailed(
        self,
        raw_init_data: str,
        *,
        max_age_seconds: int = DEFAULT_MAX_AGE_SECONDS,
    ) -> Optional[ValidationResult]:
        if not raw_init_data:
            return None

        if not self._bot_token:
            # Конфиг-ошибка. Лучше ловить на старте через guards, но тут тоже фиксируем.
            logger.error("[WebAppAuth] TELEGRAM_BOT_TOKEN is missing (auth will fail).")
            return None

        max_len = int(getattr(settings, "TELEGRAM_INIT_DATA_MAX_LEN", DEFAULT_MAX_INIT_DATA_LENGTH))
        if len(raw_init_data) > max_len:
            logger.warning("[WebAppAuth] initData too long (rejected).")
            return None

        try:
            parsed, received_hash = self._parse_init_data(raw_init_data)
            if not received_hash:
                return None

            auth_date = self._extract_auth_date(parsed)
            if auth_date is None:
                return None

            if not self._check_ttl(auth_date, max_age_seconds=max_age_seconds):
                return None

            data_check_string = self._build_data_check_string(parsed)
            calculated_hash = self._calculate_hash(data_check_string)

            if not hmac.compare_digest(calculated_hash, received_hash):
                logger.warning("[WebAppAuth] Hash mismatch.")
                return None

            return ValidationResult(parsed=parsed, auth_date=auth_date)

        except Exception:
            logger.exception("[WebAppAuth] Validation error.")
            return None

    def _parse_init_data(self, raw_init_data: str) -> Tuple[Dict[str, str], Optional[str]]:
        pairs = parse_qsl(raw_init_data, keep_blank_values=True)

        # Защита от дубликатов ключей (анти-экзотика)
        keys = [k for k, _ in pairs]
        if len(keys) != len(set(keys)):
            logger.warning("[WebAppAuth] Duplicate keys in initData.")
            return {}, None

        parsed_data = dict(pairs)
        received_hash = parsed_data.pop("hash", None)
        if not received_hash:
            logger.warning("[WebAppAuth] No hash in initData.")
            return {}, None

        return parsed_data, received_hash

    def _extract_auth_date(self, parsed_data: Dict[str, str]) -> Optional[int]:
        raw = parsed_data.get("auth_date")
        if not raw:
            logger.warning("[WebAppAuth] No auth_date in initData.")
            return None
        try:
            return int(raw)
        except (ValueError, TypeError):
            logger.warning("[WebAppAuth] Invalid auth_date.")
            return None

    def _check_ttl(self, auth_date: int, *, max_age_seconds: int) -> bool:
        if max_age_seconds <= 0:
            return True

        now = int(time.time())

        # future guard
        if auth_date > now + 60:
            logger.warning("[WebAppAuth] auth_date is in the future.")
            return False

        age = now - auth_date
        if age > max_age_seconds:
            logger.warning("[WebAppAuth] initData expired.")
            return False

        return True

    def _build_data_check_string(self, parsed_data: Dict[str, str]) -> str:
        return "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))

    def _calculate_hash(self, data_check_string: str) -> str:
        secret_key = hmac.new(
            key=b"WebAppData",
            msg=self._bot_token.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()

        return hmac.new(
            key=secret_key,
            msg=data_check_string.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

    def get_user_data_from_init_data(self, parsed_data: Dict[str, str]) -> Optional[dict]:
        user_json = parsed_data.get("user")
        if not user_json:
            return None
        try:
            return json.loads(user_json)
        except json.JSONDecodeError:
            logger.warning("[WebAppAuth] Invalid user JSON.")
            return None

    def get_user_id_from_init_data(self, parsed_data: Dict[str, str]) -> Optional[int]:
        user_data = self.get_user_data_from_init_data(parsed_data)
        if not user_data:
            return None
        try:
            return int(user_data.get("id"))
        except (TypeError, ValueError):
            return None


_auth_service: Optional[TelegramWebAppAuthService] = None
_auth_service_token: Optional[str] = None


def get_webapp_auth_service() -> TelegramWebAppAuthService:
    """
    Singleton.

    Важно:
    - токен в нормальном мире не меняется в рантайме в проде
    - но при dev reload может меняться — пересоздадим аккуратно
    """
    global _auth_service, _auth_service_token

    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "") or ""
    if _auth_service is None or _auth_service_token != token:
        _auth_service = TelegramWebAppAuthService(token)
        _auth_service_token = token
    return _auth_service

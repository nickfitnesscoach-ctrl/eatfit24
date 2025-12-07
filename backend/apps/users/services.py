"""
User services for EatFit24.

NOTE: EmailVerificationService has been removed.
EatFit24 uses Telegram WebApp authentication only - no email verification needed.
"""

import logging

logger = logging.getLogger(__name__)


# =============================================================================
# REMOVED: EmailVerificationService
# =============================================================================
# Email verification service has been removed as EatFit24 uses Telegram auth only.
# The following functionality was removed:
# - create_verification_token()
# - send_verification_email()
# - verify_token()
# - cleanup_expired_tokens()
#
# Authentication is now handled by:
# - apps/telegram/authentication.py: TelegramHeaderAuthentication
# - apps/telegram/views/auth.py: webapp_auth endpoint
# =============================================================================

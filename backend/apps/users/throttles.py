"""
Throttling (rate limiting) classes for users app.

NOTE: Email/password authentication throttles have been removed.
EatFit24 uses Telegram WebApp authentication only.
"""

from rest_framework.throttling import UserRateThrottle


# =============================================================================
# REMOVED: Email/Password Authentication Throttles
# =============================================================================
# The following throttles have been removed as EatFit24 uses Telegram auth:
# - RegisterThrottle (email/password registration)
# - LoginThrottle (email/password login with progressive rate limiting)
# - PasswordChangeThrottle (password change - no passwords with Telegram)
# =============================================================================


class ProfileUpdateThrottle(UserRateThrottle):
    """
    Throttle for profile update endpoint.

    Limits: 30 updates per hour per authenticated user.
    Allows frequent legitimate updates while preventing abuse.
    """
    rate = '30/hour'
    scope = 'profile_update'

"""
URL configuration for users app.

NOTE: Email/password authentication has been removed.
EatFit24 uses Telegram WebApp authentication only.
See apps/telegram/urls.py for auth endpoints.
"""

from django.urls import path

from . import views

app_name = "users"

urlpatterns = [
    # Profile endpoints (Telegram auth only)
    path('profile/', views.ProfileView.as_view(), name='profile'),
    path('profile/avatar/', views.UploadAvatarView.as_view(), name='upload-avatar'),
    path('profile/delete/', views.DeleteAccountView.as_view(), name='delete-account'),

    # REMOVED: Email/password authentication endpoints
    # - auth/register/ - replaced by Telegram auto-registration
    # - auth/login/ - replaced by Telegram WebApp auth
    # - auth/refresh/ - not needed with Telegram auth
    # - auth/verify-email/ - not applicable
    # - auth/resend-verification/ - not applicable
    # - profile/change-password/ - not applicable (no passwords)
]

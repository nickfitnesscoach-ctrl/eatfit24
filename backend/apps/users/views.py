"""
Views for users app.

NOTE: Email/password authentication has been removed.
EatFit24 uses Telegram WebApp authentication only.
Remaining views: ProfileView, UploadAvatarView, DeleteAccountView
"""

from django.contrib.auth.models import User
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.audit import SecurityAuditLogger

from .models import Profile
from .serializers import (
    ProfileSerializer,
    UserSerializer,
)
from .throttles import (
    ProfileUpdateThrottle,
)


# =============================================================================
# REMOVED: Email/Password Authentication Views
# =============================================================================
# The following views have been removed as EatFit24 uses Telegram WebApp auth:
# - RegisterView (email/password registration)
# - LoginView (email/password login)
# - CustomTokenRefreshView (JWT token refresh)
# - VerifyEmailView (email verification)
# - ResendVerificationEmailView (resend verification email)
# - ChangePasswordView (password change - no passwords with Telegram auth)
#
# Authentication is now handled by:
# - apps/telegram/authentication.py: TelegramHeaderAuthentication, DebugModeAuthentication
# - apps/telegram/views/auth.py: webapp_auth endpoint
# =============================================================================


@extend_schema(tags=['Profile'])
@extend_schema_view(
    get=extend_schema(
        summary="Получить профиль текущего пользователя",
        description="Возвращает информацию о профиле авторизованного пользователя.",
        responses={200: UserSerializer}
    ),
    put=extend_schema(
        summary="Обновить профиль полностью",
        description="Полное обновление профиля пользователя.",
        request=ProfileSerializer,
        responses={200: UserSerializer}
    ),
    patch=extend_schema(
        summary="Частично обновить профиль",
        description="Частичное обновление полей профиля пользователя.",
        request=ProfileSerializer,
        responses={200: UserSerializer}
    )
)
class ProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint for viewing and updating user profile.
    GET/PUT/PATCH /api/v1/users/profile/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer
    throttle_classes = [ProfileUpdateThrottle]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)

        partial = kwargs.pop('partial', False)
        user = self.get_object()

        # Log incoming request data with platform info
        platform = request.META.get('HTTP_SEC_CH_UA_PLATFORM', 'unknown')
        user_agent = request.META.get('HTTP_USER_AGENT', 'unknown')[:100]
        logger.info(
            f"[ProfileView] {'PATCH' if partial else 'PUT'} /api/v1/users/profile/ - "
            f"User: {user.id}, Platform: {platform}, Data: {request.data}"
        )

        # Update username if provided
        if 'username' in request.data:
            user.username = request.data['username']
            user.save()

        # Update profile data (all other fields)
        # Defensive: Create profile if missing (should be created by signal, but just in case)
        try:
            profile = user.profile
        except Profile.DoesNotExist:
            logger.warning(f"[ProfileView] Profile missing for user {user.id}, creating now")
            profile = Profile.objects.create(user=user)

        profile_serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=partial,
            context={'request': request}
        )

        # Validate and handle errors
        try:
            profile_serializer.is_valid(raise_exception=True)
            profile_serializer.save()

            logger.info(f"[ProfileView] Profile updated successfully for user {user.id}")

            # Return updated user with profile
            user_serializer = self.get_serializer(user)
            return Response(user_serializer.data)

        except Exception as e:
            logger.error(
                f"[ProfileView] Profile update failed for user {user.id}: "
                f"{type(e).__name__}: {str(e)}, "
                f"Errors: {getattr(profile_serializer, 'errors', 'N/A')}"
            )
            raise


@extend_schema(tags=['Profile'])
@extend_schema_view(
    delete=extend_schema(
        summary="Удалить аккаунт",
        description="Удаление аккаунта текущего пользователя.",
        responses={
            204: {"description": "Аккаунт успешно удален"},
            401: {"description": "Не авторизован"}
        }
    )
)
class DeleteAccountView(APIView):
    """
    API endpoint for deleting user account.
    DELETE /api/v1/users/profile/delete/
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user

        # SECURITY: Log account deletion before deleting
        SecurityAuditLogger.log_account_deletion(user, request)

        user.delete()

        return Response(
            {"detail": "Аккаунт успешно удален."},
            status=status.HTTP_204_NO_CONTENT
        )


@extend_schema(tags=['Profile'])
@extend_schema_view(
    post=extend_schema(
        summary="Загрузить/обновить аватар профиля",
        description="""
        Загрузка или обновление аватара текущего пользователя.

        **Ограничения:**
        - Максимальный размер файла: 5 МБ
        - Допустимые форматы: JPEG, PNG, WebP, HEIC (iOS)
        - Content-Type: multipart/form-data
        - Поле файла: avatar

        Возвращает обновлённый профиль пользователя с URL аватара.
        """,
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'avatar': {
                        'type': 'string',
                        'format': 'binary',
                        'description': 'Файл изображения (JPG, PNG, WebP)'
                    }
                }
            }
        },
        responses={
            200: UserSerializer,
            400: {"description": "Неверный формат файла или слишком большой размер"},
            401: {"description": "Не авторизован"}
        }
    )
)
class UploadAvatarView(APIView):
    """
    API endpoint for uploading/updating user avatar.
    POST /api/v1/users/profile/avatar/
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ProfileUpdateThrottle]

    def post(self, request):
        import logging
        from django.core.exceptions import ValidationError as DjangoValidationError
        from .validators import (
            convert_heic_to_jpeg,
            is_heic_file,
            validate_avatar_file_extension,
            validate_avatar_file_size,
            validate_avatar_mime_type,
        )

        logger = logging.getLogger(__name__)

        # Get uploaded file
        avatar_file = request.FILES.get('avatar')

        if not avatar_file:
            return Response(
                {
                    "code": "avatar_missing",
                    "detail": "Файл аватара не предоставлен. Используйте поле 'avatar' в multipart/form-data.",
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate using centralized validators
        try:
            # Convert HEIC/HEIF from iOS to JPEG for cross-platform support
            if is_heic_file(avatar_file):
                logger.info(
                    "Converting HEIC avatar for user %s (name=%s, type=%s)",
                    request.user.id,
                    avatar_file.name,
                    getattr(avatar_file, 'content_type', 'unknown'),
                )
                avatar_file = convert_heic_to_jpeg(avatar_file)

            # Validate MIME type first (from uploaded file)
            validate_avatar_mime_type(avatar_file)

            # Validate file size
            validate_avatar_file_size(avatar_file)

            # Validate file extension
            validate_avatar_file_extension(avatar_file)

        except DjangoValidationError as e:
            # Extract error message and code
            error_message = str(e.message) if hasattr(e, 'message') else str(e)
            error_code = e.code if hasattr(e, 'code') else 'validation_error'

            logger.warning(
                f"Avatar validation failed for user {request.user.id}: {error_code} - {error_message}"
            )

            # Return structured validation error
            return Response(
                {
                    "error": error_message,
                    "code": error_code,
                    "detail": error_message
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get user profile
        user = request.user
        # Defensive: Create profile if missing (should be created by signal, but just in case)
        try:
            profile = user.profile
        except Profile.DoesNotExist:
            logger.warning(f"[AvatarUploadView] Profile missing for user {user.id}, creating now")
            profile = Profile.objects.create(user=user)

        try:
            # Use the safe set_avatar method which:
            # 1. Deletes old avatar safely
            # 2. Sets new avatar
            # 3. Increments avatar_version
            # 4. Saves profile
            profile.set_avatar(avatar_file)

            logger.info(f"Avatar uploaded successfully for user {user.id}, version {profile.avatar_version}")

        except Exception as e:
            logger.error(f"Failed to upload avatar for user {user.id}: {str(e)}")
            return Response(
                {"code": "avatar_upload_failed", "detail": "Не удалось загрузить аватар. Попробуйте позже."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Return updated user with profile (including avatar_url with version)
        user_serializer = UserSerializer(user, context={'request': request})
        return Response(user_serializer.data, status=status.HTTP_200_OK)

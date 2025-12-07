"""
Validators for users app.

NOTE: Email validation functions have been removed.
EatFit24 uses Telegram WebApp authentication only.
"""

import logging
import os
from io import BytesIO
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.utils.translation import gettext_lazy as _
from PIL import Image
from pillow_heif import register_heif_opener

logger = logging.getLogger(__name__)


# =============================================================================
# REMOVED: Email Validation Functions
# =============================================================================
# The following functions have been removed as EatFit24 uses Telegram auth:
# - validate_email_domain() - email domain validation
# - validate_email_not_exists() - check if email already registered
# - is_email_verified() - check email verification status
# - mark_email_as_verified() - mark email as verified
# - DISPOSABLE_EMAIL_DOMAINS - list of disposable email domains
# =============================================================================


# ============================================================
# Avatar File Validators
# ============================================================

# Avatar validation settings
AVATAR_MAX_SIZE_MB = 5
AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024
# iOS cameras produce HEIC by default - we support it
AVATAR_ALLOWED_TYPES = ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence')
AVATAR_ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif')

# HEIC-specific constants for conversion
HEIC_MIME_TYPES = ('image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence')
HEIC_EXTENSIONS = ('.heic', '.heif')


def validate_avatar_file_extension(value):
    """
    Validate that the uploaded file has an allowed extension.

    Args:
        value: FieldFile object (e.g., from ImageField)

    Raises:
        ValidationError: If file extension is not allowed
    """
    if not value:
        return

    ext = os.path.splitext(value.name)[1].lower()
    if ext not in AVATAR_ALLOWED_EXTENSIONS:
        raise ValidationError(
            _(f'Неверный формат файла. Разрешены только: {", ".join(AVATAR_ALLOWED_EXTENSIONS)}'),
            code='invalid_extension'
        )


def validate_avatar_file_size(value):
    """
    Validate that the uploaded file size does not exceed the limit.

    Args:
        value: FieldFile object (e.g., from ImageField)

    Raises:
        ValidationError: If file size exceeds maximum allowed size
    """
    if not value:
        return

    if value.size > AVATAR_MAX_SIZE_BYTES:
        raise ValidationError(
            _(f'Размер файла превышает {AVATAR_MAX_SIZE_MB} МБ. '
              f'Текущий размер: {value.size / (1024 * 1024):.1f} МБ'),
            code='file_too_large'
        )


def validate_avatar_mime_type(file):
    """
    Validate that the uploaded file has an allowed MIME type.

    Args:
        file: InMemoryUploadedFile or TemporaryUploadedFile

    Raises:
        ValidationError: If MIME type is not allowed
    """
    if not file:
        return

    content_type = getattr(file, 'content_type', None)
    if content_type and content_type not in AVATAR_ALLOWED_TYPES:
        raise ValidationError(
            _(f'Неверный формат файла. Разрешены: JPEG, PNG, WebP, HEIC'),
            code='invalid_mime_type'
        )


def is_heic_file(file) -> bool:
    """Check whether uploaded file is in HEIC/HEIF format."""
    if not file:
        return False

    content_type = getattr(file, 'content_type', '') or ''
    ext = os.path.splitext(file.name)[1].lower()
    return content_type in HEIC_MIME_TYPES or ext in HEIC_EXTENSIONS


def convert_heic_to_jpeg(file):
    """Convert HEIC/HEIF images to a JPEG InMemoryUploadedFile."""
    if not file:
        raise ValidationError(_('Файл не найден'), code='file_missing')

    try:
        register_heif_opener()
        file.seek(0)
        image = Image.open(file)
        rgb_image = image.convert('RGB')
        output = BytesIO()
        rgb_image.save(output, format='JPEG')
        output.seek(0)

        filename_base, _ = os.path.splitext(file.name)
        jpeg_name = f"{filename_base}.jpg"

        return InMemoryUploadedFile(
            output,
            field_name=getattr(file, 'field_name', 'avatar'),
            name=jpeg_name,
            content_type='image/jpeg',
            size=output.getbuffer().nbytes,
            charset=None,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception('Failed to convert HEIC to JPEG: %s', exc)
        raise ValidationError(
            _('Не удалось обработать HEIC-файл. Пожалуйста, сохраните фото как JPEG/PNG.'),
            code='heic_conversion_failed',
        )

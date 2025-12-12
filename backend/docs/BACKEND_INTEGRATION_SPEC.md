# ТЗ: Backend Integration Fixes

> **Основа:** AUDIT_INTEGRATION.md  
> **Цель:** Привести backend API в соответствие с ожиданиями frontend, унифицировать error handling, устранить race conditions

---

## 1. Единый формат ошибок

### 1.1 Целевой формат

Все API endpoints должны возвращать ошибки в едином формате:

```json
{
  "error": {
    "code": "DAILY_LIMIT_REACHED",
    "message": "Дневной лимит фото исчерпан. Оформите PRO для безлимита.",
    "details": {
      "limit": 3,
      "used": 3,
      "plan": "FREE"
    }
  }
}
```

### 1.2 Задачи

#### 1.2.1 Создать `core/exception_handler.py`

```python
# apps/core/exception_handler.py

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

from apps.core.exceptions import (
    FoodMindException,
    ValidationError,
    NotFoundError,
    PermissionDeniedError,
    BusinessLogicError,
    DailyLimitExceededError,
    ExternalServiceError,
)

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    Returns unified error format for all exceptions.
    """
    # Let DRF handle its own exceptions first
    response = exception_handler(exc, context)

    if response is not None:
        # Convert DRF errors to unified format
        return _convert_drf_error(response, exc)

    # Handle our domain exceptions
    if isinstance(exc, FoodMindException):
        return _handle_foodmind_exception(exc)

    # Log unexpected exceptions
    logger.exception(f"Unhandled exception: {exc}")

    return Response(
        {
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Произошла внутренняя ошибка",
                "details": {}
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def _convert_drf_error(response, exc):
    """Convert DRF error response to unified format."""
    data = response.data

    # Already in our format
    if isinstance(data, dict) and "error" in data and isinstance(data["error"], dict):
        return response

    # DRF validation errors
    if isinstance(data, dict):
        # { "field": ["error1", "error2"] }
        if any(isinstance(v, list) for v in data.values()):
            return Response(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Ошибка валидации данных",
                        "details": data
                    }
                },
                status=response.status_code
            )

        # { "detail": "message" }
        if "detail" in data:
            return Response(
                {
                    "error": {
                        "code": _status_to_code(response.status_code),
                        "message": str(data["detail"]),
                        "details": {}
                    }
                },
                status=response.status_code
            )

    return response


def _handle_foodmind_exception(exc: FoodMindException):
    """Handle FoodMindException subclasses."""
    status_code = _get_status_code(exc)

    return Response(
        {
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        },
        status=status_code
    )


def _get_status_code(exc: FoodMindException) -> int:
    """Map exception type to HTTP status code."""
    if isinstance(exc, ValidationError):
        return status.HTTP_400_BAD_REQUEST
    if isinstance(exc, NotFoundError):
        return status.HTTP_404_NOT_FOUND
    if isinstance(exc, PermissionDeniedError):
        return status.HTTP_403_FORBIDDEN
    if isinstance(exc, DailyLimitExceededError):
        return status.HTTP_429_TOO_MANY_REQUESTS
    if isinstance(exc, BusinessLogicError):
        return status.HTTP_409_CONFLICT
    if isinstance(exc, ExternalServiceError):
        return status.HTTP_502_BAD_GATEWAY
    return status.HTTP_500_INTERNAL_SERVER_ERROR


def _status_to_code(status_code: int) -> str:
    """Map HTTP status code to error code."""
    mapping = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
    }
    return mapping.get(status_code, "ERROR")
```

#### 1.2.2 Обновить `config/settings/base.py`

```python
# config/settings/base.py

REST_FRAMEWORK = {
    # ... existing settings ...

    # Use custom exception handler
    "EXCEPTION_HANDLER": "apps.core.exception_handler.custom_exception_handler",
}
```

#### 1.2.3 Обновить `core/exceptions.py`

Добавить недостающие коды ошибок:

```python
# apps/core/exceptions.py

# Existing classes...

class InvalidImageError(ValidationError):
    """Invalid image format or content."""
    default_message = "Неверный формат изображения"
    default_code = "INVALID_IMAGE"


class AIRecognitionFailedError(ExternalServiceError):
    """AI failed to recognize food."""
    default_message = "Не удалось распознать еду на фото"
    default_code = "AI_RECOGNITION_FAILED"


class PaymentCreationError(ExternalServiceError):
    """Failed to create payment."""
    default_message = "Не удалось создать платёж"
    default_code = "PAYMENT_ERROR"


class NoPaymentMethodError(BusinessLogicError):
    """No payment method attached."""
    default_message = "Для автопродления необходима привязанная карта"
    default_code = "NO_PAYMENT_METHOD"
```

#### 1.2.4 Миграция views на exceptions

**Пример: `ai/views.py`**

```python
# apps/ai/views.py

from apps.core.exceptions import (
    DailyLimitExceededError,
    InvalidImageError,
    AIServiceError,
    AIServiceTimeoutError,
)

# БЫЛО:
return Response(
    {
        "error": "DAILY_LIMIT_REACHED",
        "detail": f"Превышен дневной лимит {plan.daily_photo_limit} фото."
    },
    status=status.HTTP_429_TOO_MANY_REQUESTS
)

# СТАЛО:
raise DailyLimitExceededError(
    message=f"Превышен дневной лимит {plan.daily_photo_limit} фото. Оформите PRO для безлимита.",
    details={
        "limit": plan.daily_photo_limit,
        "used": usage.photo_ai_requests,
        "plan": plan.code
    }
)
```

**Пример: `billing/views.py`**

```python
# apps/billing/views.py

from apps.core.exceptions import (
    NotFoundError,
    BusinessLogicError,
    NoPaymentMethodError,
    PlanNotFoundError,
)

# БЫЛО:
return Response(
    {
        'error': {
            'code': 'NO_PAYMENT_METHOD',
            'message': 'Для автопродления необходим сохранённый способ оплаты.'
        }
    },
    status=status.HTTP_400_BAD_REQUEST
)

# СТАЛО:
raise NoPaymentMethodError()
```

---

## 2. AI Recognition: устранение race condition

### 2.1 Проблема

При async режиме (Celery) task может вернуть `SUCCESS` с `recognized_items: []`, хотя FoodItems уже сохранены в DB. Frontend вынужден делать fallback запрос к `/meals/{id}/`.

### 2.2 Причина

В `apps/ai/tasks.py` result формируется ДО того, как FoodItems гарантированно записаны в DB.

### 2.3 Решение

#### 2.3.1 Обновить `apps/ai/tasks.py`

```python
# apps/ai/tasks.py

from celery import shared_task
from django.db import transaction
import logging
import time

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def recognize_food_async(self, meal_id, image_data_url, user_id, description='', comment=''):
    """
    Async food recognition task.
    
    Returns result with recognized_items from DB (not from AI response).
    """
    from apps.nutrition.models import Meal, FoodItem
    from apps.ai_proxy.service import AIProxyRecognitionService
    from apps.billing.usage import DailyUsage
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        meal = Meal.objects.get(id=meal_id)
        user = User.objects.get(id=user_id)

        # Call AI service
        ai_service = AIProxyRecognitionService()
        start_time = time.time()

        result = ai_service.recognize_food(
            image_data_url,
            user_description=description,
            user_comment=comment
        )

        recognition_time = time.time() - start_time
        logger.info(f"AI recognition completed in {recognition_time:.2f}s")

        recognized_items = result.get('recognized_items', [])

        # Save items to DB in transaction
        with transaction.atomic():
            created_items = []
            for item in recognized_items:
                food_item = FoodItem.objects.create(
                    meal=meal,
                    name=item.get('name', 'Unknown'),
                    grams=item.get('estimated_weight', 100),
                    calories=item.get('calories', 0),
                    protein=item.get('protein', 0),
                    fat=item.get('fat', 0),
                    carbohydrates=item.get('carbohydrates', 0)
                )
                created_items.append(food_item)

            # Increment usage counter
            DailyUsage.objects.increment_photo_requests(user)

        # IMPORTANT: Refresh from DB to get actual saved items
        # This guarantees we return what's really in the database
        meal.refresh_from_db()
        db_items = list(meal.items.all())

        logger.info(f"Saved {len(db_items)} items for meal {meal_id}")

        # Build result from DB (not from AI response)
        items_data = [
            {
                'id': str(item.id),
                'name': item.name,
                'grams': item.grams,
                'calories': float(item.calories),
                'protein': float(item.protein),
                'fat': float(item.fat),
                'carbohydrates': float(item.carbohydrates),
            }
            for item in db_items
        ]

        totals = {
            'calories': sum(item.calories for item in db_items),
            'protein': sum(float(item.protein) for item in db_items),
            'fat': sum(float(item.fat) for item in db_items),
            'carbohydrates': sum(float(item.carbohydrates) for item in db_items),
        }

        return {
            'success': True,
            'meal_id': str(meal.id),
            'recognized_items': items_data,
            'totals': totals,
            'recognition_time': recognition_time,
            'photo_url': meal.photo.url if meal.photo else None,
        }

    except Meal.DoesNotExist:
        logger.error(f"Meal {meal_id} not found")
        return {
            'success': False,
            'meal_id': str(meal_id),
            'error': 'Приём пищи не найден',
        }

    except Exception as exc:
        logger.exception(f"AI recognition failed for meal {meal_id}: {exc}")

        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)

        return {
            'success': False,
            'meal_id': str(meal_id),
            'error': f'Ошибка распознавания: {str(exc)}',
        }
```

#### 2.3.2 Обновить sync режим в `apps/ai/services.py`

```python
# apps/ai/services.py

def recognize_and_save_meal(...) -> Dict[str, Any]:
    """
    Recognize food from image and create Meal with FoodItems.
    Returns items from DB (not from AI response).
    """
    # ... existing code to create meal and call AI ...

    # Save recognized items
    with transaction.atomic():
        for item in recognized_items:
            FoodItem.objects.create(
                meal=meal,
                name=item.get('name', 'Unknown'),
                grams=item.get('estimated_weight', 100),
                calories=item.get('calories', 0),
                protein=item.get('protein', 0),
                fat=item.get('fat', 0),
                carbohydrates=item.get('carbohydrates', 0)
            )

        # Increment photo usage counter
        DailyUsage.objects.increment_photo_requests(user)

    # IMPORTANT: Return items from DB
    meal.refresh_from_db()
    db_items = list(meal.items.all())

    return {
        'meal': meal,
        'recognized_items': [
            {
                'id': str(item.id),
                'name': item.name,
                'grams': item.grams,
                'calories': float(item.calories),
                'protein': float(item.protein),
                'fat': float(item.fat),
                'carbohydrates': float(item.carbohydrates),
            }
            for item in db_items
        ],
        'recognition_time': recognition_elapsed,
    }
```

---

## 3. Billing: deprecated endpoints

### 3.1 Задачи

#### 3.1.1 Пометить legacy endpoints как deprecated

```python
# apps/billing/urls.py

urlpatterns = [
    # Current (active) endpoints
    path('plans/', views.get_subscription_plans, name='subscription-plans'),
    path('me/', views.get_subscription_status, name='subscription-status'),
    path('subscription/', views.get_subscription_details, name='subscription-details'),
    path('subscription/autorenew/', views.set_auto_renew, name='set-auto-renew'),
    path('create-payment/', views.create_payment, name='create-payment'),
    path('bind-card/start/', views.bind_card_start, name='bind-card-start'),
    path('payment-method/', views.get_payment_method_details, name='payment-method-details'),
    path('payments/', views.get_payments_history, name='payments-history'),
    path('webhooks/yookassa', yookassa_webhook, name='yookassa-webhook'),

    # DEPRECATED - will be removed in v2.0
    # Use /me/ instead of /plan
    path('plan', views.get_current_plan_deprecated, name='current-plan-deprecated'),
    # Use /subscription/autorenew/ instead
    path('auto-renew/toggle', views.toggle_auto_renew_deprecated, name='toggle-auto-renew-deprecated'),
]
```

#### 3.1.2 Добавить deprecation warnings

```python
# apps/billing/views.py

import warnings
from functools import wraps


def deprecated(message):
    """Decorator to mark views as deprecated."""
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            warnings.warn(
                f"Endpoint {request.path} is deprecated: {message}",
                DeprecationWarning
            )
            # Add deprecation header
            response = func(request, *args, **kwargs)
            response['X-Deprecated'] = message
            response['X-Deprecated-Use'] = message
            return response
        return wrapper
    return decorator


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@deprecated("Use /api/v1/billing/me/ instead")
def get_current_plan_deprecated(request):
    """DEPRECATED: Use get_subscription_status instead."""
    return get_current_plan(request)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@deprecated("Use /api/v1/billing/subscription/autorenew/ instead")
def toggle_auto_renew_deprecated(request):
    """DEPRECATED: Use set_auto_renew instead."""
    return toggle_auto_renew(request)
```

#### 3.1.3 Нормализовать plan_code

В `apps/billing/models.py` уже есть поле `code`, но нужно гарантировать консистентность:

```python
# apps/billing/models.py

class SubscriptionPlan(models.Model):
    # Valid plan codes
    PLAN_CODES = [
        ('FREE', 'Бесплатный'),
        ('PRO_MONTHLY', 'PRO месяц'),
        ('PRO_YEARLY', 'PRO год'),
    ]

    code = models.CharField(
        max_length=20,
        choices=PLAN_CODES,
        unique=True,
        db_index=True,
        help_text="System code: FREE, PRO_MONTHLY, PRO_YEARLY"
    )

    # ... rest of the model ...

    def clean(self):
        """Validate that code is one of allowed values."""
        valid_codes = [c[0] for c in self.PLAN_CODES]
        if self.code not in valid_codes:
            raise ValidationError(f"Invalid plan code. Must be one of: {valid_codes}")
```

Создать миграцию для нормализации существующих данных:

```python
# apps/billing/migrations/XXXX_normalize_plan_codes.py

from django.db import migrations


def normalize_plan_codes(apps, schema_editor):
    SubscriptionPlan = apps.get_model('billing', 'SubscriptionPlan')

    # Map old codes to new
    code_mapping = {
        'MONTHLY': 'PRO_MONTHLY',
        'YEARLY': 'PRO_YEARLY',
    }

    for old_code, new_code in code_mapping.items():
        SubscriptionPlan.objects.filter(code=old_code).update(code=new_code)


class Migration(migrations.Migration):
    dependencies = [
        ('billing', 'previous_migration'),
    ]

    operations = [
        migrations.RunPython(normalize_plan_codes, reverse_code=migrations.RunPython.noop),
    ]
```

---

## 4. Debug Mode: безопасность

### 4.1 Задачи

#### 4.1.1 Добавить настройку в `settings/base.py`

```python
# config/settings/base.py

# Debug Mode for browser development (allows X-Debug-Mode header)
# SECURITY: Must be False in production!
WEBAPP_DEBUG_MODE_ENABLED = os.environ.get("WEBAPP_DEBUG_MODE_ENABLED", str(DEBUG)).lower() == "true"
```

#### 4.1.2 Обновить `DebugModeAuthentication`

```python
# apps/telegram/authentication.py

from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class DebugModeAuthentication(BaseAuthentication):
    """
    Authentication for browser development without Telegram.
    SECURITY: Only works when WEBAPP_DEBUG_MODE_ENABLED=True
    """

    def authenticate(self, request):
        # Check if debug mode is enabled in settings
        if not getattr(settings, 'WEBAPP_DEBUG_MODE_ENABLED', False):
            return None

        # Check for debug header
        debug_mode = request.META.get('HTTP_X_DEBUG_MODE', '').lower() == 'true'
        if not debug_mode:
            return None

        # Log debug mode usage
        client_ip = self._get_client_ip(request)
        logger.warning(
            f"[SECURITY] Debug Mode authentication used. "
            f"IP: {client_ip}, Path: {request.path}"
        )

        # Get or create debug user
        user = self._get_or_create_debug_user()

        return (user, {'debug_mode': True})

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')

    def _get_or_create_debug_user(self):
        from django.contrib.auth import get_user_model
        from apps.telegram.models import TelegramUser
        from apps.users.models import Profile

        User = get_user_model()

        user, created = User.objects.get_or_create(
            username='debug_user',
            defaults={
                'email': 'debug@localhost',
                'first_name': 'Debug',
                'last_name': 'User',
            }
        )

        # Ensure profile exists
        Profile.objects.get_or_create(user=user)

        # Ensure telegram profile exists
        TelegramUser.objects.get_or_create(
            user=user,
            defaults={
                'telegram_id': 0,
                'username': 'debug_user',
                'first_name': 'Debug',
            }
        )

        return user
```

#### 4.1.3 Обновить `settings/production.py`

```python
# config/settings/production.py

from .base import *

# SECURITY: Disable debug mode in production
DEBUG = False
WEBAPP_DEBUG_MODE_ENABLED = False

# Log any attempts to use debug mode
LOGGING['loggers']['apps.telegram.authentication'] = {
    'handlers': ['console', 'file'],
    'level': 'WARNING',
    'propagate': False,
}
```

---

## 5. Миграционный план

### Phase 1: Exception Handler (0.5 дня)

| # | Задача | Файлы |
|---|--------|-------|
| 1.1 | Создать `core/exception_handler.py` | `apps/core/exception_handler.py` |
| 1.2 | Обновить DRF settings | `config/settings/base.py` |
| 1.3 | Добавить новые exception классы | `apps/core/exceptions.py` |
| 1.4 | Тесты для exception handler | `apps/core/tests/test_exception_handler.py` |

### Phase 2: AI Race Condition (0.5 дня)

| # | Задача | Файлы |
|---|--------|-------|
| 2.1 | Обновить `recognize_food_async` task | `apps/ai/tasks.py` |
| 2.2 | Обновить `recognize_and_save_meal` | `apps/ai/services.py` |
| 2.3 | Тесты для race condition fix | `apps/ai/tests/test_recognition.py` |

### Phase 3: Billing Cleanup (0.5 дня)

| # | Задача | Файлы |
|---|--------|-------|
| 3.1 | Пометить legacy endpoints deprecated | `apps/billing/urls.py`, `apps/billing/views.py` |
| 3.2 | Создать миграцию для plan_code | `apps/billing/migrations/` |
| 3.3 | Обновить модель SubscriptionPlan | `apps/billing/models.py` |

### Phase 4: Debug Mode Security (0.5 дня)

| # | Задача | Файлы |
|---|--------|-------|
| 4.1 | Добавить WEBAPP_DEBUG_MODE_ENABLED | `config/settings/base.py` |
| 4.2 | Обновить DebugModeAuthentication | `apps/telegram/authentication.py` |
| 4.3 | Отключить в production | `config/settings/production.py` |

---

## 6. Чеклист перед релизом

- [ ] `custom_exception_handler` возвращает unified format для всех ошибок
- [ ] Все views используют `raise FoodMindException()` вместо `Response({error})`
- [ ] AI task возвращает items из DB после `refresh_from_db()`
- [ ] Legacy billing endpoints отмечены как deprecated с headers
- [ ] plan_code нормализован: только FREE, PRO_MONTHLY, PRO_YEARLY
- [ ] `WEBAPP_DEBUG_MODE_ENABLED=False` в production settings
- [ ] Debug Mode логирует IP и path при использовании
- [ ] Все изменения покрыты тестами

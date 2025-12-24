# 🧪 EatFit24 Test Plan

> **Тип:** Приложение к AUDIT.md  
> **Дата:** 2025-12-24  
> **Scope:** Минимальные проверки для каждого P0/P1 fix

---

## Формат

Каждый тест содержит:
- **Target Issue:** Какой P0/P1 проверяет
- **Type:** Unit / Integration / Manual / Curl
- **Prerequisites:** Что нужно подготовить
- **Steps:** Конкретные шаги
- **Expected:** Ожидаемый результат
- **Actual (before fix):** Текущее поведение

---

## P0-1: Лимиты AI не списываются

### Test P0-1-A: Unit Test — increment called after success

**Target:** P0-1  
**Type:** Unit (pytest)  
**File:** `backend/apps/ai/tests/test_tasks.py`

```python
import pytest
from unittest.mock import patch, MagicMock
from apps.ai.tasks import recognize_food_async


@pytest.mark.django_db
def test_usage_incremented_after_success(user, meal):
    """After successful AI recognition, usage counter should increment."""
    mock_result = MagicMock()
    mock_result.items = [{"name": "Test", "grams": 100, "calories": 100, "protein": 10, "fat": 5, "carbohydrates": 10, "confidence": 0.9}]
    mock_result.totals = {"calories": 100, "protein": 10, "fat": 5, "carbohydrates": 10}
    mock_result.meta = {}

    with patch("apps.ai.tasks.AIProxyService") as MockService:
        MockService.return_value.recognize_food.return_value = mock_result
        
        with patch("apps.billing.usage.DailyUsage.objects.increment_photo_ai_requests") as mock_increment:
            recognize_food_async(
                meal_id=meal.id,
                image_bytes=b"fake",
                mime_type="image/jpeg",
                user_id=user.id,
            )
            
            # EXPECTED: Called once after success
            mock_increment.assert_called_once_with(user)


@pytest.mark.django_db
def test_usage_not_incremented_on_ai_error(user, meal):
    """On AI error, usage counter should NOT increment."""
    from apps.ai_proxy import AIProxyValidationError
    
    with patch("apps.ai.tasks.AIProxyService") as MockService:
        MockService.return_value.recognize_food.side_effect = AIProxyValidationError("Bad image")
        
        with patch("apps.billing.usage.DailyUsage.objects.increment_photo_ai_requests") as mock_increment:
            with pytest.raises(AIProxyValidationError):
                recognize_food_async(
                    meal_id=meal.id,
                    image_bytes=b"fake",
                    mime_type="image/jpeg",
                    user_id=user.id,
                )
            
            # EXPECTED: NOT called on error
            mock_increment.assert_not_called()
```

**Expected:** После фикса — тесты проходят  
**Actual (before fix):** `mock_increment.assert_called_once_with(user)` fails — not called

---

### Test P0-1-B: Integration — FREE user limit enforced

**Target:** P0-1  
**Type:** Integration (pytest + real DB)  
**Prerequisites:** FREE plan с `daily_photo_limit=3`

```python
@pytest.mark.django_db
def test_free_user_cannot_exceed_daily_limit(client, free_user):
    """FREE user should be blocked after 3 AI requests."""
    from apps.billing.usage import DailyUsage
    
    # Setup: simulate 3 successful requests
    for _ in range(3):
        DailyUsage.objects.increment_photo_ai_requests(free_user)
    
    # Verify count
    usage = DailyUsage.objects.get_today(free_user)
    assert usage.photo_ai_requests == 3
    
    # 4th request should fail
    response = client.post(
        "/api/v1/ai/recognize/",
        {"data_url": "data:image/jpeg;base64,/9j/4AAQ..."},
        HTTP_X_TELEGRAM_INIT_DATA=f"user=%7B%22id%22%3A{free_user.telegram_id}%7D..."
    )
    
    # EXPECTED: 429 Too Many Requests
    assert response.status_code == 429
    assert "limit" in response.json().get("error", "").lower()
```

**Expected:** 429 на 4-й запрос  
**Actual (before fix):** 202 Accepted (создаётся Meal, запускается task)

---

### Test P0-1-C: Curl — manual check

**Target:** P0-1  
**Type:** Curl (manual)

```bash
# Prerequisites: FREE user token, limit=3

# 1. Check current usage
curl -X GET "https://api.eatfit24.ru/api/v1/billing/me/" \
  -H "X-Telegram-Init-Data: ..."

# Expected: { "used_today": 0, "remaining_today": 3 }

# 2. Send 3 photos
for i in {1..3}; do
  curl -X POST "https://api.eatfit24.ru/api/v1/ai/recognize/" \
    -H "X-Telegram-Init-Data: ..." \
    -F "image=@test.jpg" \
    -F "meal_type=SNACK"
  echo "Request $i"
done

# 3. Check usage
curl -X GET "https://api.eatfit24.ru/api/v1/billing/me/" \
  -H "X-Telegram-Init-Data: ..."

# Expected: { "used_today": 3, "remaining_today": 0 }

# 4. Try 4th request
curl -X POST "https://api.eatfit24.ru/api/v1/ai/recognize/" \
  -H "X-Telegram-Init-Data: ..." \
  -F "image=@test.jpg"

# Expected: 429 Too Many Requests
# Actual (before fix): 202 Accepted with task_id
```

---

## P0-2: Legacy файлы с битыми импортами

### Test P0-2-A: Import check

**Target:** P0-2  
**Type:** Unit (pytest)

```python
def test_ai_module_imports_clean():
    """AI module should import without errors."""
    # EXPECTED: No import errors
    from apps.ai import views, tasks, serializers
    
    # These should NOT exist after cleanup
    # from apps.ai import services_legacy  # Should fail
    # from apps.ai import tests_legacy     # Should fail
```

**Before fix:** `from apps.ai.services_legacy import recognize_and_save_meal` → ImportError  
**After fix:** legacy файлы удалены, всё импортируется чисто

---

### Test P0-2-B: Shell check

```bash
# Verify legacy files deleted
ls -la backend/apps/ai/ | grep legacy
# Expected: no output

# Verify imports work
python -c "from apps.ai import views, tasks; print('OK')"
# Expected: OK
```

---

## P0-3: Timezone mismatch

### Test P0-3-A: Timezone consistency

**Target:** P0-3  
**Type:** Unit (pytest)

```python
import pytest
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone
from unittest.mock import patch


@pytest.mark.django_db
def test_daily_usage_uses_local_date():
    """DailyUsage should use user's local date, not UTC."""
    # Mock timezone to MSK (UTC+3)
    with patch.object(timezone, 'now') as mock_now:
        # 2025-12-24 23:30:00 UTC = 2025-12-25 02:30:00 MSK
        mock_now.return_value = datetime(2025, 12, 24, 23, 30, tzinfo=dt_timezone.utc)
        
        from apps.billing.usage import DailyUsage
        
        usage = DailyUsage.objects.get_today(user)
        
        # В MSK уже 25 декабря!
        # Expected: usage.date == 2025-12-25 (local)
        # Actual (before fix): usage.date == 2025-12-24 (UTC)
```

---

## P1-3: grams vs amount_grams

### Test P1-3-A: KeyError check

**Target:** P1-3  
**Type:** Unit (pytest)

```python
@pytest.mark.django_db
def test_tasks_handles_amount_grams_correctly(user, meal):
    """Task should correctly handle amount_grams from _json_safe_items."""
    from apps.ai.tasks import recognize_food_async, _json_safe_items
    
    # _json_safe_items returns amount_grams (line 72)
    items = [{"name": "Test", "grams": 100, "calories": 100, "protein": 10, "fat": 5, "carbohydrates": 10}]
    safe = _json_safe_items(items)
    
    # Check it returns amount_grams
    assert "amount_grams" in safe[0]
    
    # Now check if task can use it
    # Line 167: grams=int(_clamp_grams(it["grams"]))  <-- KeyError!
    # Should be: grams=int(_clamp_grams(it["amount_grams"]))
```

---

## P1-4: Limit check before Meal creation

### Test P1-4-A: No orphan Meals on limit exceeded

**Target:** P1-4  
**Type:** Integration

```python
@pytest.mark.django_db
def test_meal_not_created_when_limit_exceeded(client, free_user):
    """When limit exceeded, Meal should NOT be created."""
    from apps.nutrition.models import Meal
    
    # Exhaust limit
    DailyUsage.objects.check_and_increment_if_allowed(free_user, limit=3, amount=3)
    
    initial_meal_count = Meal.objects.filter(user=free_user).count()
    
    response = client.post(
        "/api/v1/ai/recognize/",
        {"data_url": "data:image/jpeg;base64,..."},
        HTTP_X_TELEGRAM_INIT_DATA="..."
    )
    
    # Expected: 429, no new Meal
    assert response.status_code == 429
    assert Meal.objects.filter(user=free_user).count() == initial_meal_count
```

**Actual (before fix):** Meal создаётся даже при 429

---

## P1-5: DEBUG_MODE bypass

### Test P1-5-A: Debug mode disabled in production

**Target:** P1-5  
**Type:** Unit

```python
def test_debug_mode_requires_django_debug():
    """DEBUG_MODE_ENABLED should only work if settings.DEBUG=True."""
    from django.conf import settings
    from apps.telegram.telegram_auth import _is_telegram_admin
    
    # Simulate prod: DEBUG=False, DEBUG_MODE_ENABLED=True
    with patch.object(settings, 'DEBUG', False):
        with patch.object(settings, 'DEBUG_MODE_ENABLED', True):
            request = MagicMock()
            request.headers.get.return_value = "true"  # X-Debug-Mode: true
            
            result = _is_telegram_admin(request)
            
            # Expected: False (debug bypass should not work in prod)
            assert result is False
```

---

## Smoke Tests (Quick Verification)

### Smoke-1: AI Flow

```bash
# 1. Upload photo
curl -X POST "https://api.eatfit24.ru/api/v1/ai/recognize/" \
  -H "X-Telegram-Init-Data: ..." \
  -F "image=@food.jpg" \
  -F "meal_type=LUNCH"

# Expected: 202 with task_id

# 2. Poll status
curl "https://api.eatfit24.ru/api/v1/ai/task/{task_id}/"

# Expected: Processing → Success with items

# 3. Verify usage incremented
curl "https://api.eatfit24.ru/api/v1/billing/me/"

# Expected: used_today += 1
```

### Smoke-2: Billing Webhook

```bash
# Simulate YooKassa webhook (from allowed IP)
curl -X POST "https://api.eatfit24.ru/api/v1/billing/yookassa/webhook/" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "notification",
    "event": "payment.succeeded",
    "object": {"id": "test-payment-id", ...}
  }'

# Expected: 200 OK
# Check: Subscription activated, cache invalidated
```

---

## Test Execution Commands

```bash
# All unit tests
pytest backend/apps/ai/tests/ -v

# All billing tests
pytest backend/apps/billing/test_*.py -v

# Specific P0 tests (after adding)
pytest backend/apps/ai/tests/test_tasks.py::test_usage_incremented_after_success -v

# Coverage
pytest backend/apps/ --cov=apps --cov-report=html

# Quick sanity check
python -c "from apps.ai import views, tasks; from apps.billing import usage; print('All OK')"
```

---

## Summary

| Issue | Test ID | Type | Status |
|-------|---------|------|--------|
| P0-1 | P0-1-A | Unit | TO ADD |
| P0-1 | P0-1-B | Integration | TO ADD |
| P0-1 | P0-1-C | Curl | Manual |
| P0-2 | P0-2-A | Unit | TO ADD |
| P0-2 | P0-2-B | Shell | Manual |
| P0-3 | P0-3-A | Unit | TO ADD |
| P1-3 | P1-3-A | Unit | TO ADD |
| P1-4 | P1-4-A | Integration | TO ADD |
| P1-5 | P1-5-A | Unit | TO ADD |

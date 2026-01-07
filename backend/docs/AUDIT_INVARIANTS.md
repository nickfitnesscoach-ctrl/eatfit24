# 🔒 EatFit24 Data Invariants

> **Тип:** Приложение к AUDIT.md  
> **Дата:** 2025-12-24  
> **Scope:** FoodLog / Limits / Timezone / Billing

---

## Что такое инвариант?

Инвариант — это правило, которое **ВСЕГДА** должно быть истинным в системе.  
Нарушение инварианта = баг или corrupted data.

---

## 1. Nutrition / FoodLog Invariants

### INV-1: One Meal per (user, date, meal_type) не обязательно

| Attribute | Value |
|-----------|-------|
| **Statement** | Пользователь может иметь несколько Meal с одинаковыми (date, meal_type) |
| **Rationale** | Нет unique_together constraint. Можно добавить второй "завтрак" |
| **Current Status** | ✅ Работает по дизайну (не баг) |
| **Impact** | Можно создать 5 "завтраков" за один день |

```python
# Проверка: нет unique_together для (user, date, meal_type)
class Meal(models.Model):
    class Meta:
        # Нет: unique_together = [["user", "date", "meal_type"]]
        pass
```

---

### INV-2: Meal.total_* = сумма FoodItem.*

| Attribute | Value |
|-----------|-------|
| **Statement** | `Meal.total_calories` = `sum(item.calories for item in meal.items.all())` |
| **Current Status** | ✅ TRUE — реализовано как @property |
| **Location** | [models.py:68-86](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/nutrition/models.py#L68-L86) |

```python
@property
def total_calories(self):
    return sum(item.calories for item in self.items.all())
```

**⚠️ Potential Issue:** N+1 запросы если не использовать `prefetch_related('items')`.

---

### INV-3: FoodItem.grams >= 1

| Attribute | Value |
|-----------|-------|
| **Statement** | `grams` никогда не может быть 0 или отрицательным |
| **Enforcement** | `MinValueValidator(1)` на модели |
| **Location** | [models.py:116-118](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/nutrition/models.py#L116-L118) |
| **Current Status** | ✅ TRUE |

```python
grams = models.PositiveIntegerField(
    validators=[MinValueValidator(1)],
    verbose_name='Вес (граммы)'
)
```

---

### INV-4: FoodItem.calories/protein/fat/carbs >= 0

| Attribute | Value |
|-----------|-------|
| **Statement** | Макросы не могут быть отрицательными |
| **Enforcement** | `MinValueValidator(0)` + DecimalField |
| **Current Status** | ✅ TRUE |

---

## 2. Daily Usage / Limits Invariants

### INV-5: DailyUsage unique per (user, date)

| Attribute | Value |
|-----------|-------|
| **Statement** | Только одна запись использования на пользователя в день |
| **Enforcement** | `unique_together = [["user", "date"]]` |
| **Location** | [usage.py:169](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/billing/usage.py#L169) |
| **Current Status** | ✅ TRUE |

---

### INV-6: photo_ai_requests monotonically increases within day

| Attribute | Value |
|-----------|-------|
| **Statement** | Счётчик только растёт (или сбрасывается в 0 на новый день) |
| **Enforcement** | `F('photo_ai_requests') + amount` + select_for_update |
| **Current Status** | ✅ TRUE |

---

### INV-7: increment_photo_ai_requests called ONLY after AI success

| Attribute | Value |
|-----------|-------|
| **Statement** | Счётчик списывается только после успешного ответа AI |
| **Expected Enforcement** | Вызов в `tasks.py` после успешного сохранения |
| **Current Status** | ❌ **FALSE** — не вызывается в `tasks.py` |
| **Impact** | P0-1 bug: безлимитный AI для FREE users |

---

### INV-8: "Today" is consistent across system

| Attribute | Value |
|-----------|-------|
| **Statement** | Определение "сегодня" одинаково везде |
| **Expected** | `timezone.localdate()` везде |
| **Actual** | Микс `date.today()` и `timezone.now().date()` |
| **Current Status** | ❌ **FALSE** |
| **Locations** | |
| - usage.py:150 | `default=dt_date.today` (local, naive) |
| - usage.py:40 | `timezone.now().date()` (UTC-aware) |
| - serializers.py:162 | `timezone.localdate()` (local) |
| - users/models.py:241 | `date.today()` (local, naive) |

**Recommendation:** Унифицировать на `timezone.localdate()` везде.

---

## 3. Subscription / Billing Invariants

### INV-9: 1:1 User ↔ Subscription

| Attribute | Value |
|-----------|-------|
| **Statement** | У каждого пользователя ровно одна Subscription |
| **Enforcement** | `OneToOneField` + post_save signal |
| **Current Status** | ✅ TRUE |
| **Backup** | `ensure_subscription_exists()` в services.py |

---

### INV-10: FREE subscription never expires

| Attribute | Value |
|-----------|-------|
| **Statement** | `is_expired()` возвращает False для FREE |
| **Enforcement** | Проверка `plan.code == "FREE"` в is_expired() |
| **Location** | [models.py:209-217](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/billing/models.py#L209-L217) |
| **Current Status** | ✅ TRUE |

```python
def is_expired(self):
    if self.plan.code == "FREE":
        return False  # FREE никогда не истекает
    return self.end_date < timezone.now()
```

---

### INV-11: Payment amount comes from SubscriptionPlan.price

| Attribute | Value |
|-----------|-------|
| **Statement** | Цена никогда не приходит от клиента |
| **Enforcement** | `create_subscription_payment` берёт `plan.price` |
| **Location** | [services.py:346-350](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/billing/services.py#L346-L350) |
| **Current Status** | ✅ TRUE |

---

### INV-12: Subscription changes ONLY via webhook

| Attribute | Value |
|-----------|-------|
| **Statement** | Подписка меняется только через `handle_yookassa_event()` |
| **Exception** | Admin panel с осознанием последствий |
| **Current Status** | ✅ TRUE |

---

### INV-13: Webhook idempotency via status check

| Attribute | Value |
|-----------|-------|
| **Statement** | Повторный webhook не меняет состояние |
| **Enforcement** | Проверка `payment.status == "SUCCEEDED"` перед обработкой |
| **Location** | [handlers.py:98-100](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/billing/webhooks/handlers.py#L98-L100) |
| **Current Status** | ✅ TRUE |

```python
if payment.status == "SUCCEEDED":
    logger.info(f"[payment.succeeded] already processed: payment_id={payment.id}")
    return  # Идемпотентность
```

---

### INV-14: Plan cache invalidated on subscription change

| Attribute | Value |
|-----------|-------|
| **Statement** | После успешного webhook кеш плана сбрасывается |
| **Enforcement** | `invalidate_user_plan_cache(user_id)` |
| **Location** | [handlers.py:178](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/billing/webhooks/handlers.py#L178) |
| **Current Status** | ✅ TRUE |

---

## 4. AI Pipeline Invariants

### INV-15: AI Proxy called only from Celery

| Attribute | Value |
|-----------|-------|
| **Statement** | HTTP запросы к AI Proxy делаются только из Celery worker |
| **Rationale** | Долгие запросы (до 35 сек) не должны блокировать web worker |
| **Current Status** | ✅ TRUE (sync mode отключен флагом `AI_ASYNC_ENABLED`) |

---

### INV-16: Retry only on transient errors

| Attribute | Value |
|-----------|-------|
| **Statement** | Celery retry только на timeout/5xx, не на 4xx |
| **Enforcement** | Exception mapping в tasks.py |
| **Current Status** | ✅ TRUE |

```python
except (AIProxyTimeoutError, AIProxyServerError) as e:
    raise self.retry(exc=e)  # Retry

except AIProxyValidationError as e:
    raise  # No retry
```

---

### INV-17: Secrets never logged

| Attribute | Value |
|-----------|-------|
| **Statement** | API keys, tokens не выводятся в логи |
| **Enforcement** | Логируем только masked версии или request_id |
| **Current Status** | ✅ TRUE (manual review) |

---

## Summary

| Invariant | Status | Note |
|-----------|--------|------|
| INV-1 | ✅ Design | Multiple meals per type allowed |
| INV-2 | ✅ TRUE | Computed property |
| INV-3 | ✅ TRUE | Validator enforced |
| INV-4 | ✅ TRUE | Validator enforced |
| INV-5 | ✅ TRUE | unique_together |
| INV-6 | ✅ TRUE | Atomic increment |
| INV-7 | ❌ FALSE | **P0-1 bug** |
| INV-8 | ❌ FALSE | **P0-3 bug** |
| INV-9 | ✅ TRUE | OneToOneField |
| INV-10 | ✅ TRUE | Code check |
| INV-11 | ✅ TRUE | Server-side only |
| INV-12 | ✅ TRUE | Webhook-first |
| INV-13 | ✅ TRUE | Status check |
| INV-14 | ✅ TRUE | Cache invalidation |
| INV-15 | ✅ TRUE | Celery only |
| INV-16 | ✅ TRUE | Exception mapping |
| INV-17 | ✅ TRUE | Manual review |

**Broken Invariants:** 2 (INV-7, INV-8) — both are P0 issues.

# Модели и БД — Аудит

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer

---

## Обзор моделей

| Модель | Таблица | Назначение |
|--------|---------|------------|
| `SubscriptionPlan` | `subscription_plans` | Тарифные планы (FREE, PRO_MONTHLY, etc.) |
| `Subscription` | `subscriptions` | Подписка пользователя (1:1 с User) |
| `Payment` | `payments` | Платежи (UUID PK) |
| `Refund` | `refunds` | Возвраты (FK → Payment) |
| `WebhookLog` | `webhook_logs` | Логирование webhook (UUID PK) |

---

## Анализ моделей

### SubscriptionPlan

**Критические поля:**
- `code` — UNIQUE, основной идентификатор (SSOT)
- `name` — UNIQUE, NULLABLE (legacy)
- `price` — Decimal(10,2), цена из БД (не с фронта!)
- `duration_days` — длительность подписки

**✓ Хорошо:**
- `is_test=True` для тестовых планов — блокирует доступ в обычном API
- `is_active` — мягкое удаление планов

**⚠ Внимание:**
- `name` поле legacy, но всё ещё UNIQUE — может привести к конфликтам
- `max_photos_per_day` vs `daily_photo_limit` — дублирование логики

---

### Subscription

**Критические поля:**
- `user` — OneToOne (CASCADE)
- `plan` — FK (PROTECT)
- `yookassa_payment_method_id` — сохранённая карта для recurring
- `auto_renew` — флаг автопродления

**✓ Хорошо:**
- `OneToOneField` гарантирует 1 подписку на пользователя
- `PROTECT` на plan предотвращает случайное удаление тарифа
- Индекс на `[is_active, end_date]`

---

### Payment

**Критические поля:**
- `id` — UUID (хорошо для безопасности)
- `yookassa_payment_id` — UNIQUE, связь с YooKassa
- `status` — состояние платежа
- `webhook_processed_at` — метка идемпотентности

**Статусы и переходы:**
```
PENDING → WAITING_FOR_CAPTURE → SUCCEEDED → REFUNDED
       └→ CANCELED
       └→ FAILED
```

**⚠ Проблемы:**

### P1-DB-01: Отсутствует unique constraint на webhook_processed_at
- **Где**: `Payment.webhook_processed_at`
- **Проблема**: Поле используется для идемпотентности, но не защищено от race condition
- **Сценарий**: Два параллельных webhook с одинаковым payment_id
- **Последствия**: Потенциально двойная обработка
- **Рекомендация**: Использовать `select_for_update()` (уже сделано в handlers.py ✓)
- **Сложность**: N/A (уже защищено)

### P2-DB-02: Nullable FK subscription в Payment
- **Где**: `Payment.subscription = FK(null=True)`
- **Проблема**: Payment может не иметь subscription
- **Последствия**: При обработке webhook — NullPointerException если не проверять
- **Рекомендация**: В handlers.py уже обрабатывается (не делается `select_related("subscription")`)
- **Сложность**: N/A (workaround в коде)

### P2-DB-03: Nullable FK plan в Payment
- **Где**: `Payment.plan = FK(null=True)`
- **Проблема**: Payment может не иметь plan
- **Последствия**: В handlers.py есть проверка `if not payment.plan: raise ValueError`
- **Рекомендация**: При создании Payment всегда требовать plan
- **Сложность**: S

---

### WebhookLog

**Критические поля:**
- `event_id` — ID события (используется как idempotency key)
- `payment_id` — связь с Payment (nullable)
- `status` — RECEIVED → QUEUED → PROCESSING → SUCCESS/FAILED/DUPLICATE

**⚠ Проблемы:**

### P1-DB-04: event_id не UNIQUE
- **Где**: `WebhookLog.event_id`
- **Проблема**: Поле индексировано (`db_index=True`), но НЕ unique
- **Сценарий**: Параллельные webhook requests могут создать дубликаты
- **Последствия**: `get_or_create` может создать duplicates при race condition
- **Рекомендация**: Добавить `unique=True` или использовать `unique_together`
- **Текущая защита**: `select_for_update()` в views.py ✓
- **Сложность**: S (миграция)

---

### Refund

**Поля:**
- `yookassa_refund_id` — UNIQUE
- `payment` — FK (CASCADE)

**✓ Хорошо:**
- UNIQUE на `yookassa_refund_id` — идемпотентность на уровне БД

---

## Race Conditions

### Сценарий 1: Параллельные webhook на один Payment

**Поток:**
```
T1: SELECT Payment WHERE yookassa_payment_id='xxx'
T2: SELECT Payment WHERE yookassa_payment_id='xxx'
T1: UPDATE Payment SET status='SUCCEEDED'
T2: UPDATE Payment SET status='SUCCEEDED'  ← Duplicate update
```

**Защита:** ✓ `select_for_update()` в handlers.py
```python
payment = Payment.objects.select_for_update().get(yookassa_payment_id=yk_payment_id)
```

**Статус:** ЗАЩИЩЕНО

---

### Сценарий 2: Параллельная регистрация + автопродление

**Поток:**
```
T1: User делает ручную оплату
T2: Cron запускает автопродление для того же user
```

**Защита:** ✓ Проверка pending платежей в `process_recurring_payments.py`:
```python
has_pending = Payment.objects.filter(subscription=locked_sub, is_recurring=True, status__in=["PENDING", "WAITING_FOR_CAPTURE"], created_at__gte=day_ago).exists()
```

**Статус:** ЗАЩИЩЕНО (24-часовое окно)

---

### Сценарий 3: Параллельные WebhookLog записи

**Поток:**
```
T1: get_or_create(event_id='xxx')
T2: get_or_create(event_id='xxx')
```

**Защита:** ✓ `select_for_update()` на WebhookLog:
```python
WebhookLog.objects.select_for_update().get_or_create(event_id=idempotency_key, ...)
```

**Статус:** ЗАЩИЩЕНО

---

## Индексы

| Таблица | Индексы |
|---------|---------|
| `subscriptions` | `[is_active, end_date]` |
| `payments` | `[-created_at]`, `[status]`, `[yookassa_payment_id]` |
| `webhook_logs` | `[-created_at]`, `[status]`, `[event_id]`, `[payment_id]` |

**✓ Хорошо:** Основные query paths покрыты индексами

---

## Переходы статусов

### Payment State Machine

```
                          ┌─────────────────┐
                          │     PENDING     │ ← создание платежа
                          └────────┬────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼                ▼                ▼
          ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
          │   CANCELED    │ │ WAITING_FOR_  │ │    FAILED     │
          │               │ │    CAPTURE    │ │               │
          └───────────────┘ └───────┬───────┘ └───────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │   SUCCEEDED     │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │    REFUNDED     │
                          └─────────────────┘
```

**Валидные переходы в handlers.py:**
- `PENDING → SUCCEEDED` ✓
- `PENDING → CANCELED` ✓
- `PENDING → WAITING_FOR_CAPTURE` ✓
- `WAITING_FOR_CAPTURE → SUCCEEDED` ✓
- `SUCCEEDED → REFUNDED` ✓

**Невалидные переходы (игнорируются):**
- `SUCCEEDED → CANCELED` ← логируется, не ломается
- `REFUNDED → SUCCEEDED` ← логируется, не ломается

**Статус:** ✓ Обработка идемпотентна, невалидные переходы игнорируются

---

## Идемпотентность на уровне БД

| Операция | Механизм защиты | Статус |
|----------|-----------------|--------|
| Webhook dedup | `WebhookLog.event_id` + `select_for_update()` | ✓ |
| Payment duplicate | `Payment.yookassa_payment_id` UNIQUE | ✓ |
| Refund duplicate | `Refund.yookassa_refund_id` UNIQUE | ✓ |
| Recurring anti-dupe | Проверка pending за 24h | ✓ |

---

## Рекомендации

### P2-DB-05: Добавить unique constraint на WebhookLog.event_id
```python
# models.py
event_id = models.CharField(..., unique=True)

# или
class Meta:
    constraints = [
        models.UniqueConstraint(fields=['event_id'], name='unique_event_id')
    ]
```
**Сложность:** S (миграция)

### P2-DB-06: Рассмотреть NOT NULL для Payment.plan
```python
plan = models.ForeignKey(..., null=False)
```
**Сложность:** M (требует данных-миграции для существующих записей)

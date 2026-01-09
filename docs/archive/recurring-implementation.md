# Recurring Subscriptions Implementation

Автопродление подписок через YooKassa API.

## Статус

Implemented: 2026-01-08

## Обзор

Система автопродления работает по принципу:
1. При первом платеже сохраняется `payment_method` (карта)
2. За 24 часа до окончания подписки система создаёт рекуррентный платёж
3. Webhook от YooKassa продлевает подписку (как обычно)

## P0-A: Сохранение payment_method

### Что реализовано

**Файл:** `backend/apps/billing/webhooks/handlers.py`

**Функция:** `_handle_payment_succeeded()`

**Логика:**

1. Извлекаем `payment_method` из webhook payload:
   - `payment_method.id`
   - `payment_method.saved` (ВАЖНО: проверяем этот флаг)
   - `payment_method.card.last4`
   - `payment_method.card.card_type`

2. Сохраняем в `Payment`:
   ```python
   if payment.save_payment_method and payment_method_id and payment_method_saved:
       payment.yookassa_payment_method_id = payment_method_id
   ```

3. Сохраняем в `Subscription` (ТОЛЬКО для НЕ recurring платежей):
   ```python
   if (
       not payment.is_recurring
       and payment.save_payment_method
       and payment_method_id
       and payment_method_saved
   ):
       subscription.yookassa_payment_method_id = payment_method_id
       subscription.card_mask = f"•••• {last4}"
       subscription.card_brand = card_type
       subscription.auto_renew = True  # Включаем автопродление
   ```

**Почему проверяем `payment_method.saved`?**

YooKassa может НЕ сохранить карту (например, если карта не поддерживает рекуррентные платежи).
В этом случае `payment_method.saved = false`, и мы НЕ должны включать автопродление.

**Почему НЕ обновляем Subscription для recurring платежей?**

Для recurring платежей `payment_method` уже сохранён при первом платеже.
Обновление не нужно — это избыточная операция.

### Acceptance Criteria

✅ AC-1: После webhook payment.succeeded с `save_payment_method=true` и `saved=true`:
- `subscription.yookassa_payment_method_id` установлен
- `subscription.card_mask` = "•••• 1234"
- `subscription.card_brand` in ["Visa", "MasterCard", "МИР"]
- `subscription.auto_renew = True`

### Тесты

```bash
pytest apps/billing/tests/test_recurring_implementation.py::TestP0APaymentMethodSaving -v
```

- `test_payment_method_saved_on_first_payment_success` — проверяет AC-1
- `test_payment_method_not_saved_if_saved_false` — проверяет, что при `saved=False` карта НЕ сохраняется
- `test_recurring_payment_does_not_update_subscription_payment_method` — проверяет, что recurring платежи НЕ обновляют Subscription

---

## P0-B: Recurring processing guard

### Что реализовано

**Файл:** `backend/apps/billing/tasks_recurring.py`

**Функция:** `_process_single_renewal()`

**DB Guard** (строки 130-143):

```python
existing_payment = Payment.objects.filter(
    subscription=sub,
    billing_period_end=billing_period_end,
    status__in=["PENDING", "SUCCEEDED"],
).exists()

if existing_payment:
    logger.debug("Skipping sub_id=%s: payment already exists", sub.id)
    return "skipped"
```

**Idempotency key для YooKassa:**

```python
idempotency_key = f"renewal:{sub.id}:{billing_period_end.date().isoformat()}"
```

Это детерминированный ключ. При повторном вызове YooKassa вернёт тот же платёж (не создаст дубль).

**Почему 2 уровня защиты?**

1. **DB guard (primary):** Быстрая проверка, избегает лишних запросов к YooKassa
2. **YooKassa idempotency_key (fallback):** Защита на уровне payment gateway

### Индекс для производительности

**Файл:** `backend/apps/billing/models.py` (строка 380)

```python
models.Index(fields=["subscription", "billing_period_end", "status"])
```

Этот индекс обеспечивает O(1) проверку `existing_payment.exists()`.

### Acceptance Criteria

✅ AC-3: Guard от дублей работает:
- `process_due_renewals` запущен дважды → создан ТОЛЬКО 1 Payment
- DB guard срабатывает ДО вызова YooKassa
- Idempotency key детерминированный

### Тесты

```bash
pytest apps/billing/tests/test_recurring_implementation.py::TestP0BRecurringGuard -v
```

- `test_db_guard_prevents_duplicate_payment_creation` — проверяет AC-3
- `test_db_guard_allows_payment_if_previous_failed` — проверяет, что guard НЕ блокирует retry после FAILED
- `test_idempotency_key_format` — проверяет формат ключа

---

## P0-C: Обработка payment.canceled

### Что реализовано

**Файл:** `backend/apps/billing/webhooks/handlers.py`

**Функции:**
- `_handle_payment_canceled()` — основной обработчик
- `_handle_recurring_cancellation()` — бизнес-логика для recurring платежей

**Логика:**

1. Извлекаем `cancellation_details.reason` из payload
2. Сохраняем `Payment.status = CANCELED` + `error_message`
3. Если `payment.is_recurring` → обрабатываем cancellation:

**Permanent failures** (выключаем auto_renew):
- `permission_revoked` — пользователь отозвал разрешение
- `card_expired` — карта истекла

```python
subscription.auto_renew = False
subscription.yookassa_payment_method_id = None
subscription.card_mask = None
subscription.card_brand = None
```

**Temporary failures** (НЕ выключаем auto_renew):
- `insufficient_funds` — недостаточно средств (разрешаем retry через 24h)
- `3d_secure_failed` — не прошла 3DS
- `general_decline` — общий отказ банка

### Acceptance Criteria

✅ AC-4: Идемпотентность webhook:
- Повторный webhook `payment.canceled` — no-op
- Состояние не ломается

✅ Обработка cancellation_details.reason:
- `permission_revoked`, `card_expired` → auto_renew выключен
- `insufficient_funds` → auto_renew остаётся включённым (разрешаем retry)

### Тесты

```bash
pytest apps/billing/tests/test_recurring_implementation.py::TestP0CPaymentCanceled -v
```

- `test_permission_revoked_disables_auto_renew`
- `test_card_expired_disables_auto_renew`
- `test_insufficient_funds_keeps_auto_renew_enabled`
- `test_other_cancellation_reasons_keep_auto_renew`
- `test_non_recurring_payment_canceled_ignores_cancellation_logic`

---

## Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│                   RECURRING PAYMENT FLOW                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [User pays first time]                                      │
│         │                                                     │
│         ▼                                                     │
│  [payment.succeeded webhook]                                 │
│         │                                                     │
│         ├─► Payment.yookassa_payment_method_id = saved       │
│         ├─► Subscription.yookassa_payment_method_id = saved  │
│         ├─► Subscription.card_mask = "•••• 1234"            │
│         ├─► Subscription.card_brand = "Visa"                │
│         └─► Subscription.auto_renew = True                   │
│                                                              │
│  [24h before end_date]                                       │
│         │                                                     │
│         ▼                                                     │
│  [Celery: process_due_renewals]                             │
│         │                                                     │
│         ├─► DB Guard: check existing payment                 │
│         ├─► YooKassa: create_recurring_payment()            │
│         └─► Payment(PENDING, is_recurring=True)             │
│                                                              │
│  [YooKassa charges card]                                     │
│         │                                                     │
│         ├── SUCCESS ──► [payment.succeeded webhook]          │
│         │                     │                              │
│         │                     ▼                              │
│         │              [Subscription extended]               │
│         │                                                     │
│         └── FAILURE ──► [payment.canceled webhook]           │
│                               │                              │
│                               ▼                              │
│                   [Check cancellation_details.reason]        │
│                               │                              │
│                   ├── permission_revoked ──► auto_renew=False│
│                   ├── card_expired ──► auto_renew=False      │
│                   └── insufficient_funds ──► retry allowed   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Feature Flag

```bash
# .env
BILLING_RECURRING_ENABLED=true
```

Если `BILLING_RECURRING_ENABLED=false`:
- `process_due_renewals` возвращает `{"status": "disabled"}`
- Первые платежи НЕ сохраняют `payment_method` (безопасное поведение)

---

## Celery Schedule

**Файл:** `config/celery.py`

```python
app.conf.beat_schedule = {
    "billing-process-due-renewals": {
        "task": "apps.billing.tasks_recurring.process_due_renewals",
        "schedule": crontab(minute=0),  # Каждый час
        "options": {"queue": "billing"},
    },
}
```

**Renewal window:** 24 часа до истечения подписки.

**Retry strategy:**
- 1-й раз: сразу при истечении окна
- 2-й раз: через 1 час (если первый failed)
- 3-й раз: через 2 часа
- и т.д. до истечения подписки

---

## Security

### 1. Цена ТОЛЬКО из БД

```python
# tasks_recurring.py
amount = plan.price  # НИКОГДА не из фронта!
duration_days = plan.duration_days
```

### 2. Webhook = source of truth

Подписка продлевается ТОЛЬКО после `payment.succeeded` webhook.

Task `process_due_renewals` НЕ продлевает подписку напрямую.

### 3. Двойная защита от дублей

- DB guard: `Payment(subscription, billing_period_end, status=PENDING/SUCCEEDED).exists()`
- YooKassa idempotency_key: `"renewal:{sub.id}:{date}"`

---

## Observability

### Логи

```bash
# Поиск по trace_id
docker logs eatfit24-backend-1 | grep "trace_id=abc12345"

# Recurring processing
docker logs eatfit24-celery-worker-1 | grep "\[RECURRING\]"

# Cancellation обработка
docker logs eatfit24-celery-worker-1 | grep "\[RECURRING_CANCEL\]"
```

### Мониторинг

```bash
# Проверить pending recurring платежи
docker exec eatfit24-db psql -U eatfit24 -c "
  SELECT id, user_id, status, is_recurring, billing_period_end
  FROM payments
  WHERE is_recurring = true AND status = 'PENDING'
  ORDER BY created_at DESC
  LIMIT 10;
"

# Проверить подписки с auto_renew
docker exec eatfit24-db psql -U eatfit24 -c "
  SELECT id, user_id, auto_renew, yookassa_payment_method_id, card_mask, end_date
  FROM subscriptions
  WHERE auto_renew = true
  ORDER BY end_date ASC
  LIMIT 10;
"
```

---

## YooKassa API Fields

### payment.succeeded payload

```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "payment_id",
    "status": "succeeded",
    "payment_method": {
      "id": "pm_abc123",
      "type": "bank_card",
      "saved": true,  ← ВАЖНО: проверяем этот флаг
      "card": {
        "last4": "1234",
        "card_type": "MasterCard"
      }
    }
  }
}
```

### payment.canceled payload

```json
{
  "type": "notification",
  "event": "payment.canceled",
  "object": {
    "id": "payment_id",
    "status": "canceled",
    "cancellation_details": {
      "reason": "permission_revoked"  ← Причина отмены
    }
  }
}
```

### Cancellation reasons (from YooKassa docs)

| Reason | Описание | Auto-renew |
|--------|----------|------------|
| `permission_revoked` | Пользователь отозвал разрешение | Выключаем |
| `card_expired` | Карта истекла | Выключаем |
| `insufficient_funds` | Недостаточно средств | Оставляем (retry) |
| `3d_secure_failed` | Не прошла 3DS | Оставляем (retry) |
| `call_issuer` | Нужно связаться с банком | Оставляем (retry) |
| `general_decline` | Общий отказ банка | Оставляем (retry) |

---

## Operational Procedures

### Включение автопродления (manual)

```python
# Django shell
from apps.billing.models import Subscription

sub = Subscription.objects.get(user_id=123)
sub.auto_renew = True
sub.yookassa_payment_method_id = "pm-abc123"  # Если карта уже сохранена
sub.card_mask = "•••• 1234"
sub.card_brand = "Visa"
sub.save()
```

### Выключение автопродления (manual)

```python
sub.auto_renew = False
sub.yookassa_payment_method_id = None
sub.card_mask = None
sub.card_brand = None
sub.save()
```

### Проверка recurring readiness

```bash
# Подписки, готовые к автопродлению
docker exec eatfit24-db psql -U eatfit24 -c "
  SELECT
    s.id,
    s.user_id,
    s.auto_renew,
    s.yookassa_payment_method_id IS NOT NULL as has_payment_method,
    s.end_date,
    p.code as plan_code
  FROM subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE
    s.is_active = true
    AND s.auto_renew = true
    AND s.yookassa_payment_method_id IS NOT NULL
    AND p.code != 'FREE'
    AND s.end_date <= NOW() + INTERVAL '24 hours'
  ORDER BY s.end_date ASC;
"
```

---

## Troubleshooting

### Webhook пришёл, но карта не сохранилась

**Возможные причины:**

1. `payment_method.saved = false` в payload
   - YooKassa не смогла сохранить карту (карта не поддерживает рекуррентные платежи)
   - Проверь логи: `grep "payment_method_saved" logs`

2. `save_payment_method = False` на Payment
   - Проверь: `Payment.objects.get(yookassa_payment_id=...).save_payment_method`

3. `is_recurring = True` на Payment
   - Для recurring платежей мы НЕ обновляем Subscription (это ожидаемое поведение)

### Recurring платёж создаётся дважды

**Проверь:**

1. DB guard работает:
   ```python
   Payment.objects.filter(
       subscription=sub,
       billing_period_end=sub.end_date,
       status__in=["PENDING", "SUCCEEDED"]
   ).count()  # Должно быть <= 1
   ```

2. Индекс существует:
   ```bash
   docker exec eatfit24-db psql -U eatfit24 -c "\d payments"
   # Должен быть: payments_subscription_id_billing_period_end_status_idx
   ```

### Auto-renew выключается без причины

**Проверь логи cancellation:**

```bash
docker logs eatfit24-celery-worker-1 | grep "\[RECURRING_CANCEL\]"
```

Если `reason = permission_revoked` или `card_expired` — это ожидаемое поведение.

---

## Tests Summary

```bash
# Все тесты recurring
pytest apps/billing/tests/test_recurring_implementation.py -v

# Все тесты billing
pytest apps/billing/tests/ -v

# Coverage
pytest apps/billing/tests/test_recurring_implementation.py --cov=apps.billing.webhooks.handlers --cov=apps.billing.tasks_recurring
```

**Total tests:** 16

**Coverage:**
- P0-A: 6 tests
- P0-B: 3 tests
- P0-C: 5 tests
- Idempotency: 2 tests

---

## Next Steps (Future)

1. **User API для toggle auto-renew**
   - POST /api/v1/billing/toggle-auto-renew/
   - Валидация: нельзя включить auto_renew без payment_method

2. **Telegram уведомления пользователям**
   - За 3 дня до истечения: "Ваша подписка истекает"
   - При успешном продлении: "Подписка продлена"
   - При неудачном продлении: "Проверьте карту"

3. **Retry strategy для insufficient_funds**
   - 1-й retry: через 24 часа
   - 2-й retry: через 48 часов
   - 3-й retry: через 72 часа
   - После 3 неудач: выключить auto_renew + уведомить пользователя

4. **Monitoring dashboard**
   - Grafana: метрики recurring платежей
   - Alert: если > 50% recurring платежей failed

---

## References

- `backend/apps/billing/docs/payment-flow.md` — Общий поток платежей
- `backend/apps/billing/docs/webhooks.md` — Webhook архитектура
- `backend/apps/billing/docs/security.md` — Security constraints
- YooKassa API Docs: https://yookassa.ru/developers/api

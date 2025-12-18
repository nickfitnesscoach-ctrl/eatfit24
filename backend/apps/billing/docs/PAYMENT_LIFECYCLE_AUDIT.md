# Payment Lifecycle — Аудит

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer

---

## Обзор Lifecycle

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          PAYMENT LIFECYCLE                                    │
└───────────────────────────────────────────────────────────────────────────────┘

1. CREATE PAYMENT
   Frontend → POST /billing/create-payment/ {plan_code}
   └→ Payment (PENDING) + yookassa_payment_id
   └→ Return confirmation_url

2. USER PAYS
   User → YooKassa payment page
   └→ Enters card details
   └→ 3D Secure (if required)

3. WEBHOOK
   YooKassa → POST /billing/webhooks/yookassa
   └→ payment.succeeded / payment.canceled

4. PROCESS SUCCEEDED
   Payment → SUCCEEDED
   └→ Subscription extended
   └→ Cache invalidated

5. AUTO-RENEW (cron)
   Command → process_recurring_payments
   └→ Find subscriptions expiring soon
   └→ Create recurring Payment (PENDING)
   └→ Webhook flow continues...

6. CLEANUP (cron)
   Command → cleanup_expired_subscriptions
   └→ Find expired subscriptions
   └→ Move to FREE plan
```

---

## Пошаговый разбор

### 1. Создание платежа

**Файл:** `views.py:create_payment()`

```python
plan_code = request.data.get("plan_code")
return_url = _validate_return_url(request.data.get("return_url"), request)
payment, confirmation_url = _create_subscription_payment_core(
    user=request.user,
    plan_code=plan_code,
    return_url=return_url,
    save_payment_method=True,
)
```

**Проверки:**
- ✓ `plan_code` обязателен
- ✓ `return_url` валидируется (whitelist доменов)
- ✓ `is_test=True` планы блокируются в `get_subscription_plans()`
- ✓ Цена берётся из БД, не с фронта
- ✓ Throttling: 20 req/hour

**Создаётся:**
- `Payment` (status=PENDING)
- Вызов YooKassa API
- `yookassa_payment_id` сохраняется

**Возвращается:**
```json
{
  "payment_id": "uuid",
  "yookassa_payment_id": "yk-xxx",
  "confirmation_url": "https://yookassa.ru/..."
}
```

---

### 2. Ожидание оплаты

**Статус Payment:** PENDING

**Что происходит:**
- Пользователь на странице YooKassa
- Вводит карту
- Проходит 3DS

**Возможные исходы:**
- Успешная оплата → `payment.succeeded` webhook
- Отмена пользователем → `payment.canceled` webhook
- Timeout (15-30 мин) → `payment.canceled` webhook

---

### 3. Webhook: payment.succeeded

**Файл:** `webhooks/handlers.py:_handle_payment_succeeded()`

**Шаги:**

1. **Найти Payment**
   ```python
   payment = Payment.objects.select_for_update()
       .select_related("user", "plan")
       .get(yookassa_payment_id=yk_payment_id)
   ```

2. **Проверить идемпотентность**
   ```python
   if payment.status == "SUCCEEDED":
       return  # Already processed
   ```

3. **Обновить Payment**
   ```python
   payment.status = "SUCCEEDED"
   payment.paid_at = timezone.now()
   payment.webhook_processed_at = timezone.now()
   payment.save()
   ```

4. **Сохранить payment_method (если разрешено)**
   ```python
   if payment.save_payment_method and payment_method_id:
       payment.yookassa_payment_method_id = payment_method_id
   ```

5. **Продлить подписку**
   ```python
   subscription = activate_or_extend_subscription(
       user=payment.user,
       plan_code=plan.code,
       duration_days=plan.duration_days,
   )
   ```

6. **Обновить Subscription**
   ```python
   subscription.yookassa_payment_method_id = payment_method_id
   subscription.card_mask = card_mask
   subscription.auto_renew = True
   subscription.save()
   ```

7. **Инвалидировать кеш**
   ```python
   invalidate_user_plan_cache(payment.user_id)
   ```

---

### 4. Обновление Payment

**Поля обновляемые при SUCCEEDED:**
- `status` → SUCCEEDED
- `paid_at` → now()
- `webhook_processed_at` → now()
- `yookassa_payment_method_id` → сохранённый метод

**Индексы используемые:**
- `yookassa_payment_id` — для поиска Payment

---

### 5. Обновление Subscription

**Логика в `services.py:activate_or_extend_subscription()`:**

```python
if sub.plan.code == "FREE":
    # Переход с FREE: start from now
    sub.start_date = now
    sub.end_date = now + timedelta(days=duration_days)
else:
    if sub.is_expired():
        # Истёкшая: start from now
        sub.start_date = now
        sub.end_date = now + timedelta(days=duration_days)
    else:
        # Активная: extend
        sub.end_date += timedelta(days=duration_days)

sub.plan = plan
sub.is_active = True
sub.save()
```

**✓ Хорошо:** Логика extend корректная

---

### 6. Автопродление

**Файл:** `management/commands/process_recurring_payments.py`

**Запуск:** Cron (рекомендуется 1 раз в день)

**Логика:**

1. Найти подписки:
   - `auto_renew=True`
   - `is_active=True`
   - `end_date` ≤ now + N дней
   - `yookassa_payment_method_id` не null
   - `plan.code != "FREE"`

2. Для каждой подписки:
   - Lock (`select_for_update`)
   - Проверить нет ли pending платежа за 24h
   - Создать Payment (PENDING, is_recurring=True)
   - Вызвать YooKassa API (recurring payment)
   - Сохранить yookassa_payment_id

3. Webhook flow → активация

---

### 7. Отмена / Refund

**payment.canceled:**
```python
if payment.status in {"SUCCEEDED", "REFUNDED"}:
    return  # Не откатываем успешное

payment.status = "CANCELED"
payment.save()
```

**refund.succeeded:**
```python
Refund.objects.get_or_create(yookassa_refund_id=yk_refund_id, ...)
payment.status = "REFUNDED"
payment.save()
```

**⚠ Важно:** Refund НЕ отменяет подписку автоматически. Это бизнес-решение.

---

## Edge Cases

### Payment не найден

**Сценарий:** YooKassa прислала webhook для payment, которого нет в БД

**Текущее поведение:**
```python
payment = Payment.objects.get(yookassa_payment_id=yk_payment_id)
# → DoesNotExist → Exception → Task retry → Eventually FAILED
```

**Рекомендация:** Ловить DoesNotExist, логировать CRITICAL, возвращаться

### Plan не найден

**Сценарий:** Payment.plan=None (не должно происходить)

**Текущее поведение:**
```python
if not payment.plan:
    raise ValueError("Payment has no plan")
```

**Статус:** ✓ Защищено

### Duration = 0

**Сценарий:** План с duration_days=0

**Текущее поведение:**
```python
if duration_days <= 0:
    raise ValueError("Invalid duration_days")
```

**Статус:** ✓ Защищено

---

## Возможные несогласованные состояния

### State 1: Payment SUCCEEDED, Subscription не обновлена

**Как это происходит:**
1. Payment помечен SUCCEEDED
2. activate_or_extend_subscription() падает
3. Транзакция откатывается
4. НО Payment уже помечен SUCCEEDED (в той же транзакции)

**Статус:** ✓ НЕ МОЖЕТ ПРОИЗОЙТИ — всё в одной транзакции

### State 2: PENDING "залипший"

**Как это происходит:**
1. Платёж создан
2. Webhook не дошёл (firewall, wrong URL)
3. Payment остаётся PENDING навсегда

**Рекомендация:** Периодический job для проверки PENDING > 1 час

### State 3: Subscription карта vs Payment карта рассинхронизированы

**Как это происходит:**
1. Webhook 1: сохраняем card_mask="1234"
2. Webhook 2 (другой платёж): сохраняем card_mask="5678"
3. Всё ок, последняя карта актуальна

**Статус:** ✓ Ожидаемое поведение

---

## Где логика размазана

| Логика | Файлы |
|--------|-------|
| Создание платежа | `views.py`, `services.py` |
| Активация подписки | `services.py`, `webhooks/handlers.py` |
| Определение FREE плана | `views.py`, `services.py`, management commands (дублирование!) |
| Валидация plan_code | `views.py`, `services.py` (дублирование!) |

**Рекомендация:** Вынести `_get_free_plan()` в одно место (уже есть в services, использовать везде)

---

## Проблемы

### P2-PL-01: Нет timeout для PENDING платежей
- **Где**: N/A
- **Проблема**: PENDING платежи могут существовать вечно
- **Последствия**: Замусоривание БД, путаница
- **Рекомендация**: Cron job для перевода PENDING > 24h → CANCELED
- **Сложность**: S

### P2-PL-02: Refund не откатывает подписку
- **Где**: `webhooks/handlers.py:_handle_refund_succeeded()`
- **Проблема**: После полного refund пользователь остаётся с активной подпиской
- **Последствия**: Бесплатный доступ
- **Рекомендация**: Бизнес-решение: автоматический откат или ручное оповещение
- **Сложность**: M

### P2-PL-03: card_type берётся некорректно
- **Где**: `webhooks/handlers.py:_extract_payment_method_info()`
- **Проблема**: `card.get("card_type") or card.get("issuer_country")` — бренд и страна это разное
- **Последствия**: Visa может отображаться как "RU"
- **Рекомендация**: Использовать `card.get("card_type")` или `payment_method.get("title")`
- **Сложность**: S

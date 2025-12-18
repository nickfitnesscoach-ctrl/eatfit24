# 🐛 FOR UPDATE Bug Analysis & Solutions

## 📋 Описание проблемы

### Ошибка PostgreSQL
```
FOR UPDATE cannot be applied to the nullable side of an outer join
```

### Где возникает
**Файл:** `apps/billing/webhooks/handlers.py`

**Проблемный код (строки 86-89):**
```python
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan", "subscription")  # ← subscription is nullable!
    .get(yookassa_payment_id=yk_payment_id)
)
```

### Причина
В модели `Payment` поле `subscription` имеет `null=True, blank=True`:
```python
class Payment(models.Model):
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        related_name="payments",
        verbose_name="Подписка",
        null=True,          # ← Nullable field!
        blank=True,
    )
```

Когда Django выполняет `.select_related("subscription")` на nullable ForeignKey, он использует **LEFT OUTER JOIN**. PostgreSQL **не позволяет** применять `FOR UPDATE` на nullable стороне outer join по соображениям консистентности данных.

### Последствия
- ❌ **payment.succeeded webhook НЕ РАБОТАЕТ**
- ❌ Оплаты не обрабатываются
- ❌ Подписки не активируются/продлеваются
- ✅ Webhook endpoint принимает события (200 OK)
- ✅ События логируются в WebhookLog
- ❌ Celery task падает с ошибкой при обработке

**Статус:** 🔴 **КРИТИЧНО** - оплата полностью сломана!

---

## 💡 Варианты решения

### ✅ Вариант 1: Убрать subscription из select_related (РЕКОМЕНДУЕТСЯ)

**Описание:**
Убрать `"subscription"` из списка `select_related`, так как это поле:
1. Nullable (не всегда нужно)
2. Не используется напрямую в `_handle_payment_succeeded`
3. Если нужно - будет подгружено отдельным запросом

**Реализация:**
```python
# БЫЛО:
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan", "subscription")
    .get(yookassa_payment_id=yk_payment_id)
)

# СТАЛО:
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan")  # убрали subscription
    .get(yookassa_payment_id=yk_payment_id)
)
```

**Плюсы:**
- ✅ Простое и безопасное решение
- ✅ Никаких изменений в логике
- ✅ Работает во всех случаях
- ✅ Минимальный impact на производительность (1 дополнительный запрос, если subscription используется)

**Минусы:**
- ⚠️ Если где-то в коде используется `payment.subscription`, будет дополнительный запрос (но в текущем коде не используется в критичных местах)

**Применить к:**
- ✅ `_handle_payment_succeeded` (строка 87-88)
- ✅ Остальные handlers используют только `.select_for_update()` без `.select_related()` - ОК!

---

### ⚠️ Вариант 2: Использовать prefetch_related вместо select_related

**Описание:**
Заменить `.select_related("subscription")` на `.prefetch_related("subscription")`.
`prefetch_related` делает отдельный запрос без JOIN, поэтому не вызывает ошибку.

**Реализация:**
```python
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan")
    .prefetch_related("subscription")
    .get(yookassa_payment_id=yk_payment_id)
)
```

**Плюсы:**
- ✅ Subscription всё ещё предзагружается
- ✅ Нет конфликта с FOR UPDATE

**Минусы:**
- ❌ `prefetch_related` работает **ПОСЛЕ** получения объекта
- ❌ Два запроса вместо одного
- ❌ Избыточно для одного объекта

**Вердикт:** Работает, но избыточно. Вариант 1 лучше.

---

### ❌ Вариант 3: Отложенная блокировка (сложно, не рекомендуется)

**Описание:**
Сначала получить payment БЕЗ `select_for_update`, потом заблокировать.

**Реализация:**
```python
# Шаг 1: получить с join'ами БЕЗ блокировки
payment_data = (
    Payment.objects
    .select_related("user", "plan", "subscription")
    .get(yookassa_payment_id=yk_payment_id)
)

# Шаг 2: заблокировать только Payment (без join)
payment = (
    Payment.objects.select_for_update()
    .get(pk=payment_data.pk)
)

# Шаг 3: Присвоить related objects из первого запроса
payment.user = payment_data.user
payment.plan = payment_data.plan
payment.subscription = payment_data.subscription
```

**Плюсы:**
- ✅ Все related objects предзагружены

**Минусы:**
- ❌ Race condition между step 1 и step 2
- ❌ Сложность и подверженность ошибкам
- ❌ Два запроса вместо одного
- ❌ Можно получить устаревшие данные

**Вердикт:** ❌ Не рекомендуется из-за race condition.

---

### ❌ Вариант 4: Изменить модель (сделать subscription NOT NULL)

**Описание:**
Убрать `null=True` из поля `subscription`, чтобы использовать INNER JOIN.

**Плюсы:**
- ✅ Можно использовать `select_related` с `FOR UPDATE`

**Минусы:**
- ❌ Требует миграцию данных
- ❌ Нарушает текущую бизнес-логику (payment может быть без subscription)
- ❌ Может сломать существующий код
- ❌ Изменяет дата-модель

**Вердикт:** ❌ Неприемлемо - слишком большие изменения для бага.

---

## 🎯 Рекомендация

**Использовать Вариант 1**: Убрать `"subscription"` из `select_related`.

### Почему?
1. ✅ Простейшее и безопасное решение
2. ✅ Минимальные изменения в коде
3. ✅ Не меняет логику работы
4. ✅ Производительность практически не пострадает
5. ✅ Нет риска race conditions

### Где применить
Только в **одном месте**:
- `apps/billing/webhooks/handlers.py:87-88` (функция `_handle_payment_succeeded`)

Остальные handlers (`_handle_payment_canceled`, `_handle_payment_waiting_for_capture`, `_handle_refund_succeeded`) НЕ используют `select_related`, поэтому не имеют этой проблемы.

---

## 📊 Impact Analysis

### Текущий код (с багом)
```python
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan", "subscription")  # 1 запрос с 3 JOIN
    .get(yookassa_payment_id=yk_payment_id)
)
# ❌ Ошибка: FOR UPDATE cannot be applied to nullable side
```

### После исправления (Вариант 1)
```python
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan")  # 1 запрос с 2 JOIN
    .get(yookassa_payment_id=yk_payment_id)
)
# ✅ Работает!
# Если где-то нужен payment.subscription - будет +1 запрос (lazy load)
```

### Проверка использования subscription в коде
Анализируя `_handle_payment_succeeded`:
- ✅ `payment.user` - используется (строки 146-177) → нужен в select_related
- ✅ `payment.plan` - используется (строки 128-144) → нужен в select_related
- ⚠️ `payment.subscription` - **НЕ используется напрямую**!

**Вывод:** Убрать `subscription` из `select_related` - **безопасно**!

---

## 🔧 Код для исправления

### Файл: `apps/billing/webhooks/handlers.py`

**Строки 86-90:**

```python
# БЫЛО (БАГ):
with transaction.atomic():
    payment = (
        Payment.objects.select_for_update()
        .select_related("user", "plan", "subscription")  # ← ошибка тут
        .get(yookassa_payment_id=yk_payment_id)
    )

# ИСПРАВИТЬ НА:
with transaction.atomic():
    payment = (
        Payment.objects.select_for_update()
        .select_related("user", "plan")  # убрали "subscription"
        .get(yookassa_payment_id=yk_payment_id)
    )
```

---

## ✅ Финальный чек-лист

После исправления проверить:
- [ ] Код успешно компилируется
- [ ] Миграции не требуются (изменения только в коде)
- [ ] Backend перезапускается без ошибок
- [ ] Celery worker видит task
- [ ] Тестовый webhook `payment.succeeded` обрабатывается успешно
- [ ] WebhookLog показывает статус `SUCCESS`
- [ ] Payment переходит в статус `SUCCEEDED`
- [ ] Subscription активируется/продлевается

---

## 📚 Ссылки

- [Django select_for_update docs](https://docs.djangoproject.com/en/stable/ref/models/querysets/#select-for-update)
- [PostgreSQL FOR UPDATE with JOIN limitations](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [Django ticket about select_for_update with nullable relations](https://code.djangoproject.com/ticket/28344)

---

**Дата анализа:** 2025-12-17
**Приоритет:** 🔴 КРИТИЧНО
**Статус:** Готово к исправлению

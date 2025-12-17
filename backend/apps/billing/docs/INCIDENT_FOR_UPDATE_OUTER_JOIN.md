# Инцидент: PostgreSQL FOR UPDATE + LEFT OUTER JOIN

**Дата:** 2025-12-17
**Статус:** ИСПРАВЛЕНО

## Проблема

При обработке webhook `payment.succeeded` от YooKassa возникала ошибка PostgreSQL:

```
FOR UPDATE cannot be applied to the nullable side of an outer join
```

### Симптомы
- Webhook события не обрабатывались
- Платежи не активировали подписки
- В логах Celery worker появлялась ошибка PostgreSQL
- WebhookLog застревал в статусе PROCESSING или FAILED

## Причина

В файле `backend/apps/billing/webhooks/handlers.py`, функция `_handle_payment_succeeded()`:

```python
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan", "subscription")  # ← ПРОБЛЕМА
    .get(yookassa_payment_id=yk_payment_id)
)
```

**Почему это ломалось:**
1. `Payment.subscription` — nullable ForeignKey (`null=True, blank=True`)
2. `select_related("subscription")` создаёт LEFT OUTER JOIN
3. PostgreSQL запрещает `FOR UPDATE` на nullable стороне outer join
4. Django генерирует невалидный SQL для Postgres

## Решение

Убрали `"subscription"` из `select_related()`:

```python
# IMPORTANT: do NOT select_related("subscription") here.
# subscription is nullable -> LEFT OUTER JOIN -> PostgreSQL forbids FOR UPDATE on nullable side.
payment = (
    Payment.objects.select_for_update()
    .select_related("user", "plan")  # subscription убран
    .get(yookassa_payment_id=yk_payment_id)
)
```

**Обоснование:**
- `payment.subscription` нигде не используется в функции `_handle_payment_succeeded()`
- Убрав его из select_related, мы избегаем LEFT OUTER JOIN
- Если в будущем понадобится subscription, можно сделать lazy fetch после lock:
  ```python
  subscription = payment.subscription  # lazy load, no FOR UPDATE conflict
  ```

## Проверка

### Локальная проверка
```bash
cd backend
python manage.py shell

# Создать Payment с subscription=NULL
from apps.billing.models import Payment
payment = Payment.objects.select_for_update().select_related("user", "plan").first()
# Убедиться, что ошибки нет
```

### Проверка в проде
1. Смотреть логи Celery:
   ```bash
   cd /opt/EatFit24
   docker compose logs -f celery-worker --tail=200
   ```

2. Создать тестовый платёж (например 5₽) и дождаться webhook

3. Убедиться:
   - ✅ В логах нет ошибки `FOR UPDATE cannot be applied...`
   - ✅ WebhookLog переходит в статус SUCCESS
   - ✅ Payment меняет статус на SUCCEEDED
   - ✅ Subscription активируется/продлевается

## Откат

```bash
cd /opt/EatFit24
git revert <commit-hash>
docker compose restart backend celery-worker
```

## Affected Files

- `backend/apps/billing/webhooks/handlers.py` — основной фикс
- `backend/apps/billing/docs/INCIDENT_FOR_UPDATE_OUTER_JOIN.md` — эта документация

## References

- Django docs: [select_for_update()](https://docs.djangoproject.com/en/stable/ref/models/querysets/#select-for-update)
- PostgreSQL docs: [FOR UPDATE](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- Related issue: nullable foreign keys + select_for_update = LEFT OUTER JOIN conflict

## Lessons Learned

1. **Не включать nullable relations в select_for_update()**
   Всегда проверять, что все select_related поля non-nullable при использовании FOR UPDATE.

2. **Проверять использование prefetch/select_related**
   Убирать неиспользуемые поля из eager loading для избежания подобных проблем.

3. **Тестировать на PostgreSQL в dev**
   SQLite может не воспроизводить такие ошибки. Всегда тестируйте на той же БД, что в проде.

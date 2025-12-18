# Celery и Async Processing — Аудит

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer

---

## Обзор

### Celery Tasks в Billing

| Task | Файл | Назначение |
|------|------|------------|
| `process_yookassa_webhook` | `webhooks/tasks.py` | Async обработка webhook |

### Конфигурация Celery (docker-compose.yml)

```yaml
celery-worker:
  command: celery -A config worker -l info -Q ai,billing,default --concurrency=4 --soft-time-limit=120 --time-limit=150
```

| Параметр | Значение |
|----------|----------|
| Queues | `ai`, `billing`, `default` |
| Concurrency | 4 workers |
| Soft time limit | 120s |
| Hard time limit | 150s |

---

## Task: process_yookassa_webhook

### Конфигурация

```python
@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def process_yookassa_webhook(self, log_id: int):
```

| Параметр | Значение |
|----------|----------|
| `bind` | True (доступ к `self`) |
| `max_retries` | 5 |
| `default_retry_delay` | 30s |
| Backoff | Exponential (30, 60, 120, 240, 480s) |

### Поведение

1. Загружает `WebhookLog` по ID
2. Обновляет статус → PROCESSING
3. Вызывает `handle_yookassa_event()`
4. При успехе: статус → SUCCESS
5. При ошибке: статус → FAILED, retry с backoff

---

## Проблемы и рекомендации

### P1-CEL-01: Task не использует отдельную очередь
- **Где**: `process_yookassa_webhook`
- **Проблема**: Webhook задачи идут в default queue вместе с AI задачами
- **Последствия**: AI задачи (долгие) могут заблокировать обработку webhook
- **Рекомендация**: Использовать отдельную очередь `billing`
- **Сложность**: S

```python
# Фикс
@shared_task(bind=True, max_retries=5, default_retry_delay=30, queue='billing')
def process_yookassa_webhook(self, log_id: int):
```

```yaml
# docker-compose.yml - отдельный worker для billing
celery-billing-worker:
  command: celery -A config worker -l info -Q billing --concurrency=2
```

### P1-CEL-02: Нет ack_late для critical tasks
- **Где**: `process_yookassa_webhook`
- **Проблема**: Task acknowledgement происходит до выполнения
- **Последствия**: При crash worker — task потерян
- **Рекомендация**: Включить `ack_late=True`
- **Сложность**: S

```python
@shared_task(bind=True, max_retries=5, default_retry_delay=30, ack_late=True)
def process_yookassa_webhook(self, log_id: int):
```

### P2-CEL-03: Нет retry для WebhookLog.DoesNotExist
- **Где**: `process_yookassa_webhook`
- **Проблема**: Если WebhookLog удалён, задача просто завершается
- **Последствия**: Потенциальная потеря события (маловероятно)
- **Рекомендация**: Логировать warning, не retry (правильно)
- **Сложность**: N/A (текущее поведение корректно)

### P2-CEL-04: Нет мониторинга stuck tasks
- **Где**: N/A
- **Проблема**: Если worker умер при PROCESSING, задача не будет обработана повторно
- **Последствия**: Потеря события
- **Рекомендация**: Celery beat задача для retry stuck webhooks
- **Сложность**: M

---

## Что будет при падении worker

| Сценарий | Последствие | Текущее поведение |
|----------|-------------|-------------------|
| Worker упал до ack | С `ack_late`: retry, без: потеря | **Потеря** (нет ack_late) |
| Worker упал при PROCESSING | WebhookLog застревает в PROCESSING | **Нет автосовосстановления** |
| Все workers недоступны | Fallback на sync | ✓ Корректно |

---

## Что будет при double delivery

Celery может доставить одну задачу дважды (at-least-once semantics).

### Механизмы защиты

1. **WebhookLog.event_id** — уникальный ключ события
2. **Payment.status check** — проверка перед изменением
3. **select_for_update()** — блокировка строки

### Сценарий

```
T1: process_yookassa_webhook(log_id=123)
T2: process_yookassa_webhook(log_id=123)  # duplicate delivery

T1: SELECT WebhookLog FOR UPDATE (status=QUEUED)
T2: SELECT WebhookLog FOR UPDATE (blocked)
T1: UPDATE status=PROCESSING, handle_event(), status=SUCCESS
T1: COMMIT
T2: SELECT WebhookLog FOR UPDATE (status=SUCCESS)
T2: Log already SUCCESS, skip
```

**Статус:** ✓ ЗАЩИЩЕНО (через status check)

---

## Transaction boundaries

### Опасные места

1. **handlers.py:_handle_payment_succeeded()**

```python
with transaction.atomic():
    payment = Payment.objects.select_for_update().get(...)
    payment.save()
    subscription = activate_or_extend_subscription(...)
    subscription.save()
```

**✓ Хорошо:** Всё в одной транзакции

2. **views.py:_create_subscription_payment_core()**

```python
with transaction.atomic():
    payment = Payment.objects.create(...)
    yk_payment = yk.create_payment(...)  # ← External API call!
    payment.yookassa_payment_id = yk_payment["id"]
    payment.save()
```

### P2-CEL-05: External API call внутри transaction
- **Где**: `views.py:_create_subscription_payment_core()`, `services.py:create_subscription_payment()`
- **Проблема**: Вызов YooKassa API внутри `transaction.atomic()`
- **Последствия**: Долгая блокировка строки Payment, timeout транзакции
- **Рекомендация**: Создать Payment вне транзакции, обновить после вызова API
- **Сложность**: M

```python
# Предложенный паттерн
payment = Payment.objects.create(...)  # без atomic

try:
    yk_payment = yk.create_payment(...)
except Exception:
    payment.mark_as_failed("YooKassa API error")
    raise

with transaction.atomic():
    payment.yookassa_payment_id = yk_payment["id"]
    payment.save()
```

---

## Резюме

| Компонент | Статус | Критичность |
|-----------|--------|-------------|
| Retry policy | ✓ Настроено | - |
| Exponential backoff | ✓ Настроено | - |
| Double delivery protection | ✓ Защищено | - |
| Worker crash recovery | ⚠ Не настроено | P1 |
| Dedicated queue | ⚠ Не настроено | P1 |
| ack_late | ⚠ Не настроено | P1 |
| Stuck task monitoring | ⚠ Не настроено | P2 |

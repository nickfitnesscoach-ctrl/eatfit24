# Webhook System — Аудит

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer

---

## Обзор

| Файл | Назначение |
|------|------------|
| `webhooks/views.py` | Приём webhook, IP-валидация, идемпотентность |
| `webhooks/handlers.py` | Бизнес-логика событий |
| `webhooks/tasks.py` | Celery-задача для async обработки |
| `webhooks/utils.py` | IP allowlist YooKassa |

---

## Безопасность

### IP Allowlist

**Реализация:** `webhooks/utils.py`

```python
YOOKASSA_IP_RANGES = [
    "185.71.76.0/27",
    "185.71.77.0/27",
    "77.75.153.0/25",
    "77.75.156.11/32",
    "77.75.156.35/32",
    "77.75.154.128/25",
    "2a02:5180::/32",  # IPv6
]
```

**Проверка:** `is_ip_allowed(ip)` — проверяет принадлежность IP к диапазонам

**✓ Хорошо:**
- Корректные CIDR диапазоны YooKassa
- IPv6 поддержка
- Graceful handling невалидных IP

---

### XFF (X-Forwarded-For) Защита

**Реализация:** `webhooks/views.py:_get_client_ip_secure()`

| Настройка | Поведение |
|-----------|-----------|
| `WEBHOOK_TRUST_XFF=false` (default) | Используется `REMOTE_ADDR` |
| `WEBHOOK_TRUST_XFF=true` | Используется XFF **только если** `REMOTE_ADDR` в trusted proxies |

**Trusted Proxies:** Конфигурируются через `WEBHOOK_TRUSTED_PROXIES`

**✓ Хорошо:**
- XFF по умолчанию отключён
- Проверка trusted proxy перед использованием XFF
- Логирование при игнорировании XFF от недоверенного источника

**Статус:** ✓ ЗАЩИЩЕНО от XFF spoofing

---

### Rate Limiting

**Реализация:** `throttles.py:WebhookThrottle`

```python
class WebhookThrottle(SimpleRateThrottle):
    scope = "billing_webhook"
    rate = "100/hour"
```

**✓ Хорошо:**
- 100 req/hour на IP
- Использует `get_ident()` из DRF (учитывает прокси)

---

## Идемпотентность

### Ключ идемпотентности

**Формула:** `{event_type}:{object.id}:{object.status}`

Пример: `payment.succeeded:abc123:succeeded`

**✓ Хорошо:**
- Включает event_type (разные события для одного payment)
- Включает status (один payment может пройти через несколько статусов)

### Механизм дедупликации

```python
with transaction.atomic():
    log, created = WebhookLog.objects.select_for_update().get_or_create(
        event_id=idempotency_key,
        defaults={...}
    )
    
    if not created:
        # Duplicate — log and return 200
        log.attempts += 1
        log.save()
        return JsonResponse({"status": "ok"}, status=200)
```

**✓ Хорошо:**
- `select_for_update()` предотвращает race condition
- Всегда возвращает 200 OK для дубликатов
- Счётчик attempts для мониторинга

---

## Обработка событий

### Поддерживаемые события

| Событие | Обработчик | Действие |
|---------|------------|----------|
| `payment.succeeded` | `_handle_payment_succeeded` | Активация подписки |
| `payment.canceled` | `_handle_payment_canceled` | Отметка CANCELED |
| `payment.waiting_for_capture` | `_handle_payment_waiting_for_capture` | Отметка статуса |
| `refund.succeeded` | `_handle_refund_succeeded` | Создание Refund, Payment → REFUNDED |

### Неизвестные события

```python
handler = handlers.get(event_type)
if not handler:
    logger.info(f"Unhandled YooKassa webhook event: {event_type}")
    return  # Не ошибка
```

**✓ Хорошо:** Неизвестные события не ломают систему

---

## Retry стратегия

### YooKassa Retry Policy

YooKassa ретраит webhook при:
- HTTP 5xx
- Timeout (> 10 секунд)
- Connection refused

**НЕ ретраит при:**
- HTTP 200-299 (success)
- HTTP 4xx (client error, кроме 429)

### Наша стратегия ответов

| Ситуация | HTTP Response | Причина |
|----------|---------------|---------|
| IP не в allowlist | 403 | Блокировка попытки spoofing |
| Invalid JSON | 400 | Некорректные данные |
| Missing required fields | 400 | Некорректные данные |
| Duplicate event | 200 | Идемпотентность |
| Processing success | 200 | Всё ок |
| Processing error (sync) | 200 | Возвращаем 200, но логируем ошибку |

**⚠ Важно:** Мы всегда возвращаем 200 после принятия webhook, даже при ошибке обработки.
Это правильно для идемпотентности, но требует ручного мониторинга failed webhooks.

---

## Celery Async Processing

### Конфигурация таска

```python
@shared_task(bind=True, max_retries=5, default_retry_delay=30)
def process_yookassa_webhook(self, log_id: int):
    ...
```

| Параметр | Значение |
|----------|----------|
| `max_retries` | 5 |
| `default_retry_delay` | 30 секунд |
| Exponential backoff | 30s, 60s, 120s, 240s, 480s |

**✓ Хорошо:**
- Exponential backoff
- Статус обновляется в WebhookLog
- Error message сохраняется

### Fallback на синхронную обработку

```python
queued = _enqueue_processing(log_id=log.id, ...)
if not queued:
    _process_webhook_sync(log_id=log.id, ...)
```

**✓ Хорошо:** Если Celery недоступен, обработка происходит синхронно

---

## Проблемы и рекомендации

### P1-WH-01: Возможна потеря события при crash worker
- **Где**: `webhooks/tasks.py`
- **Проблема**: Если worker упадёт между PROCESSING и SUCCESS, статус останется PROCESSING
- **Последствия**: Событие не будет обработано повторно
- **Рекомендация**: Добавить celery-beat задачу для retry PROCESSING > 10 min
- **Сложность**: M

```python
# Предложенный фикс
@shared_task
def retry_stuck_webhooks():
    stuck = WebhookLog.objects.filter(
        status="PROCESSING",
        created_at__lt=timezone.now() - timedelta(minutes=10)
    )
    for log in stuck:
        process_yookassa_webhook.delay(log.id)
```

### P2-WH-02: Отсутствует мониторинг FAILED webhooks
- **Где**: `webhooks/tasks.py`
- **Проблема**: После 5 retries webhook помечается FAILED и забывается
- **Последствия**: Платёж прошёл, но подписка не активирована
- **Рекомендация**: Alerting при status=FAILED
- **Сложность**: S

### P2-WH-03: Raw payload хранится полностью
- **Где**: `WebhookLog.raw_payload`
- **Проблема**: Может содержать sensitive data, раздувает БД
- **Последствия**: Потенциальная утечка данных, рост storage
- **Рекомендация**: Маскировать sensitive fields, TTL для старых логов
- **Сложность**: M

---

## Допустимые vs Фатальные ошибки

### Допустимые ошибки (автоматически исправляются)

| Ошибка | Обработка |
|--------|-----------|
| Duplicate webhook | Логируется, возвращается 200 |
| Payment не в PENDING | Логируется, пропускается |
| Unknown event type | Логируется, пропускается |
| Celery unavailable | Синхронный fallback |

### Фатальные ошибки (требуют вмешательства)

| Ошибка | Последствия | Когда случается |
|--------|-------------|-----------------|
| Payment не найден по yookassa_payment_id | Exception в handler | YooKassa отправил событие для payment, созданного вне нашей системы |
| Plan не найден | Exception в handler | Payment создан с несуществующим plan |
| DB connection error | Task retry, потом FAILED | Проблемы с PostgreSQL |

### Где возможна потеря денег

| Сценарий | Вероятность | Последствия |
|----------|-------------|-------------|
| Webhook не дошёл (firewall, wrong URL) | Низкая | Деньги взяты, подписка не активирована |
| Worker crash при обработке | Низкая | То же |
| 5 retries исчерпаны | Очень низкая | То же |
| Payment не найден в БД | Очень низкая | То же |

**Митигация:** Ручная проверка PENDING платежей > 1 час

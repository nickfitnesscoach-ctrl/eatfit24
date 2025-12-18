# Billing Full Audit Report — EatFit24

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer  
**Версия**: 1.0

---

## Executive Summary

Биллинг-система EatFit24 построена на правильных принципах безопасности:
- ✓ Цены берутся из БД, не с фронтенда
- ✓ Подписка активируется только после webhook
- ✓ IP allowlist для webhook защищает от spoofing
- ✓ Идемпотентность реализована на нескольких уровнях
- ✓ Race conditions защищены через `select_for_update()`

**Однако есть критические риски:**
- Webhook task не использует `ack_late` — при crash worker событие теряется
- Нет dedicated queue для billing — AI задачи могут заблокировать обработку платежей
- Нет мониторинга FAILED webhooks — платёж может пройти без активации подписки

**Общая оценка:** 7/10 — система работает, но требует hardening для production-scale.

---

## Общая оценка надёжности

| Компонент | Оценка | Комментарий |
|-----------|--------|-------------|
| Архитектура | 8/10 | Чёткое разделение ответственности |
| БД и модели | 8/10 | Правильные constraints и индексы |
| Webhook система | 7/10 | Хорошая защита, но нет recovery |
| Celery | 6/10 | Работает, но не production-hardened |
| Payment lifecycle | 8/10 | Корректная логика, хорошая идемпотентность |
| Deploy/Config | 7/10 | Безопасные defaults, мелкие улучшения |

---

## Таблица всех проблем

### P0 — Critical (потеря денег)

| ID | Проблема | Файл | Сценарий | Сложность |
|----|----------|------|----------|-----------|
| — | Нет P0 проблем | — | — | — |

### P1 — High (race conditions, double charge, неконсистентность)

| ID | Проблема | Файл | Сценарий | Сложность |
|----|----------|------|----------|-----------|
| P1-CEL-01 | Task не использует отдельную очередь | `webhooks/tasks.py` | AI задачи блокируют billing | S |
| P1-CEL-02 | Нет `ack_late` для critical tasks | `webhooks/tasks.py` | Worker crash = потеря события | S |
| P1-WH-01 | Нет recovery для stuck webhooks | `webhooks/tasks.py` | PROCESSING > 10 min не ретраится | M |

### P2 — Medium (технический долг)

| ID | Проблема | Файл | Сценарий | Сложность |
|----|----------|------|----------|-----------|
| P2-ARCH-01 | Синхронный вызов YooKassa в HTTP request | `views.py` | Timeout при недоступности API | M |
| P2-ARCH-02 | Fallback на sync webhook processing | `webhooks/views.py` | Ошибка при Celery unavailable | S |
| P2-ARCH-03 | Дублирование logic в management commands | `process_recurring_payments.py` | Несогласованность | S |
| P2-DB-05 | `event_id` не UNIQUE | `models.py` | Потенциальные дубликаты (защищено select_for_update) | S |
| P2-WH-02 | Нет мониторинга FAILED webhooks | N/A | Платёж без активации | S |
| P2-WH-03 | Raw payload хранится полностью | `models.py` | Storage bloat, sensitive data | M |
| P2-CEL-04 | Нет мониторинга stuck tasks | N/A | Потеря события | M |
| P2-CEL-05 | External API call в transaction | `views.py`, `services.py` | Долгая блокировка | M |
| P2-PL-01 | Нет timeout для PENDING платежей | N/A | Замусоривание БД | S |
| P2-PL-02 | Refund не откатывает подписку | `handlers.py` | Бесплатный доступ | M |
| P2-PL-03 | card_type берётся некорректно | `handlers.py` | Неправильный бренд карты | S |
| P2-DEP-01 | Нет версий пакетов в Dockerfile | `Dockerfile` | Непредсказуемые builds | S |
| P2-DEP-02 | YOOKASSA_WEBHOOK_SECRET не используется | `.env.example` | Путаница | M |
| P2-DEP-03 | BILLING_RECURRING_ENABLED не документирован | `.env.example` | Путаница | S |
| P2-DEP-04 | Celery worker делает migrate | `docker-compose.yml` | Race condition | M |

---

## Критический путь оплаты

### Happy Path

```
1. POST /billing/create-payment/ {plan_code: "PRO_MONTHLY"}
   ✓ Throttle: 20 req/hour
   ✓ plan_code валидируется
   ✓ Цена из БД
   ✓ return_url whitelist

2. Payment created (PENDING)
   ✓ yookassa_payment_id saved
   ⚠ External API call в transaction (P2-CEL-05)

3. User pays on YooKassa

4. Webhook: payment.succeeded
   ✓ IP allowlist
   ✓ Idempotency (event_id)
   ✓ Celery async (fallback: sync)
   ⚠ Нет ack_late (P1-CEL-02)

5. Handler: _handle_payment_succeeded
   ✓ select_for_update (race protection)
   ✓ Status check (idempotency)
   ✓ activate_or_extend_subscription() в транзакции

6. Subscription updated
   ✓ plan changed
   ✓ end_date extended
   ✓ payment_method saved
   ✓ cache invalidated
```

### Failure Path

```
1. Webhook не дошёл (firewall, wrong URL)
   → Payment остаётся PENDING навсегда
   → Деньги взяты, подписка не активирована
   ⚠ Нет мониторинга PENDING > 1h

2. Celery worker crash при PROCESSING
   → WebhookLog status=PROCESSING
   → Task не ретраится (нет ack_late)
   ⚠ Нет recovery для stuck webhooks

3. 5 retries исчерпаны
   → WebhookLog status=FAILED
   → Деньги взяты, подписка не активирована
   ⚠ Нет alerting на FAILED webhooks

4. YooKassa API недоступен при создании платежа
   → HTTP 502/504
   → Payment не создан
   ✓ Безопасно (деньги не взяты)
```

---

## Рекомендованный Roadmap фиксов

### Phase 1: Critical (1-2 дня)

1. **P1-CEL-02: Добавить `ack_late=True`**
   ```python
   @shared_task(bind=True, max_retries=5, default_retry_delay=30, ack_late=True)
   def process_yookassa_webhook(self, log_id: int):
   ```

2. **P1-CEL-01: Dedicated queue для billing**
   ```python
   @shared_task(..., queue='billing')
   ```
   ```yaml
   # docker-compose.yml
   celery-billing-worker:
     command: celery -A config worker -Q billing --concurrency=2
   ```

3. **P1-WH-01: Celery beat для retry stuck webhooks**
   ```python
   @shared_task
   def retry_stuck_webhooks():
       stuck = WebhookLog.objects.filter(
           status="PROCESSING",
           created_at__lt=timezone.now() - timedelta(minutes=10)
       )
       for log in stuck:
           process_yookassa_webhook.delay(log.id)
   ```

### Phase 2: High Priority (1 неделя)

4. **P2-WH-02: Alerting на FAILED webhooks**
   - Интеграция с Sentry/Telegram
   - Alert при status=FAILED

5. **P2-PL-01: Cleanup PENDING платежей**
   ```python
   # management command
   def cleanup_pending_payments():
       old_pending = Payment.objects.filter(
           status="PENDING",
           created_at__lt=timezone.now() - timedelta(hours=24)
       )
       old_pending.update(status="CANCELED")
   ```

6. **P2-DEP-04: Fix migrate race condition**
   - Убрать migrate из celery-worker
   - Добавить wait-for-it или depends_on condition

### Phase 3: Tech Debt (2 недели)

7. **P2-ARCH-03: Унифицировать YooKassa вызовы**
   - process_recurring_payments → использовать YooKassaService

8. **P2-CEL-05: Вынести API call из transaction**
   - Создать Payment → вызвать API → обновить Payment

9. **P2-DB-05: Добавить UNIQUE на event_id**
   - Миграция: `event_id = models.CharField(..., unique=True)`

10. **P2-WH-03: Маскировать sensitive data в raw_payload**
    - Фильтровать card_number, CVV и т.д.

---

## Мониторинг (рекомендуется)

### Метрики

| Метрика | Порог | Действие |
|---------|-------|----------|
| Payment PENDING > 1h | > 0 | Investigate |
| WebhookLog FAILED | > 0 | Alert |
| WebhookLog PROCESSING > 10min | > 0 | Alert |
| Celery billing queue length | > 100 | Scale workers |

### SQL запросы для мониторинга

```sql
-- PENDING платежи старше 1 часа
SELECT id, user_id, amount, created_at
FROM payments
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '1 hour';

-- FAILED webhooks
SELECT id, event_type, error_message, created_at
FROM webhook_logs
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 20;

-- Stuck PROCESSING webhooks
SELECT id, event_type, created_at
FROM webhook_logs
WHERE status = 'PROCESSING'
  AND created_at < NOW() - INTERVAL '10 minutes';
```

---

## Детальные отчёты

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE_BILLING_AUDIT.md](./ARCHITECTURE_BILLING_AUDIT.md) | Диаграмма архитектуры, потоки данных |
| [DB_AND_MODELS_AUDIT.md](./DB_AND_MODELS_AUDIT.md) | Модели, race conditions, идемпотентность |
| [WEBHOOK_SYSTEM_AUDIT.md](./WEBHOOK_SYSTEM_AUDIT.md) | Безопасность, retry, потеря событий |
| [CELERY_BILLING_AUDIT.md](./CELERY_BILLING_AUDIT.md) | Task config, worker crash, double delivery |
| [PAYMENT_LIFECYCLE_AUDIT.md](./PAYMENT_LIFECYCLE_AUDIT.md) | Пошаговый разбор, edge cases |
| [DEPLOY_AND_CONFIG_AUDIT.md](./DEPLOY_AND_CONFIG_AUDIT.md) | Dockerfile, docker-compose, env vars |

---

## Заключение

После выполнения Phase 1 (1-2 дня работы):
- ✓ Вы понимаете, где можете потерять деньги
- ✓ Вы знаете, что чинить в первую очередь
- ✓ Вы можете безопасно масштабировать billing
- ✓ Инциденты не будут происходить "внезапно"

Система готова к production после:
1. Добавления `ack_late` и dedicated queue
2. Настройки мониторинга FAILED/PENDING
3. Добавления retry для stuck webhooks

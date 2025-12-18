# Архитектура Billing — Аудит

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer

---

## Общая Диаграмма

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND / MINI APP                              │
│  • POST /billing/create-payment/ {plan_code, return_url?}                   │
│  • GET  /billing/me/                                                        │
│  • GET  /billing/plans/                                                     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DJANGO BACKEND (API)                              │
│  ┌──────────────────┐   ┌───────────────────┐   ┌────────────────────────┐  │
│  │   views.py       │──▶│   services.py     │──▶│   YooKassaService      │  │
│  │   (API endpoints)│   │   (business logic)│   │   (SDK wrapper)        │  │
│  └──────────────────┘   └───────────────────┘   └─────────┬──────────────┘  │
│           │                      │                        │                 │
│           ▼                      ▼                        ▼                 │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL (models.py)                          │   │
│  │  • SubscriptionPlan (тарифы)                                         │   │
│  │  • Subscription (подписка пользователя)                              │   │
│  │  • Payment (платёж — PENDING → SUCCEEDED)                            │   │
│  │  • Refund (возврат)                                                  │   │
│  │  • WebhookLog (логирование webhook)                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API (payments/create)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOOKASSA API                                   │
│  • Создание платежа                                                         │
│  • Webhook callback (payment.succeeded, payment.canceled, refund.succeeded) │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ POST /api/v1/billing/webhooks/yookassa
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WEBHOOK SUBSYSTEM                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌─────────────────────┐    │
│  │ webhooks/views.py  │─▶│ webhooks/handlers.py│─▶│   services.py       │   │
│  │ • IP allowlist     │  │ • payment.succeeded │  │   activate_or_      │   │
│  │ • Idempotency      │  │ • payment.canceled  │  │   extend_subscription│  │
│  │ • Rate limit       │  │ • refund.succeeded  │  └─────────────────────┘   │
│  └────────────────────┘  └────────────────────┘                              │
│           │                                                                  │
│           ▼                                                                  │
│  ┌────────────────────┐                                                      │
│  │ webhooks/tasks.py  │ ← Celery (async processing, fallback: sync)         │
│  │ process_yookassa_  │                                                      │
│  │ webhook            │                                                      │
│  └────────────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     MANAGEMENT COMMANDS (CRON)                              │
│  • process_recurring_payments.py — автопродление подписок                   │
│  • cleanup_expired_subscriptions.py — перевод истёкших в FREE               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Границы ответственности

| Компонент | Ответственность |
|-----------|-----------------|
| `views.py` | API endpoints, throttling, валидация return_url |
| `services.py` | Бизнес-логика создания платежа, активации подписки, YooKassa SDK |
| `webhooks/views.py` | Приём webhook, IP allowlist, идемпотентность |
| `webhooks/handlers.py` | Бизнес-обработка событий (SUCCEEDED → активация) |
| `webhooks/tasks.py` | Celery-задача для асинхронной обработки |
| `models.py` | Модели данных, переходы статусов, сигналы |
| `management/commands/` | Cron-задачи: автопродление, cleanup |

---

## Точки входа

### 1. API Endpoints (views.py)
| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/billing/plans/` | GET | Список тарифов (public) |
| `/billing/me/` | GET | Статус подписки + лимиты |
| `/billing/create-payment/` | POST | Создание платежа |
| `/billing/subscription/` | GET | Детали подписки |
| `/billing/subscription/autorenew/` | POST | Включить/выключить автопродление |
| `/billing/payments/` | GET | История платежей |
| `/billing/bind-card/start/` | POST | Привязка карты (1₽ платёж) |
| `/billing/create-test-live-payment/` | POST | Тестовый платёж 1₽ (только админы) |

### 2. Webhook Endpoint
| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/billing/webhooks/yookassa` | POST | Приём событий от YooKassa |

### 3. Celery Tasks
| Task | Назначение |
|------|------------|
| `process_yookassa_webhook` | Асинхронная обработка webhook |

### 4. Management Commands (cron)
| Command | Назначение |
|---------|------------|
| `process_recurring_payments` | Автопродление подписок (за N дней до истечения) |
| `cleanup_expired_subscriptions` | Перевод истёкших подписок в FREE |

---

## Потоки данных

### Создание платежа (happy path)
```
1. Frontend: POST /billing/create-payment/ {plan_code}
2. views.py: validate plan_code, validate return_url
3. services.py: create_subscription_payment()
   - get plan from DB (price, duration from SubscriptionPlan)
   - create Payment (status=PENDING)
   - call YooKassaService.create_payment()
   - save yookassa_payment_id to Payment
4. Return confirmation_url to frontend
5. User redirected to YooKassa payment page
```

### Подтверждение платежа (webhook)
```
1. YooKassa: POST /billing/webhooks/yookassa {event: payment.succeeded, object: {...}}
2. webhooks/views.py:
   - validate IP (allowlist)
   - parse JSON
   - check idempotency (WebhookLog.event_id)
   - create WebhookLog
   - enqueue Celery task (or sync fallback)
3. webhooks/tasks.py (Celery):
   - call handle_yookassa_event()
4. webhooks/handlers.py:
   - find Payment by yookassa_payment_id
   - check Payment.status (idempotency)
   - mark Payment as SUCCEEDED
   - call activate_or_extend_subscription()
   - update Subscription (plan, end_date, payment_method)
   - invalidate cache
5. Return 200 OK
```

### Автопродление (cron)
```
1. Cron: python manage.py process_recurring_payments
2. Find subscriptions:
   - auto_renew=True
   - end_date within N days
   - has payment_method_id
3. For each subscription:
   - lock (select_for_update)
   - check for pending payments (anti-duplicate)
   - create Payment (PENDING, is_recurring=True)
   - call YooKassa API (recurring payment)
   - save yookassa_payment_id
4. Webhook arrives → same flow as above
```

---

## Синхронные vs Асинхронные участки

| Участок | Тип | Риски |
|---------|-----|-------|
| Создание платежа (views → YooKassa API) | **Синхронный** | Timeout, 502, request.user locked |
| Webhook processing | **Асинхронный** (Celery) | Task failure, double delivery |
| Webhook fallback | **Синхронный** | Blocking, risk if Celery unavailable |
| Автопродление | **Синхронный** (cron job) | Long-running transaction, API timeouts |
| Cleanup подписок | **Синхронный** (cron job) | Batches reduce risk |

---

## Архитектурные проблемы

### P2-ARCH-01: Синхронный вызов YooKassa API в HTTP request
- **Где**: `views.py:_create_subscription_payment_core()`, `services.py:create_subscription_payment()`
- **Проблема**: Если YooKassa API медленный/недоступен, request зависает
- **Последствия**: Timeout, плохой UX, потенциальная потеря платежа
- **Рекомендация**: Timeout < 15s, circuit breaker, retry с exponential backoff
- **Сложность**: M

### P2-ARCH-02: Fallback на синхронную обработку webhook
- **Где**: `webhooks/views.py:_process_webhook_sync()`
- **Проблема**: Если Celery недоступен, webhook обрабатывается синхронно
- **Последствия**: При ошибке обработки — потеря события (YooKassa не получит 200 OK вовремя)
- **Рекомендация**: Ловить исключение, но всегда возвращать 200 OK после логирования
- **Сложность**: S

### P2-ARCH-03: Management commands используют прямой requests к YooKassa
- **Где**: `process_recurring_payments.py:_create_recurring_payment_yookassa()`
- **Проблема**: Обходит YooKassaService, дублирование логики
- **Последствия**: Несогласованность, сложнее поддерживать
- **Рекомендация**: Использовать `YooKassaService.create_recurring_payment()`
- **Сложность**: S

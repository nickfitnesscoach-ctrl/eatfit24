# Документация Billing

> **SSOT** — единственный источник истины по биллингу.

Система биллинга EatFit24: подписки, платежи, лимиты, интеграция с YooKassa.

---

## Быстрый старт

1. Ключевые принципы (раздел ниже)
2. API Endpoints (раздел ниже)
3. Модели и конфигурация (разделы ниже)

---

## Структура модуля

```
billing/
├── models.py          # SubscriptionPlan, Subscription, Payment, Refund, WebhookLog
├── views.py           # API endpoints
├── services.py        # YooKassaService + бизнес-логика
├── notifications.py   # Telegram-уведомления о подписках
├── usage.py           # Дневные лимиты (DailyUsage)
├── throttles.py       # Rate limiting
├── serializers.py     # Валидация и форматирование
├── urls.py            # Маршруты API
├── admin.py           # Django Admin
├── webhooks/          # Обработка webhook YooKassa
│   ├── views.py       # Приём webhook
│   ├── handlers.py    # Бизнес-логика событий
│   ├── tasks.py       # Celery tasks
│   └── utils.py       # IP allowlist
└── management/commands/
    ├── process_recurring_payments.py
    └── cleanup_expired_subscriptions.py
```

---

## Ключевые принципы

| Принцип | Описание |
|---------|----------|
| **Webhook = источник истины** | Платёж успешен только после webhook |
| **Цена из БД** | Сумма никогда не приходит с фронта |
| **YooKassaService** | Единственный клиент YooKassa |
| **Атомарные лимиты** | Защита от race condition |

---

## API Endpoints

| Endpoint | Метод | Назначение |
|----------|-------|------------|
| `/billing/plans/` | GET | Список активных планов |
| `/billing/me/` | GET | Статус подписки и лимиты |
| `/billing/create-payment/` | POST | Создание платежа |
| `/billing/subscription/` | GET | Детали подписки |
| `/billing/subscription/autorenew/` | POST | Настройка автопродления |
| `/billing/payment-method/` | GET | Информация о карте |
| `/billing/payments/` | GET | История платежей |
| `/billing/bind-card/start/` | POST | Привязка карты |
| `/billing/webhooks/yookassa` | POST | Webhook YooKassa |

---

## Модели

| Модель | Назначение |
|--------|------------|
| `SubscriptionPlan` | Тарифные планы (FREE, PRO_MONTHLY, PRO_YEARLY) |
| `Subscription` | Подписка пользователя (1:1 с User) |
| `Payment` | Платёж (PENDING → SUCCEEDED/CANCELED) |
| `Refund` | Возврат средств |
| `WebhookLog` | Лог входящих webhook |

---

## Конфигурация

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `YOOKASSA_SHOP_ID` | ID магазина YooKassa |
| `YOOKASSA_SECRET_KEY` | Секретный ключ YooKassa |
| `YOOKASSA_RETURN_URL` | URL возврата после оплаты |
| `BILLING_RECURRING_ENABLED` | `true` / `false` — режим recurring платежей |
| `TELEGRAM_BOT_TOKEN` | Токен бота для уведомлений |
| `TELEGRAM_ADMINS` | ID админов для уведомлений |

### Recurring платежи

> ⚠️ **Важно:** `BILLING_RECURRING_ENABLED` контролирует режим работы

| Режим | `save_payment_method` | Автопродление | Привязка карты |
|-------|----------------------|---------------|----------------|
| `true` | ✅ включено | ✅ доступно | ✅ доступна |
| `false` | ❌ выключено | ❌ недоступно | ❌ недоступна |

**Как включить recurring:**
1. Активировать recurring в личном кабинете YooKassa
2. Установить `BILLING_RECURRING_ENABLED=true`
3. Перезапустить: `docker compose restart backend celery-worker`

---

## Уведомления

При успешной оплате PRO подписки админам отправляется Telegram-уведомление:

```
🎉 НОВАЯ ПОДПИСКА PRO
━━━━━━━━━━━━━━━━━━
👤 Имя: {full_name}
🆔 Telegram ID: {tg_id}
📧 Username: @{username}
━━━━━━━━━━━━━━━━━━
💎 Тариф: PRO Месячный/Годовой
💰 Сумма: {price} ₽
📅 Подписка до: {end_date}

[👤 Открыть профиль в Telegram]
```

---

## Дата обновления

**2025-12-18** — Консолидация документации, добавление notifications.py

# ROUTES — Billing Feature Module

> Описание маршрутов модуля биллинга.

---

## Обзор маршрутов

| Путь | Компонент | Требует авторизации | Описание |
|------|-----------|---------------------|----------|
| `/subscription` | `SubscriptionPage` | Да (Telegram WebApp) | Выбор и покупка тарифа |
| `/settings/subscription` | `SubscriptionDetailsPage` | Да | Управление подпиской |
| `/settings/history` | `PaymentHistoryPage` | Да | История платежей |

---

## Детали маршрутов

### `/subscription`

**Компонент:** `SubscriptionPage`

**Что показывает:**
- Заголовок с текущим статусом подписки
- Карточки тарифов (FREE, PRO_MONTHLY, PRO_YEARLY)
- Кнопки покупки/управления

**Требуемые данные:**
- `BillingContext.subscription` — статус подписки
- `BillingContext.billingMe` — план и лимиты
- Список планов (API или mock)

**Действия пользователя:**
- Нажать "Оформить подписку" → редирект на YooKassa
- Нажать "Включить автопродление" → toggle API
- Нажать "Добавить карту" → привязка карты

---

### `/settings/subscription`

**Компонент:** `SubscriptionDetailsPage`

**Что показывает:**
- Текущий тариф и дату истечения
- Toggle автопродления
- Способ оплаты (привязанная карта)
- Ссылка на историю оплат
- (Admin) Кнопка тестового платежа

**Требуемые данные:**
- `BillingContext.subscription`
- `AuthContext.isAdmin`

**Действия пользователя:**
- Toggle автопродления
- Привязать/сменить карту
- Перейти к истории платежей
- (Admin) Создать тестовый платёж

---

### `/settings/history`

**Компонент:** `PaymentHistoryPage`

**Что показывает:**
- Список платежей с датой, суммой, статусом
- Badge-статусы: succeeded, pending, failed, canceled, refunded

**Требуемые данные:**
- `GET /billing/payments/` → `PaymentHistoryItem[]`

**Действия пользователя:**
- Просмотр информации о платежах
- Возврат на предыдущий экран

---

## Навигация

```
/subscription
    ↓ "Управлять автопродлением"
/settings/subscription
    ↓ "История оплат"
/settings/history
```

---

## Конфигурация маршрутов (App.tsx)

```tsx
<Route path="subscription" element={<SubscriptionPage />} />
<Route path="settings/subscription" element={<SubscriptionDetailsPage />} />
<Route path="settings/history" element={<PaymentHistoryPage />} />
```

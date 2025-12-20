# FILE MAP — Billing Feature Module

> Карта файлов модуля биллинга с описанием роли и связей.

---

## Структура каталогов

```
src/features/billing/
├── pages/                     # Страницы
├── components/                # UI-компоненты
├── hooks/                     # React-хуки
├── utils/                     # Утилиты
├── __mocks__/                 # Mock-данные для DEV
├── docs/                      # Документация
└── index.ts                   # Barrel export
```

---

## Файлы и их роли

### Страницы (pages/)

| Файл | Роль | Используется |
|------|------|--------------|
| `SubscriptionPage.tsx` | Экран выбора тарифа с карточками планов | `App.tsx` (`/subscription`) |
| `SubscriptionDetailsPage.tsx` | Детали подписки, автопродление, карта | `App.tsx` (`/settings/subscription`) |
| `PaymentHistoryPage.tsx` | Список платежей пользователя | `App.tsx` (`/settings/history`) |

### Компоненты (components/)

| Файл | Роль | Используется |
|------|------|--------------|
| `PlanCard.tsx` | Карточка тарифного плана | `SubscriptionPage` |
| `subscription/SubscriptionHeader.tsx` | Заголовок экрана подписки | `SubscriptionPage` |
| `billing/AdminTestPaymentCard.tsx` | Карточка тестового платежа для админов | `SubscriptionDetailsPage` |
| `billing/PaymentHistoryList.tsx` | Список платежей с badge-статусами | `PaymentHistoryPage` |

### Хуки (hooks/)

| Файл | Роль | Используется |
|------|------|--------------|
| `useSubscriptionPlans.ts` | Загрузка списка тарифов (mock в DEV) | `SubscriptionPage` |
| `useSubscriptionStatus.ts` | Вычисление статуса подписки | `SubscriptionPage` |
| `useSubscriptionActions.ts` | Действия: оплата, toggle, карта | `SubscriptionPage` |
| `useSubscriptionDetails.ts` | Логика страницы деталей | `SubscriptionDetailsPage` |
| `usePaymentHistory.ts` | Загрузка истории платежей | `PaymentHistoryPage` |

### Утилиты (utils/)

| Файл | Роль | Используется |
|------|------|--------------|
| `date.ts` | Форматирование дат (единый источник) | Все компоненты |
| `notify.ts` | Уведомления (Telegram/browser) | Все хуки |
| `validation.ts` | Валидация plan_code | `BillingContext` |
| `planCardState.tsx` | Логика состояния карточки плана | `SubscriptionPage` |

### Mocks (__mocks__/)

| Файл | Роль | Используется |
|------|------|--------------|
| `plans.ts` | Mock-данные тарифов для DEV | `useSubscriptionPlans` |

---

## Внешние зависимости

| Файл | Зависит от |
|------|------------|
| `pages/*` | `BillingContext`, `AuthContext`, хуки, компоненты |
| `hooks/*` | `api` (services/api), `BillingContext` |
| `components/*` | types/billing, constants/billing |

---

## Экспорты (index.ts)

Все публичные элементы модуля экспортируются через `index.ts`:

```typescript
// Pages
export { SubscriptionPage, SubscriptionDetailsPage, PaymentHistoryPage }

// Components
export { PlanCard, SubscriptionHeader, AdminTestPaymentCard, PaymentHistoryList }

// Hooks
export { useSubscriptionPlans, useSubscriptionStatus, useSubscriptionActions, ... }

// Utils
export { formatBillingDate, showToast, validatePlanCode, buildPlanCardState, ... }

// Mocks
export { mockSubscriptionPlans }
```

# Billing Frontend Audit — EatFit24

> **Дата аудита:** 2025-12-20  
> **Версия:** 1.0  
> **Автор:** AI Audit System

---

## 1. Executive Summary

### Как биллинг реализован на фронтенде

Биллинг в EatFit24 реализован **централизованно** с использованием:

- **React Context** (`BillingContext`) — глобальное состояние подписки и лимитов
- **Отдельный API-модуль** (`services/api/billing.ts`) — все вызовы к `/billing/*` эндпоинтам
- **Типизация TypeScript** (`types/billing.ts`) — строгие интерфейсы для API
- **Переиспользуемые хуки** — специализированные хуки для действий с подпиской

### Ключевые точки входа

| Роут | Страница | Назначение |
|------|----------|------------|
| `/subscription` | `SubscriptionPage` | Выбор и покупка тарифа |
| `/settings/subscription` | `SubscriptionDetailsPage` | Управление подпиской (автопродление, карта) |
| `/settings/history` | `PaymentHistoryPage` | История платежей |
| `/log` | `FoodLogPage` | Отображение лимитов фото, модалка достижения лимита |

### Общее состояние

✅ **Централизовано:**
- Один источник истины для billing state (`BillingContext`)
- Единый API-модуль для всех billing-запросов
- Типы определены в одном файле

⚠️ **Требует внимания:**
- Дублирование функций форматирования дат в разных файлах
- Mock-данные захардкожены в `useSubscriptionPlans.ts`
- Legacy-коды планов (`MONTHLY`, `YEARLY`) требуют нормализации

---

## 2. Карта файлов (ОСНОВНОЙ РАЗДЕЛ)

| Путь к файлу | Тип | Назначение | Кем используется |
|-------------|-----|------------|------------------|
| `src/types/billing.ts` | type | Типы для Billing API: BillingMe, SubscriptionPlan, PaymentMethod, etc. | Все billing-компоненты и хуки |
| `src/services/api/billing.ts` | api/service | Все API-вызовы к `/billing/*` эндпоинтам | BillingContext, хуки |
| `src/services/api/urls.ts` | config | URL-константы всех billing-эндпоинтов | `api/billing.ts` |
| `src/services/api/index.ts` | api/service | Экспорт billing-функций в общий объект `api` | Вся кодовая база |
| `src/contexts/BillingContext.tsx` | context/store | Глобальный стейт подписки, лимитов, методы refresh/setAutoRenew | Все страницы приложения |
| `src/pages/SubscriptionPage.tsx` | page | Экран выбора тарифа (FREE/PRO_MONTHLY/PRO_YEARLY) | App.tsx (route: /subscription) |
| `src/pages/SubscriptionDetailsPage.tsx` | page | Детали подписки: автопродление, способ оплаты, история | App.tsx (route: /settings/subscription) |
| `src/pages/PaymentHistoryPage.tsx` | page | История платежей пользователя | App.tsx (route: /settings/history) |
| `src/pages/FoodLogPage.tsx` | page | Отображение лимитов фото, модалка «Лимит исчерпан» | App.tsx (route: /log) |
| `src/components/PlanCard.tsx` | component | Карточка тарифного плана с кнопкой покупки | SubscriptionPage |
| `src/components/subscription/SubscriptionHeader.tsx` | component | Заголовок экрана подписки (статус, название) | SubscriptionPage |
| `src/components/billing/AdminTestPaymentCard.tsx` | component | Карточка для тестового платежа 1₽ (только админы) | SubscriptionDetailsPage |
| `src/components/billing/PaymentHistoryList.tsx` | component | Список платежей с badge-статусами | PaymentHistoryPage |
| `src/hooks/useSubscriptionPlans.ts` | hook | Загрузка списка тарифов с бэкенда / mock в DEV | SubscriptionPage |
| `src/hooks/useSubscriptionStatus.ts` | hook | Вычисление статуса подписки (isPro, isExpired, texts) | SubscriptionPage |
| `src/hooks/useSubscriptionActions.ts` | hook | Действия: оплата, toggle autorenew, добавление карты | SubscriptionPage |
| `src/hooks/useSubscriptionDetails.ts` | hook | Логика страницы деталей подписки | SubscriptionDetailsPage |
| `src/hooks/usePaymentHistory.ts` | hook | Загрузка истории платежей | PaymentHistoryPage |
| `src/hooks/useFoodBatchAnalysis.ts` | hook | Обработка daily limit ошибок при загрузке фото | FoodLogPage |
| `src/hooks/useApiError.ts` | hook | Обработка DAILY_LIMIT_REACHED ошибок | FoodLogPage и другие |
| `src/utils/buildPlanCardState.tsx` | util | Логика состояния карточки плана (buttons, bottomContent) | SubscriptionPage |
| `src/utils/date.ts` | util | Форматирование дат для billing (formatBillingDate, formatShortDate) | PaymentHistoryList, хуки |
| `src/constants/billing.ts` | config | Badge-стили для статусов платежей | PaymentHistoryList |
| `src/constants/index.ts` | config | PLAN_CODES, API_ERROR_CODES, ERROR_MESSAGES для billing | Вся кодовая база |
| `src/config/env.ts` | config/env | IS_DEV (для mock-планов) | useSubscriptionPlans |
| `src/features/trainer-panel/pages/SubscribersPage.tsx` | page | Trainer Panel: список подписчиков с plan_type | Trainer Panel |
| `src/services/api/trainer.ts` | api/service | Trainer API: getSubscribers (subscribers + stats) | SubscribersPage |

---

## 3. Карта роутов (Billing Routes)

| Путь | Компонент | Что показывает | Требует авторизации | Billing напрямую |
|------|-----------|----------------|---------------------|------------------|
| `/subscription` | `SubscriptionPage` | Экран тарифов: FREE, PRO_MONTHLY, PRO_YEARLY с кнопками покупки | Да (Telegram WebApp) | ✅ Да |
| `/settings/subscription` | `SubscriptionDetailsPage` | Детали подписки: автопродление, способ оплаты, ссылка на историю | Да | ✅ Да |
| `/settings/history` | `PaymentHistoryPage` | Список всех платежей пользователя | Да | ✅ Да |
| `/log` | `FoodLogPage` | Загрузка фото еды, показ лимитов и модалка «Лимит исчерпан» | Да | ⚠️ Частично (лимиты) |
| `/` | `ClientDashboard` | Главный дашборд (использует BillingContext для isPro) | Да | ⚠️ Частично (статус) |
| `/panel/subscribers` | `SubscribersPage` | Trainer Panel: список подписчиков с типами планов | Да (Admin) | ⚠️ Trainer billing |

---

## 4. Карта API-вызовов Billing

### Основные Billing эндпоинты

| Эндпоинт | Файл | Функция | HTTP | Назначение |
|----------|------|---------|------|------------|
| `/billing/me/` | `billing.ts` | `getBillingMe()` | GET | Получить текущий plan_code, лимиты, used_today |
| `/billing/plans/` | `billing.ts` | `getSubscriptionPlans()` | GET | Получить список доступных тарифов |
| `/billing/subscription/` | `billing.ts` | `getSubscriptionDetails()` | GET | Детальная информация о подписке |
| `/billing/subscription/autorenew/` | `billing.ts` | `setAutoRenew(enabled)` | POST | Включить/выключить автопродление |
| `/billing/create-payment/` | `billing.ts` | `createPayment(request)` | POST | Создать платёж, получить confirmation_url |
| `/billing/create-test-live-payment/` | `billing.ts` | `createTestLivePayment()` | POST | Тестовый платёж 1₽ (только админы) |
| `/billing/payment-method/` | `billing.ts` | `getPaymentMethod()` | GET | Информация о привязанной карте |
| `/billing/bind-card/start/` | `billing.ts` | `bindCard()` | POST | Начать привязку карты (1₽ платёж) |
| `/billing/payments/` | `billing.ts` | `getPaymentsHistory(limit)` | GET | История платежей с пагинацией |

### Trainer Panel эндпоинты (связано с billing)

| Эндпоинт | Файл | Функция | HTTP | Назначение |
|----------|------|---------|------|------------|
| `/telegram/subscribers/` | `trainer.ts` | `getSubscribers()` | GET | Список подписчиков с plan_type и stats |

### URL-константы (src/services/api/urls.ts)

```typescript
// Billing endpoints (current - use these)
billingMe: `${API_BASE}/billing/me/`,
subscriptionDetails: `${API_BASE}/billing/subscription/`,
subscriptionAutoRenew: `${API_BASE}/billing/subscription/autorenew/`,
createPayment: `${API_BASE}/billing/create-payment/`,
paymentMethodDetails: `${API_BASE}/billing/payment-method/`,
paymentsHistory: `${API_BASE}/billing/payments/`,
bindCardStart: `${API_BASE}/billing/bind-card/start/`,
plans: `${API_BASE}/billing/plans/`,
```

---

## 5. UI Flow биллинга (цепочка)

### Flow 1: Покупка подписки (стандартный)

```
SubscriptionPage (экран тарифов)
    ↓
Пользователь нажимает "Оформить подписку" на карточке PRO
    ↓
useSubscriptionActions.handleSelectPlan(planId)
    ↓
billing.createPayment({ plan_code, save_payment_method: true })
    ↓
Backend возвращает { confirmation_url }
    ↓
Telegram.WebApp.openLink(confirmation_url) → redirect на YooKassa
    ↓
Пользователь оплачивает
    ↓
YooKassa redirect → return_url (бэкенд обрабатывает webhook)
    ↓
Пользователь возвращается в приложение
    ↓
BillingContext.refresh() → обновление UI
```

**Файлы:**
- `SubscriptionPage.tsx` — UI выбора плана
- `useSubscriptionActions.ts` — логика handleSelectPlan
- `billing.ts` — createPayment API call
- `BillingContext.tsx` — обновление стейта

### Flow 2: Привязка карты

```
SubscriptionDetailsPage → клик на "Способ оплаты"
    ↓
useSubscriptionDetails.handlePaymentMethodClick()
    ↓
billing.bindCard() → POST /billing/bind-card/start/
    ↓
Backend возвращает { confirmation_url } для 1₽ платежа
    ↓
Telegram.WebApp.openLink(confirmation_url)
    ↓
После успеха → карта сохранена, autorenew_available = true
```

**Файлы:**
- `SubscriptionDetailsPage.tsx`
- `useSubscriptionDetails.ts`
- `billing.ts` → bindCard()

### Flow 3: Toggle Auto-Renew

```
SubscriptionDetailsPage или PlanCard
    ↓
handleToggleAutoRenew()
    ↓
billing.setAutoRenew(!autoRenewEnabled)
    ↓
Backend toggle, возвращает обновлённый SubscriptionDetails
    ↓
UI обновляется
```

**Файлы:**
- `useSubscriptionDetails.ts` / `useSubscriptionActions.ts`
- `billing.ts` → setAutoRenew()

### Flow 4: Обработка Daily Limit

```
FoodLogPage → загрузка фото
    ↓
Backend возвращает ошибку DAILY_LIMIT_REACHED
    ↓
useFoodBatchAnalysis обнаруживает код ошибки
    ↓
onDailyLimitReached() callback
    ↓
showLimitModal(true) — показ модалки
    ↓
Кнопка "Оформить PRO" → navigate('/subscription')
```

**Файлы:**
- `FoodLogPage.tsx` — модалка лимита
- `useFoodBatchAnalysis.ts` — обработка ошибки
- `constants/index.ts` — API_ERROR_CODES.DAILY_LIMIT_REACHED

---

## 6. Проблемы, дубли, legacy (ОЧЕНЬ ВАЖНО)

### 6.1 Дубли функций форматирования дат

> **Severity:** LOW

Функция `formatDate` дублируется в нескольких файлах:

| Файл | Функция |
|------|---------|
| `utils/date.ts` | `formatBillingDate()`, `formatShortDate()` |
| `utils/buildPlanCardState.tsx` | Локальная `formatDate()` (строки 33-40) |
| `hooks/useSubscriptionStatus.ts` | Локальная `formatDate()` (строки 11-17) |
| `features/trainer-panel/pages/SubscribersPage.tsx` | Локальная `formatDate()` (строки 60-67) |

**Рекомендация:** Вынести единую функцию в `utils/date.ts` и использовать везде.

### 6.2 Hardcoded Mock-данные в `useSubscriptionPlans.ts`

> **Severity:** MEDIUM

```typescript
// DEV MODE: Mock subscription plans for testing UI
const mockApiPlans = [
    {
        code: 'FREE',
        display_name: 'Базовый',
        price: 0,
        // ...
    },
    {
        code: 'PRO_MONTHLY',
        display_name: 'PRO месяц',
        price: 299,
        // ...
    },
```

Mock-данные с ценами и features захардкожены прямо в хуке.

**Рекомендация:** Вынести mock-данные в отдельный файл `__mocks__/billing.ts` или использовать единый источник.

### 6.3 Legacy-коды планов

> **Severity:** LOW

В `constants/index.ts` есть legacy-маппинг:

```typescript
export const PLAN_CODES = {
    FREE: 'FREE',
    PRO_MONTHLY: 'PRO_MONTHLY',
    PRO_YEARLY: 'PRO_YEARLY',
    // Legacy codes (for backward compatibility)
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
} as const;
```

Также есть `normalizePlanCode()` для конвертации.

В `types/billing.ts`:
```typescript
export type BillingPlanCode = 'FREE' | 'MONTHLY' | 'YEARLY' | 'PRO_MONTHLY' | 'PRO_YEARLY';
```

**Статус:** Обратная совместимость сохранена через `normalizePlanCode()`. Не баг, но требует документации.

### 6.4 Дублирование логики showToast / showAlert

> **Severity:** LOW

Функция показа уведомлений дублируется:

| Файл | Реализация |
|------|------------|
| `useSubscriptionActions.ts` | `showToast(message)` — строки 36-43 |
| `useSubscriptionDetails.ts` | `showToast(message)` — строки 55-62 |

Обе делают одно и то же: `Telegram.WebApp.showAlert` или `alert()`.

**Рекомендация:** Вынести в `utils/telegram.ts` или использовать `ToastContext`.

### 6.5 Неиспользуемый toggle в `BillingContext`

> **Severity:** VERY LOW

```typescript
toggleAutoRenew: (enable: boolean) => Promise<void>; // Kept for compatibility, redirects to setAutoRenew
```

`toggleAutoRenew` является wrapper'ом над `setAutoRenew`, но naming confusing — передаётся `enable`, а не toggle.

### 6.6 Потенциальная проблема UX: отсутствие debounce на кнопках

> **Severity:** MEDIUM

При нажатии на кнопку оплаты:
- Есть `setLoadingPlanId(planId)` для блокировки
- Кнопка становится `disabled`

НО: если запрос очень быстрый или пользователь делает double-click до установки loading state, возможен double payment request.

**Файлы затронуты:**
- `useSubscriptionActions.ts` → `handleSelectPlan`
- `useSubscriptionDetails.ts` → `handleToggleAutoRenew`, `handleCreateTestPayment`

**Рекомендация:** Добавить `useRef` для tracking in-flight requests или debounce.

### 6.7 Отсутствие проверки `confirmation_url`

> **Severity:** LOW

В `billing.ts` → `createPayment()` не проверяется, что `confirmation_url` валиден перед редиректом:

```typescript
const { confirmation_url } = await api.createPayment({...});
window.Telegram.WebApp.openLink(confirmation_url);
```

Если бэкенд вернёт невалидный URL, пользователь получит ошибку.

### 6.8 Trainer Panel: Отдельная типизация Subscriber

> **Severity:** VERY LOW

В `trainer.ts` и `SubscribersPage.tsx` определён свой интерфейс `Subscriber`:

```typescript
// trainer.ts
export interface Subscriber {
    plan_type: 'free' | 'monthly' | 'yearly';
    // ...
}
```

Это отличается от `types/billing.ts` где используется `BillingPlanCode`.

**Статус:** Не критично, так как это разные API endpoints.

### 6.9 Нет Skeleton/Loading для карточек планов

> **Severity:** LOW

В `SubscriptionPage.tsx` при загрузке планов показывается только spinner:

```tsx
{loadingPlans ? (
    <Loader2 className="animate-spin" />
) : ...}
```

**Рекомендация:** Добавить skeleton-карточки для лучшего UX.

### 6.10 Polling отсутствует

> **Severity:** LOW

После редиректа с YooKassa обратно в приложение нет автоматического polling для проверки статуса платежа. Пользователь должен вручную refresh или дождаться reload.

**Workaround:** `BillingContext.refresh()` вызывается при открытии страницы.

---

## 7. Неиспользуемые файлы

> **Проверка:** Все найденные файлы активно используются.

Не обнаружено неиспользуемых billing-файлов. Все компоненты, хуки и API-функции импортируются.

---

## 8. Итоги и рекомендации

### ✅ Что хорошо

1. **Централизованный API-модуль** — все billing-вызовы в одном файле
2. **Строгая типизация** — интерфейсы для всех API-ответов
3. **Глобальный Context** — единый источник истины для billing state
4. **Переиспользуемые хуки** — логика вынесена из компонентов
5. **Обработка ошибок** — локализованные сообщения в `ERROR_MESSAGES`

### ⚠️ Что улучшить (без изменения кода)

1. Консолидировать функции форматирования дат
2. Вынести mock-данные в отдельный файл
3. Унифицировать `showToast` в один utility
4. Добавить debounce/lock на payment buttons
5. Рассмотреть polling после возврата с YooKassa

---

## Приложение: Граф зависимостей

```
App.tsx
└── BillingProvider (context)
    ├── SubscriptionPage
    │   ├── useSubscriptionPlans (→ api.getSubscriptionPlans)
    │   ├── useSubscriptionStatus
    │   ├── useSubscriptionActions (→ api.createPayment, setAutoRenew)
    │   ├── PlanCard
    │   │   └── buildPlanCardState (util)
    │   └── SubscriptionHeader
    │
    ├── SubscriptionDetailsPage
    │   ├── useSubscriptionDetails (→ api.setAutoRenew, bindCard)
    │   ├── AdminTestPaymentCard (→ api.createTestLivePayment)
    │   └── → PaymentHistoryPage route
    │
    ├── PaymentHistoryPage
    │   ├── usePaymentHistory (→ api.getPaymentsHistory)
    │   └── PaymentHistoryList
    │       └── billing constants (PAYMENT_STATUS_BADGES)
    │
    └── FoodLogPage
        ├── useFoodBatchAnalysis (daily limit handling)
        └── BillingContext.data (лимиты, isPro)
```

---

**Аудит завершён. Код не модифицирован.**

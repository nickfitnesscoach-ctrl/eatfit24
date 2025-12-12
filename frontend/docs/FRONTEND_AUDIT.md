# Frontend Audit Report — EatFit24

**Дата аудита:** 2024-12
**Версия:** 1.0

---

## 1. Структура проекта

### 1.1 Страницы (Pages)

| Страница | Файл | Статус | Описание |
|----------|------|--------|----------|
| Главная (дневник) | `ClientDashboard.tsx` | ✅ OK | Отображение КБЖУ за день |
| Загрузка фото | `FoodLogPage.tsx` | ✅ OK | Batch upload + AI recognition |
| Детали приёма пищи | `MealDetailsPage.tsx` | ✅ OK | CRUD для FoodItems |
| Подписка | `SubscriptionPage.tsx` | ✅ OK | Выбор и оплата тарифа |
| Профиль | `ProfilePage.tsx` | ✅ OK | Редактирование профиля |
| Настройки | `SettingsPage.tsx` | ✅ OK | Настройки приложения |
| Детали подписки | `SubscriptionDetailsPage.tsx` | ✅ OK | Управление подпиской |
| История платежей | `PaymentHistoryPage.tsx` | ✅ OK | Список платежей |
| Заявки (тренер) | `ApplicationsPage.tsx` | ✅ OK | Панель тренера |
| Клиенты (тренер) | `ClientsPage.tsx` | ✅ OK | Панель тренера |
| Подписчики (тренер) | `SubscribersPage.tsx` | ✅ OK | Панель тренера |

### 1.2 Контексты (Contexts)

| Контекст | Файл | Статус | Назначение |
|----------|------|--------|------------|
| AuthContext | `AuthContext.tsx` | ✅ OK | Telegram WebApp авторизация |
| BillingContext | `BillingContext.tsx` | ✅ OK | Подписка + лимиты |
| ToastContext | `ToastContext.tsx` | ✅ OK | Уведомления |
| ThemeContext | `ThemeContext.tsx` | ✅ OK | Тема (light/dark) |
| ClientsContext | `ClientsContext.tsx` | ✅ OK | Клиенты тренера |

### 1.3 API-слой

| Модуль | Файл | Статус | Описание |
|--------|------|--------|----------|
| Base Client | `client.ts` | ✅ **ИСТИНА** | Единый HTTP-клиент, error handling |
| Types | `types.ts` | ✅ OK | Типы для API |
| URLs | `urls.ts` | ✅ OK | Константы URL |
| Auth | `auth.ts` | ✅ OK | Telegram авторизация |
| AI | `ai.ts` | ✅ OK | AI Recognition |
| Nutrition | `nutrition.ts` | ✅ OK | Meals, FoodItems, Goals |
| Billing | `billing.ts` | ✅ OK | Подписки, платежи |
| Profile | `profile.ts` | ✅ OK | Профиль пользователя |
| Index | `index.ts` | ✅ OK | Реэкспорт + backward-compatible `api` |
| Legacy | `api.ts` | ⚠️ **LEGACY** | Только реэкспорт (можно удалить) |

### 1.4 Хуки

| Хук | Файл | Статус | Назначение |
|-----|------|--------|------------|
| useApiError | `useApiError.ts` | ✅ OK | Централизованная обработка ошибок |
| useTaskPolling | `useTaskPolling.ts` | ⚠️ **ДУБЛИРУЕТ** | Polling (дублирует логику в FoodLogPage) |
| useTelegramWebApp | `useTelegramWebApp.ts` | ✅ OK | Telegram WebApp SDK |
| useOnlineStatus | `useOnlineStatus.ts` | ✅ OK | Offline detection |
| useErrorHandler | `useErrorHandler.tsx` | ⚠️ **НЕ ИСПОЛЬЗУЕТСЯ** | Generic error handler |
| useDebounce | `useDebounce.ts` | ✅ OK | Debounce |
| useProfile | `useProfile.ts` | ✅ OK | Profile management |

---

## 2. API-клиент: Унификация

### 2.1 Текущее состояние

**✅ Хорошо:**
- Единый `client.ts` с `fetchWithTimeout`, `fetchWithRetry`
- Unified error format: `ApiError` с `code`, `message`, `details`, `status`
- Централизованный `parseApiError()` для всех форматов backend
- Глобальный перехват 401/403 через `dispatchAuthError()`
- Все API-модули используют `client.ts`

**⚠️ Проблемы:**

1. **Прямой `fetch` в `useTaskPolling.ts` (строка 78):**
   ```typescript
   const response = await fetch(`${API_BASE}/ai/task/${taskId}/`, {
   ```
   **Исправление:** Использовать `api.getTaskStatus(taskId)` из `ai.ts`

2. **Прямой `fetch` в `Layout.tsx` (строка 42):**
   ```typescript
   const response = await fetch('/api/v1/trainer-panel/auth/', {
   ```
   **Исправление:** Использовать `api.trainerPanelAuth()` из `auth.ts`

3. **Дублирование polling логики:**
   - `useTaskPolling.ts` — хук
   - `FoodLogPage.tsx` → `pollTaskStatus()` — встроенная функция
   
   **Рекомендация:** Удалить `pollTaskStatus()` из `FoodLogPage.tsx`, использовать `useTaskPolling`

### 2.2 Рекомендуемые действия

| Приоритет | Действие | Файл |
|-----------|----------|------|
| 🔴 HIGH | Заменить прямой fetch на api.getTaskStatus | `useTaskPolling.ts` |
| 🔴 HIGH | Заменить прямой fetch на api.trainerPanelAuth | `Layout.tsx` |
| 🟡 MEDIUM | Рефакторинг polling в FoodLogPage (использовать хук) | `FoodLogPage.tsx` |
| 🟢 LOW | Удалить legacy `services/api.ts` (только реэкспорт) | `api.ts` |

---

## 3. Error Handling: Соответствие Backend

### 3.1 Актуальные коды ошибок

**Backend error codes (из `constants/index.ts`):**

| Код | HTTP | Описание | Обработка во фронте |
|-----|------|----------|---------------------|
| `DAILY_LIMIT_REACHED` | 429 | Лимит фото | ✅ Toast + CTA PRO |
| `NOT_AVAILABLE_FOR_FREE` | 409 | Только PRO | ✅ Toast + redirect /subscription |
| `AI_RECOGNITION_FAILED` | 502 | AI не распознал | ✅ Warning toast |
| `AI_SERVICE_TIMEOUT` | 502 | Таймаут AI | ✅ Error toast |
| `AI_SERVICE_ERROR` | 502 | Ошибка AI сервиса | ✅ Error toast |
| `AI_EMPTY_RESULT` | - | Нет распознанных items | ⚠️ **Неконсистентно** |
| `INVALID_IMAGE` | 400 | Плохое изображение | ✅ Error toast |
| `NO_PAYMENT_METHOD` | 409 | Нет карты | ✅ Error toast |
| `ACTIVE_SUBSCRIPTION` | 409 | Уже есть подписка | ✅ Info toast |
| `TIMEOUT` | - | Timeout запроса | ✅ Error toast |
| `NETWORK_ERROR` | - | Ошибка сети | ✅ Error toast |
| `UNAUTHORIZED` | 401 | Не авторизован | ✅ Global AuthErrorModal |

### 3.2 Проблемы

1. **`AI_EMPTY_RESULT` не возвращается backend:**
   - В `FoodLogPage.tsx` используется custom errorType `AI_EMPTY_RESULT`
   - Backend возвращает `success: false` с `error` message
   - **Исправление:** Проверять `error.code` из backend, а не custom errorType

2. **Inconsistent error handling в MealDetailsPage:**
   ```typescript
   const errorMessage = err instanceof Error ? err.message : 'Не удалось удалить приём пищи';
   ```
   **Исправление:** Использовать `useApiError` хук вместо manual handling

3. **Отсутствует CTA "Купить PRO" при `AI_SERVICE_TIMEOUT`:**
   - Пользователь видит только сообщение, но нет предложения retry или upgrade
   **Рекомендация:** Добавить кнопку "Попробовать снова" в toast

### 3.3 Рекомендации

| Приоритет | Действие | Файл |
|-----------|----------|------|
| 🔴 HIGH | Унифицировать error handling через useApiError | `MealDetailsPage.tsx` |
| 🟡 MEDIUM | Добавить retry CTA при AI timeout | `FoodLogPage.tsx` |
| 🟡 MEDIUM | Удалить custom errorType, использовать backend codes | `FoodLogPage.tsx` |

---

## 4. AI Flow: Анализ

### 4.1 Текущая цепочка

```
1. FoodLogPage: handleAnalyze()
   ↓
2. processBatch() → convertHeicToJpeg() → api.recognizeFood()
   ↓
3. Backend response:
   - HTTP 200 (sync mode) → result immediately
   - HTTP 202 (async mode) → { task_id, meal_id }
   ↓
4. pollTaskStatus() (встроенный в FoodLogPage)
   - Exponential backoff: 1s → 2s → 4s → 8s → 10s (max)
   - Max duration: 60s
   ↓
5. Task states:
   - PENDING/STARTED/RETRY → continue polling
   - SUCCESS → extract recognized_items
   - FAILURE → show error
   ↓
6. Universal Fallback (если items пусто, но есть meal_id):
   - До 3 retry с задержкой 1s/2s/3s
   - api.getMealAnalysis(meal_id)
   ↓
7. Результат → BatchResultsModal
```

### 4.2 Состояния и UX

| Состояние | UI | Статус |
|-----------|----| -------|
| Загрузка файлов | Spinner + progress | ✅ OK |
| PENDING/STARTED | "Обработка фотографий..." | ✅ OK |
| SUCCESS (с items) | BatchResultsModal с данными | ✅ OK |
| SUCCESS (без items, есть meal_id) | Нейтральное сообщение | ✅ OK (hotfix) |
| SUCCESS (без items, без meal_id) | Error "Ошибка обработки" | ✅ OK |
| FAILURE | Error message | ✅ OK |
| TIMEOUT | Error "Превышено время" | ✅ OK |
| Network Error | Error "Ошибка сети" | ✅ OK |

### 4.3 Проблемы и улучшения

1. **✅ ИСПРАВЛЕНО:** "Еда не распознана" заменено на нейтральное сообщение
   - Если есть `meal_id` но нет `items` — показываем "Анализ завершён, проверьте дневник"
   - Hotfix через `_neutralMessage` поле

2. **⚠️ Дублирование polling логики:**
   - `FoodLogPage.tsx:pollTaskStatus()` (400+ строк)
   - `useTaskPolling.ts` хук
   **Рекомендация:** Унифицировать, использовать только хук

3. **⚠️ `useTaskPolling.ts` использует прямой fetch:**
   - Не использует `api.getTaskStatus()`
   - Не использует unified error handling
   **Исправление:** Рефакторинг хука

---

## 5. Дневник и приёмы пищи

### 5.1 Функционал

| Операция | Эндпоинт | Статус |
|----------|----------|--------|
| Список meals за день | `GET /meals/?date=YYYY-MM-DD` | ✅ OK |
| Создание meal | `POST /meals/` | ✅ OK |
| Удаление meal | `DELETE /meals/{id}/` | ✅ OK |
| Детали meal | `GET /meals/{id}/` | ✅ OK |
| Добавление food item | `POST /meals/{meal_id}/items/` | ✅ OK |
| Удаление food item | `DELETE /meals/{meal_id}/items/{id}/` | ✅ OK |
| Редактирование food item | `PATCH /meals/{meal_id}/items/{id}/` | ✅ OK |

### 5.2 Error Handling

**MealDetailsPage:**
- ⚠️ Ручной error handling вместо `useApiError`
- ⚠️ Toast notifications не используются для всех ошибок

**ClientDashboard:**
- ✅ Корректная загрузка данных
- ✅ Обработка пустого списка

### 5.3 Рекомендации

| Приоритет | Действие | Файл |
|-----------|----------|------|
| 🟡 MEDIUM | Использовать useApiError для всех ошибок | `MealDetailsPage.tsx` |
| 🟢 LOW | Добавить optimistic updates для удаления | `MealDetailsPage.tsx` |

---

## 6. Подписки и лимиты

### 6.1 Текущая архитектура

```
BillingContext
├── subscription: SubscriptionDetails  // GET /billing/subscription/
├── billingMe: BillingMe               // GET /billing/me/ (лимиты)
├── isPro: boolean                     // computed
├── isLimitReached: boolean            // computed
└── methods: refresh(), setAutoRenew(), addPaymentMethod()
```

### 6.2 Реакция на ошибки

| Ошибка | Реакция | Статус |
|--------|---------|--------|
| `DAILY_LIMIT_REACHED` | Toast + Modal с CTA PRO | ✅ OK |
| `NOT_AVAILABLE_FOR_FREE` | Toast + redirect /subscription | ✅ OK |
| `NO_PAYMENT_METHOD` | Toast | ✅ OK |
| `ACTIVE_SUBSCRIPTION` | Info toast | ✅ OK |

### 6.3 UI компоненты

| Компонент | Назначение | Статус |
|-----------|------------|--------|
| `SubscriptionPage` | Выбор тарифа | ✅ OK |
| `PlanCard` | Карточка тарифа | ✅ OK |
| `SubscriptionDetailsPage` | Управление подпиской | ✅ OK |
| Footer в `FoodLogPage` | Индикатор лимитов | ✅ OK |
| Limit Modal | CTA при исчерпании лимита | ✅ OK |

---

## 7. Код для удаления/рефакторинга

### 7.1 Legacy код

| Файл | Причина | Действие |
|------|---------|----------|
| `services/api.ts` | Только реэкспорт | Удалить, обновить импорты |
| `useTaskPolling.ts` | Прямой fetch, не используется | Рефакторинг или удаление |
| `useErrorHandler.tsx` | Не используется нигде | Удалить |

### 7.2 Дублирующий код

| Место | Дубликат | Действие |
|-------|----------|----------|
| `FoodLogPage.tsx:pollTaskStatus()` | Дублирует `useTaskPolling` | Объединить |
| `Layout.tsx` прямой fetch | Есть `api.trainerPanelAuth()` | Использовать API |

### 7.3 Legacy URLs в `urls.ts`

```typescript
// Deprecated - помечены для удаления в v2.0
plan: `${API_BASE}/billing/plan`,              // Use billingMe
cancelSubscription: `${API_BASE}/billing/cancel/`,  // Not used
resumeSubscription: `${API_BASE}/billing/resume/`,  // Not used
paymentMethods: `${API_BASE}/billing/payment-methods/`,  // Use paymentMethodDetails
```

---

## 8. План действий (Sprint Tasks)

### 8.1 Критические (этот спринт)

| # | Задача | Файл | Оценка |
|---|--------|------|--------|
| 1 | Заменить прямой fetch на api.getTaskStatus | `useTaskPolling.ts` | 1h |
| 2 | Заменить прямой fetch на api.trainerPanelAuth | `Layout.tsx` | 30m |
| 3 | Унифицировать error handling в MealDetailsPage | `MealDetailsPage.tsx` | 1h |

### 8.2 Важные (следующий спринт)

| # | Задача | Файл | Оценка |
|---|--------|------|--------|
| 4 | Рефакторинг polling: удалить pollTaskStatus, использовать хук | `FoodLogPage.tsx` | 2h |
| 5 | Удалить неиспользуемые хуки | `useErrorHandler.tsx` | 15m |
| 6 | Удалить legacy api.ts | `services/api.ts` | 30m |
| 7 | Cleanup legacy URLs | `urls.ts` | 15m |

### 8.3 Улучшения (backlog)

| # | Задача | Описание |
|---|--------|----------|
| 8 | Retry CTA при AI timeout | Добавить кнопку "Попробовать снова" |
| 9 | Optimistic updates | Для удаления meals/items |
| 10 | Error boundary улучшения | Кастомные fallback UI |

---

## 9. Резюме

### Что уже хорошо:
- ✅ Единый API-клиент с unified error format
- ✅ Централизованные error codes в `constants/index.ts`
- ✅ useApiError хук для обработки ошибок
- ✅ AI flow работает корректно (sync/async)
- ✅ Hotfix для пустых результатов AI (нейтральное сообщение)
- ✅ Billing/Subscription flow полностью функционален
- ✅ Global auth error handling (401/403)

### Что требует внимания:
- ⚠️ 2 места с прямым fetch (обойти unified client)
- ⚠️ Дублирование polling логики
- ⚠️ Неиспользуемые хуки/файлы
- ⚠️ Inconsistent error handling в некоторых компонентах

### Технический долг:
- Legacy URLs в urls.ts
- Legacy api.ts (только реэкспорт)
- Неиспользуемый useErrorHandler.tsx

---

*Отчёт подготовлен: 2024-12*

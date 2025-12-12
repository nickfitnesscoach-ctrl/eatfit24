# Аналитический отчёт: Backend ↔ Frontend Integration Audit & Alignment

## 1. Текущее состояние интеграции

### 1.1 Общая архитектура взаимодействия

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  src/services/api/                                                    │   │
│  │  ├── client.ts      (fetchWithTimeout, headers, auth)                │   │
│  │  ├── ai.ts          (recognizeFood, getTaskStatus)                   │   │
│  │  ├── nutrition.ts   (meals, goals, food items)                       │   │
│  │  ├── billing.ts     (subscription, payments)                         │   │
│  │  ├── auth.ts        (telegram auth)                                  │   │
│  │  └── profile.ts     (user profile, avatar)                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/HTTPS
                                      │ X-Telegram-Init-Data header
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Django REST)                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  /api/v1/                                                             │   │
│  │  ├── ai/recognize/              (POST - sync/async)                  │   │
│  │  ├── ai/task/<id>/              (GET - polling)                      │   │
│  │  ├── meals/                     (CRUD)                               │   │
│  │  ├── goals/                     (CRUD)                               │   │
│  │  ├── billing/                   (subscriptions, payments)            │   │
│  │  ├── telegram/webapp/auth/      (authentication)                     │   │
│  │  └── users/profile/             (profile management)                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ (AI_ASYNC_ENABLED=True)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CELERY + REDIS                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  apps/ai/tasks.py                                                     │   │
│  │  └── recognize_food_async       (Celery task)                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AI PROXY SERVICE                                  │
│  └── OpenRouter API (Gemini 2.5 Flash)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Аутентификация

| Компонент | Реализация |
|-----------|------------|
| **Frontend** | Telegram WebApp initData в заголовке `X-Telegram-Init-Data` |
| **Backend** | `TelegramHeaderAuthentication` + `DebugModeAuthentication` |
| **Fallback** | Browser Debug Mode (`X-Debug-Mode: true`) для разработки |

### 1.3 Базовые URL

| Среда | Frontend API_BASE | Backend |
|-------|-------------------|---------|
| Development | `/api/v1` (proxy) | `localhost:8000` |
| Production | `/api/v1` (nginx) | `backend:8000` (Docker) |

---

## 2. Детальный анализ API по модулям

### 2.1 AI Recognition Module

#### Backend API (факт)

| Endpoint | Method | Request | Response (200) | Response (202) |
|----------|--------|---------|----------------|----------------|
| `/api/v1/ai/recognize/` | POST | `multipart/form-data`: image, description?, comment?, meal_type?, date? | `{ recognized_items[], total_*, meal_id, photo_url }` | `{ task_id, meal_id, status, message }` |
| `/api/v1/ai/task/<id>/` | GET | - | `{ task_id, state, result?, error?, message? }` | - |

**Backend Response Format (Sync - 200):**
```json
{
  "recognized_items": [
    {
      "name": "Овсянка",
      "grams": 250,
      "calories": 165,
      "protein": 5.5,
      "fat": 3.2,
      "carbohydrates": 28.0
    }
  ],
  "total_calories": 165,
  "total_protein": 5.5,
  "total_fat": 3.2,
  "total_carbohydrates": 28.0,
  "meal_id": 123,
  "photo_url": "/media/meals/photo.jpg"
}
```

**Backend Response Format (Async - 202):**
```json
{
  "task_id": "abc-123-def",
  "meal_id": "456",
  "status": "processing",
  "message": "Изображение отправлено на распознавание"
}
```

**Backend Task Status (SUCCESS):**
```json
{
  "task_id": "abc-123-def",
  "state": "SUCCESS",
  "result": {
    "success": true,
    "meal_id": "456",
    "recognized_items": [...],
    "totals": { "calories": 165, "protein": 5.5, ... },
    "recognition_time": 2.5
  }
}
```

#### Frontend Expectations (факт)

**File: `src/services/api/ai.ts`**

```typescript
// Frontend expects these interfaces
interface RecognizeResult {
  recognized_items: Array<{
    name: string;
    grams: number;        // Backend maps estimated_weight -> grams
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
  }>;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbohydrates: number;
  meal_id?: number | string;
  photo_url?: string;
  isAsync: false;
}

interface RecognizeAsyncResult {
  task_id: string;
  meal_id: string;
  status: string;
  message?: string;
  isAsync: true;
}
```

#### Сравнительная таблица: AI Recognition

| Аспект | Backend (факт) | Frontend (ожидание) | Статус |
|--------|----------------|---------------------|--------|
| Sync response fields | `recognized_items[], total_*, meal_id, photo_url` | Идентично + `isAsync: false` | ✅ OK |
| Async response (202) | `{ task_id, meal_id, status, message }` | `{ task_id, meal_id, status, message, isAsync: true }` | ✅ OK (frontend добавляет isAsync) |
| Item field: weight | `grams` (after serializer mapping) | `grams` | ✅ OK |
| Task polling response | `{ task_id, state, result }` | `{ task_id, state, result }` | ✅ OK |
| Task result.totals | `{ calories, protein, fat, carbohydrates }` | `{ calories, protein, fat, carbohydrates }` | ✅ OK |
| Empty items handling | Returns meal_id even if items empty | Frontend does fallback to getMealAnalysis | ⚠️ WORKAROUND |

---

### 2.2 Nutrition Module (Meals & Goals)

#### Backend API (факт)

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/v1/meals/` | GET | `?date=YYYY-MM-DD` | Daily stats with meals |
| `/api/v1/meals/` | POST | `{ meal_type, date }` | Created meal |
| `/api/v1/meals/<id>/` | GET | - | Meal with items |
| `/api/v1/meals/<id>/` | DELETE | - | 204 No Content |
| `/api/v1/meals/<id>/items/` | POST | `{ name, grams, calories, protein, fat, carbohydrates }` | Created food item |
| `/api/v1/meals/<id>/items/<id>/` | PATCH | `{ name?, grams? }` | Updated food item |
| `/api/v1/meals/<id>/items/<id>/` | DELETE | - | 204 No Content |
| `/api/v1/goals/` | GET | - | Active daily goal |
| `/api/v1/goals/` | PUT/PATCH | `{ calories, protein, fat, carbohydrates, source?, is_active? }` | Updated goal |
| `/api/v1/goals/calculate/` | POST | - | Calculated goals from profile |
| `/api/v1/goals/set-auto/` | POST | - | Created auto goal |

**Backend Meal Response:**
```json
{
  "id": 123,
  "meal_type": "BREAKFAST",
  "meal_type_display": "Завтрак",
  "date": "2024-12-07",
  "created_at": "2024-12-07T08:00:00Z",
  "items": [
    {
      "id": 456,
      "name": "Овсянка",
      "photo": "/media/food/photo.jpg",
      "grams": 250,
      "calories": 165.00,
      "protein": 5.50,
      "fat": 3.20,
      "carbohydrates": 28.00
    }
  ],
  "total": {
    "calories": 165.0,
    "protein": 5.5,
    "fat": 3.2,
    "carbohydrates": 28.0
  },
  "photo_url": "/media/meals/photo.jpg"
}
```

#### Frontend Expectations (факт)

**File: `src/services/api/types.ts`**

```typescript
interface FoodItem {
  id: number;
  name: string;
  photo?: string;
  grams: number;        // ✅ Matches backend
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
}

interface Meal {
  id: number;
  meal_type: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  meal_type_display?: string;
  date: string;
  items?: FoodItem[];
  total?: { calories, protein, fat, carbohydrates };
}
```

#### Сравнительная таблица: Nutrition

| Аспект | Backend (факт) | Frontend (ожидание) | Статус |
|--------|----------------|---------------------|--------|
| Meal fields | `id, meal_type, meal_type_display, date, items[], total, photo_url` | Идентично | ✅ OK |
| FoodItem.grams | `grams` (integer) | `grams` | ✅ OK |
| FoodItem PATCH | Accepts `{ name?, grams? }` | Sends `{ name?, grams? }` | ✅ OK |
| Goals GET 404 | Returns `{ "error": "Дневная цель не установлена" }` | Handles 404, returns null | ✅ OK |
| Goals PUT/PATCH | Creates if not exists (201) | Expects 200 or 201 | ✅ OK |
| Daily stats format | `{ date, daily_goal, total_consumed, progress, meals[] }` | Same structure | ✅ OK |

---

### 2.3 Billing Module

#### Backend API (факт)

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/v1/billing/plans/` | GET | `[{ code, display_name, price, duration_days, daily_photo_limit, ... }]` |
| `/api/v1/billing/me/` | GET | `{ plan_code, plan_name, expires_at, is_active, daily_photo_limit, used_today, remaining_today }` |
| `/api/v1/billing/subscription/` | GET | `{ plan, plan_display, expires_at, is_active, autorenew_*, payment_method }` |
| `/api/v1/billing/create-payment/` | POST | `{ payment_id, yookassa_payment_id, confirmation_url }` |
| `/api/v1/billing/subscription/autorenew/` | POST | Updated subscription details |
| `/api/v1/billing/payment-method/` | GET | `{ is_attached, card_mask, card_brand }` |
| `/api/v1/billing/payments/` | GET | `{ results: [{ id, amount, status, paid_at, description }] }` |
| `/api/v1/billing/bind-card/start/` | POST | `{ confirmation_url, payment_id }` |

**Backend /billing/me/ Response:**
```json
{
  "plan_code": "FREE",
  "plan_name": "Бесплатный",
  "expires_at": null,
  "is_active": true,
  "daily_photo_limit": 3,
  "used_today": 2,
  "remaining_today": 1,
  "test_live_payment_available": false
}
```

**Backend /billing/subscription/ Response:**
```json
{
  "plan": "pro",
  "plan_display": "PRO",
  "expires_at": "2025-01-07",
  "is_active": true,
  "autorenew_available": true,
  "autorenew_enabled": true,
  "card_bound": true,
  "payment_method": {
    "is_attached": true,
    "card_mask": "•••• 1234",
    "card_brand": "Visa"
  }
}
```

#### Frontend Expectations (факт)

**File: `src/types/billing.ts`**

```typescript
interface BillingMe {
  plan_code: BillingPlanCode;
  plan_name: string;
  expires_at: string | null;
  is_active: boolean;
  daily_photo_limit: number | null;
  used_today: number;
  remaining_today: number | null;
  test_live_payment_available?: boolean;
}

interface SubscriptionDetails {
  plan: 'free' | 'pro';
  plan_display: string;
  expires_at: string | null;
  is_active: boolean;
  autorenew_available: boolean;
  autorenew_enabled: boolean;
  card_bound: boolean;
  payment_method: PaymentMethod;
}
```

#### Сравнительная таблица: Billing

| Аспект | Backend (факт) | Frontend (ожидание) | Статус |
|--------|----------------|---------------------|--------|
| `/billing/me/` fields | All fields match | All fields expected | ✅ OK |
| `/billing/subscription/` fields | All fields match | All fields expected | ✅ OK |
| Plan codes | `FREE, PRO_MONTHLY, PRO_YEARLY` | Maps to `free, pro_monthly, pro_yearly` | ✅ OK |
| Payment creation | Returns `confirmation_url` | Expects `confirmation_url` | ✅ OK |
| Auto-renew toggle | `{ enabled: bool }` request | Sends `{ enabled: bool }` | ✅ OK |

---

### 2.4 Authentication Module

#### Backend API (факт)

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/api/v1/telegram/webapp/auth/` | POST | `X-Telegram-Init-Data` header | `{ user, profile, goals, is_admin }` |
| `/api/v1/telegram/auth/` | POST | `X-Telegram-Init-Data` header + body | `{ access, refresh, user, is_admin }` |

**Backend webapp/auth Response:**
```json
{
  "user": {
    "id": 123,
    "telegram_id": 456789,
    "username": "user",
    "first_name": "John",
    "last_name": "Doe"
  },
  "profile": {
    "full_name": "John Doe",
    "gender": "M",
    "height": 180,
    "weight": 75,
    ...
  },
  "goals": {
    "calories": 2000,
    "protein": 150,
    ...
  },
  "is_admin": false
}
```

#### Frontend Expectations (факт)

**File: `src/services/api/auth.ts`**

```typescript
interface AuthResponse {
  user: {
    id: number;
    username: string;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    completed_ai_test: boolean;
    is_client?: boolean;
  };
  is_admin?: boolean;
}
```

#### Сравнительная таблица: Auth

| Аспект | Backend (факт) | Frontend (ожидание) | Статус |
|--------|----------------|---------------------|--------|
| User fields | `id, telegram_id, username, first_name, last_name` | Same + `completed_ai_test, is_client` | ⚠️ MINOR - Extra fields expected but not critical |
| Profile in response | Full profile object | Profile expected | ✅ OK |
| Goals in response | Active goal or null | Goals expected | ✅ OK |
| is_admin | Boolean | Boolean | ✅ OK |

---

## 3. Идентифицированные проблемы

### 3.1 CRITICAL Issues

| # | Проблема | Модуль | Описание | Влияние |
|---|----------|--------|----------|---------|
| C-1 | **Empty recognized_items с meal_id** | AI | Backend иногда возвращает `recognized_items: []` при наличии `meal_id`. Frontend делает fallback через `getMealAnalysis()`. | UX: Задержка, дополнительные запросы. Workaround работает, но не элегантен. |
| C-2 | **Отсутствие нормализованного error response** | Все | Backend возвращает разные форматы ошибок: `{ error }`, `{ detail }`, `{ error: { code, message } }` | Frontend должен обрабатывать все варианты. Код усложнён. |

### 3.2 MAJOR Issues

| # | Проблема | Модуль | Описание | Влияние |
|---|----------|--------|----------|---------|
| M-1 | **Legacy billing endpoints** | Billing | Существуют дублирующие endpoints: `/billing/plan` vs `/billing/me/`, `/auto-renew/toggle` vs `/subscription/autorenew/` | Путаница, избыточный код |
| M-2 | **Inconsistent plan_code naming** | Billing | Backend: `FREE, PRO_MONTHLY, PRO_YEARLY, MONTHLY, YEARLY`. Frontend должен маппить. | Сложность в поддержке |
| M-3 | **Browser Debug Mode зависимость** | Auth | Frontend зависит от `X-Debug-Mode` для разработки, но это security risk в production | Потенциальная уязвимость |

### 3.3 MINOR Issues

| # | Проблема | Модуль | Описание | Влияние |
|---|----------|--------|----------|---------|
| m-1 | **AuthResponse expects completed_ai_test** | Auth | Frontend ожидает `user.completed_ai_test`, backend не возвращает | Может вызвать undefined |
| m-2 | **photo vs photo_url inconsistency** | Nutrition | FoodItem имеет `photo`, Meal имеет `photo_url` | Minor naming inconsistency |
| m-3 | **Decimal vs Float** | Nutrition | Backend возвращает Decimal, frontend ожидает number | Автоматическая конверсия, но может быть precision loss |

---

## 4. Детальный анализ потоков данных

### 4.1 AI Recognition Flow (Async Mode)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI RECOGNITION FLOW (ASYNC)                          │
└─────────────────────────────────────────────────────────────────────────────┘

     FRONTEND                           BACKEND                    CELERY
        │                                  │                          │
        │  POST /ai/recognize/             │                          │
        │  (image, meal_type, date)        │                          │
        │─────────────────────────────────>│                          │
        │                                  │                          │
        │                                  │  Create Meal (photo)     │
        │                                  │─────────────────────────>│
        │                                  │                          │
        │                                  │  Dispatch Celery Task    │
        │                                  │─────────────────────────>│
        │                                  │                          │
        │  HTTP 202 Accepted               │                          │
        │  { task_id, meal_id, status }    │                          │
        │<─────────────────────────────────│                          │
        │                                  │                          │
        │                                  │          AI Proxy Call   │
        │                                  │          ─────────────>  │
        │                                  │          <─────────────  │
        │                                  │                          │
        │                                  │  Save FoodItems to Meal  │
        │                                  │<─────────────────────────│
        │                                  │                          │
   ┌────┴────┐                             │                          │
   │ POLLING │                             │                          │
   └────┬────┘                             │                          │
        │  GET /ai/task/{task_id}/         │                          │
        │─────────────────────────────────>│                          │
        │                                  │                          │
        │  { state: "PENDING" }            │                          │
        │<─────────────────────────────────│                          │
        │                                  │                          │
        │  ... wait 2s (exponential) ...   │                          │
        │                                  │                          │
        │  GET /ai/task/{task_id}/         │                          │
        │─────────────────────────────────>│                          │
        │                                  │                          │
        │  { state: "SUCCESS",             │                          │
        │    result: {                     │                          │
        │      meal_id,                    │                          │
        │      recognized_items[],         │                          │
        │      totals: {...}               │                          │
        │    }                             │                          │
        │  }                               │                          │
        │<─────────────────────────────────│                          │
        │                                  │                          │
   ┌────┴────┐                             │                          │
   │FALLBACK │  (if items empty)           │                          │
   └────┬────┘                             │                          │
        │  GET /meals/{meal_id}/           │                          │
        │─────────────────────────────────>│                          │
        │                                  │                          │
        │  { items: [...] }                │                          │
        │<─────────────────────────────────│                          │
        │                                  │                          │
        ▼                                  │                          │
   [Show Results]                          │                          │
```

**Проблемные точки:**
1. **Point A**: Task может вернуть SUCCESS с пустыми items (race condition с DB)
2. **Point B**: Fallback к getMealAnalysis добавляет latency
3. **Point C**: Polling использует exponential backoff, но начальный delay (2s) может быть слишком большим

### 4.2 Billing/Subscription Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUBSCRIPTION PURCHASE FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

     FRONTEND                           BACKEND                   YOOKASSA
        │                                  │                          │
        │  GET /billing/plans/             │                          │
        │─────────────────────────────────>│                          │
        │  [{ code, price, ... }]          │                          │
        │<─────────────────────────────────│                          │
        │                                  │                          │
        │  POST /billing/create-payment/   │                          │
        │  { plan_code: "PRO_MONTHLY" }    │                          │
        │─────────────────────────────────>│                          │
        │                                  │                          │
        │                                  │  Create Payment          │
        │                                  │─────────────────────────>│
        │                                  │  { confirmation_url }    │
        │                                  │<─────────────────────────│
        │                                  │                          │
        │  { confirmation_url }            │                          │
        │<─────────────────────────────────│                          │
        │                                  │                          │
        │  ┌─────────────────────┐         │                          │
        │  │ Telegram.openLink() │         │                          │
        │  │ or window.location  │         │                          │
        │  └─────────────────────┘         │                          │
        │                                  │                          │
        │         ... User pays ...        │                          │
        │                                  │                          │
        │                                  │  Webhook: payment.success │
        │                                  │<─────────────────────────│
        │                                  │                          │
        │                                  │  Activate Subscription   │
        │                                  │  Save payment_method_id  │
        │                                  │                          │
        │  User returns to app             │                          │
        │                                  │                          │
        │  GET /billing/me/                │                          │
        │─────────────────────────────────>│                          │
        │  { plan_code: "PRO_MONTHLY" }    │                          │
        │<─────────────────────────────────│                          │
```

---

## 5. Целевая модель интеграции

### 5.1 Унифицированный Error Response

**Текущее состояние (разные форматы):**
```json
// Вариант 1
{ "error": "DAILY_LIMIT_REACHED" }

// Вариант 2
{ "detail": "Дневной лимит исчерпан" }

// Вариант 3
{ "error": { "code": "DAILY_LIMIT_REACHED", "message": "..." } }
```

**Целевой формат:**
```json
{
  "error": {
    "code": "DAILY_LIMIT_REACHED",
    "message": "Дневной лимит исчерпан",
    "details": {
      "limit": 3,
      "used": 3
    }
  }
}
```

### 5.2 AI Recognition - Устранение Fallback

**Проблема:** Frontend вынужден делать дополнительный запрос к `/meals/{id}/` когда task возвращает пустые items.

**Решение (Backend):**
```python
# apps/ai/tasks.py
@celery_app.task
def recognize_food_async(meal_id, image_data_url, ...):
    # ... AI recognition ...
    
    # Wait for FoodItems to be saved to DB
    meal.refresh_from_db()
    
    # Return full data in task result
    return {
        'success': True,
        'meal_id': str(meal.id),
        'recognized_items': [
            {
                'id': str(item.id),
                'name': item.name,
                'grams': item.grams,
                'calories': float(item.calories),
                'protein': float(item.protein),
                'fat': float(item.fat),
                'carbohydrates': float(item.carbohydrates)
            }
            for item in meal.items.all()  # <-- Refresh from DB
        ],
        'totals': {...}
    }
```

### 5.3 Billing Endpoints Consolidation

**Текущее (legacy + new):**
```
/billing/plan              <- Legacy
/billing/me/               <- New (primary)
/billing/subscription/     <- New (details)
/auto-renew/toggle         <- Legacy
/subscription/autorenew/   <- New
```

**Целевое:**
```
/billing/status/           <- Unified status (replaces /me/ and /plan)
/billing/subscription/     <- Detailed subscription info
/billing/subscription/autorenew/  <- Toggle auto-renew
/billing/payments/         <- Payment history
/billing/plans/            <- Available plans
```

---

## 6. План миграции

### Phase 1: Error Handling Standardization (1-2 дня)

**Backend:**
1. Создать `core/exception_handler.py` с unified error format
2. Обновить DRF settings: `"EXCEPTION_HANDLER": "apps.core.exception_handler.custom_exception_handler"`
3. Мигрировать все views на использование `raise FoodMindException()`

**Frontend:**
1. Создать `parseApiError()` utility в `client.ts`
2. Обновить все API modules для использования unified error parsing

### Phase 2: AI Recognition Improvements (2-3 дня)

**Backend:**
1. Fix race condition в `recognize_food_async` task
2. Гарантировать что task result содержит актуальные items из DB
3. Добавить retry logic при пустых items

**Frontend:**
1. Упростить `pollTaskStatus` - убрать fallback к getMealAnalysis
2. Уменьшить initial polling delay с 2s до 1s
3. Добавить better error messages

### Phase 3: Billing Consolidation (2 дня)

**Backend:**
1. Deprecate `/billing/plan` в пользу `/billing/me/`
2. Deprecate `/auto-renew/toggle` в пользу `/subscription/autorenew/`
3. Унифицировать plan_code naming: только `FREE`, `PRO_MONTHLY`, `PRO_YEARLY`

**Frontend:**
1. Обновить `billing.ts` для использования только новых endpoints
2. Удалить маппинг legacy plan codes

### Phase 4: Security Hardening (1 день)

**Backend:**
1. Добавить rate limiting на Debug Mode authentication
2. Логировать все Debug Mode requests
3. Опционально: отключать Debug Mode в production через feature flag

**Frontend:**
1. Показывать warning banner при использовании Debug Mode
2. Блокировать критические операции (payments) в Debug Mode

---

## 7. Что НЕ менять (Keep as is)

| Компонент | Причина |
|-----------|---------|
| **X-Telegram-Init-Data auth** | Работает корректно, соответствует Telegram docs |
| **Meal/FoodItem field names** | `grams`, `calories`, etc. - консистентны между BE и FE |
| **Polling mechanism** | Exponential backoff работает, только tune параметры |
| **photo_url resolution** | `resolveImageUrl()` корректно обрабатывает все случаи |

---

## 8. Метрики успеха

- [ ] Единый формат ошибок во всех API responses
- [ ] AI recognition без fallback requests в 99% случаев
- [ ] Только "new" billing endpoints используются frontend
- [ ] Debug Mode недоступен в production без explicit flag
- [ ] API response time < 200ms (исключая AI recognition)
- [ ] Frontend error handling покрывает все API error codes

---

## 9. Приложения

### 9.1 Frontend URL Mapping

```typescript
// src/services/api/urls.ts
export const URLS = {
  // Telegram
  auth: `${API_BASE}/telegram/auth/`,
  
  // Nutrition
  meals: `${API_BASE}/meals/`,
  goals: `${API_BASE}/goals/`,
  calculateGoals: `${API_BASE}/goals/calculate/`,
  setAutoGoals: `${API_BASE}/goals/set-auto/`,
  weeklyStats: `${API_BASE}/stats/weekly/`,
  
  // User
  profile: `${API_BASE}/users/profile/`,
  uploadAvatar: `${API_BASE}/users/profile/avatar/`,
  
  // Billing
  billingMe: `${API_BASE}/billing/me/`,
  createPayment: `${API_BASE}/billing/create-payment/`,
  subscriptionDetails: `${API_BASE}/billing/subscription/`,
  subscriptionAutoRenew: `${API_BASE}/billing/subscription/autorenew/`,
  paymentMethodDetails: `${API_BASE}/billing/payment-method/`,
  paymentsHistory: `${API_BASE}/billing/payments/`,
  bindCardStart: `${API_BASE}/billing/bind-card/start/`,
  plans: `${API_BASE}/billing/plans/`,
  
  // AI
  recognize: `${API_BASE}/ai/recognize/`,
  taskStatus: (taskId: string) => `${API_BASE}/ai/task/${taskId}/`,
};
```

### 9.2 Backend URL Patterns

```python
# Consolidated from all urls.py files

# AI
/api/v1/ai/recognize/
/api/v1/ai/task/<task_id>/

# Nutrition
/api/v1/meals/
/api/v1/meals/<id>/
/api/v1/meals/<meal_id>/items/
/api/v1/meals/<meal_id>/items/<id>/
/api/v1/goals/
/api/v1/goals/calculate/
/api/v1/goals/set-auto/
/api/v1/stats/weekly/

# Billing
/api/v1/billing/plans/
/api/v1/billing/plan              # Legacy
/api/v1/billing/me/
/api/v1/billing/subscription/
/api/v1/billing/subscription/autorenew/
/api/v1/billing/create-payment/
/api/v1/billing/bind-card/start/
/api/v1/billing/payment-method/
/api/v1/billing/payments/
/api/v1/billing/auto-renew/toggle  # Legacy
/api/v1/billing/webhooks/yookassa

# Telegram
/api/v1/telegram/auth/
/api/v1/telegram/webapp/auth/
/api/v1/telegram/profile/

# Users
/api/v1/users/profile/
/api/v1/users/profile/avatar/
/api/v1/users/auth/register/
/api/v1/users/auth/login/
/api/v1/users/auth/refresh/
```

### 9.3 Error Codes Reference

| Code | HTTP Status | Module | Description |
|------|-------------|--------|-------------|
| `DAILY_LIMIT_REACHED` | 429 | AI | Превышен дневной лимит распознавания |
| `AI_SERVICE_TIMEOUT` | 503 | AI | Таймаут AI сервиса |
| `AI_SERVICE_ERROR` | 500 | AI | Ошибка AI сервиса |
| `INVALID_IMAGE` | 400 | AI | Некорректный формат изображения |
| `NO_SUBSCRIPTION` | 404 | Billing | Подписка не найдена |
| `INVALID_PLAN` | 400 | Billing | Неверный тарифный план |
| `PAYMENT_ERROR` | 500 | Billing | Ошибка создания платежа |
| `NOT_AVAILABLE_FOR_FREE` | 400 | Billing | Функция недоступна для FREE плана |
| `NO_PAYMENT_METHOD` | 400 | Billing | Нет привязанной карты |
| `unauthenticated_webapp_user` | 401 | Auth | Не авторизован через Telegram |

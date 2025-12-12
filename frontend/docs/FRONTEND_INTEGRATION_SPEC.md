# ТЗ: Frontend Integration Refactoring

> **Основа:** AUDIT_INTEGRATION.md  
> **Цель:** Привести frontend в соответствие с backend API, убрать костыли, унифицировать error handling

---

## 1. Унифицированная обработка ошибок

### 1.1 Где смотреть

| Файл | Назначение |
|------|------------|
| `src/services/api/client.ts` | Базовый HTTP-клиент |
| `src/services/api/ai.ts` | AI Recognition API |
| `src/services/api/nutrition.ts` | Meals, Goals API |
| `src/services/api/billing.ts` | Subscriptions, Payments API |
| `src/services/api/auth.ts` | Telegram Auth API |
| `src/services/api/profile.ts` | User Profile API |

### 1.2 Задачи

#### 1.2.1 Создать `parseApiError()` в `client.ts`

```typescript
// src/services/api/client.ts

export interface ParsedApiError {
    code: string;
    message: string;
    details: Record<string, unknown>;
    status: number;
}

/**
 * Парсит ответ API в унифицированный формат ошибки.
 * Толерантен к разным форматам от backend:
 * - Новый: { error: { code, message, details } }
 * - Legacy 1: { error: "string" }
 * - Legacy 2: { detail: "string" }
 * - Legacy 3: { error: { code, message } } без details
 */
export function parseApiError(
    responseData: unknown,
    status: number,
    fallbackMessage = 'Произошла ошибка'
): ParsedApiError {
    // Новый формат: { error: { code, message, details } }
    if (
        typeof responseData === 'object' &&
        responseData !== null &&
        'error' in responseData
    ) {
        const errorField = (responseData as Record<string, unknown>).error;

        // Вложенный объект { code, message, details }
        if (typeof errorField === 'object' && errorField !== null) {
            const errObj = errorField as Record<string, unknown>;
            return {
                code: String(errObj.code || 'UNKNOWN_ERROR'),
                message: String(errObj.message || fallbackMessage),
                details: (errObj.details as Record<string, unknown>) || {},
                status,
            };
        }

        // Legacy: { error: "string" }
        if (typeof errorField === 'string') {
            return {
                code: errorField,
                message: errorField,
                details: {},
                status,
            };
        }
    }

    // Legacy DRF: { detail: "string" }
    if (
        typeof responseData === 'object' &&
        responseData !== null &&
        'detail' in responseData
    ) {
        const detail = (responseData as Record<string, unknown>).detail;
        return {
            code: 'API_ERROR',
            message: String(detail),
            details: {},
            status,
        };
    }

    // Fallback
    return {
        code: 'UNKNOWN_ERROR',
        message: fallbackMessage,
        details: {},
        status,
    };
}
```

#### 1.2.2 Обновить класс `ApiError`

```typescript
// src/services/api/client.ts

export class ApiError extends Error {
    status: number;
    code: string;
    details: Record<string, unknown>;

    constructor(parsed: ParsedApiError) {
        super(parsed.message);
        this.name = 'ApiError';
        this.status = parsed.status;
        this.code = parsed.code;
        this.details = parsed.details;
    }

    /**
     * Проверяет, является ли ошибка определённым кодом
     */
    is(code: string): boolean {
        return this.code === code;
    }
}
```

#### 1.2.3 Обновить `fetchWithTimeout` для использования `parseApiError`

```typescript
// src/services/api/client.ts

export const fetchWithTimeout = async (
    url: string,
    options: RequestInit = {},
    timeout = API_TIMEOUT,
    skipAuthCheck = false
): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!skipAuthCheck) {
            handleAuthErrors(response);
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiError({
                code: 'TIMEOUT',
                message: `Превышено время ожидания (${timeout / 1000}с)`,
                details: { timeout },
                status: 0,
            });
        }
        throw error;
    }
};
```

#### 1.2.4 Хелпер для выброса API ошибки

```typescript
// src/services/api/client.ts

/**
 * Обрабатывает не-OK ответ и выбрасывает ApiError
 */
export async function throwApiError(
    response: Response,
    fallbackMessage?: string
): Promise<never> {
    const data = await response.json().catch(() => ({}));
    const parsed = parseApiError(data, response.status, fallbackMessage);
    throw new ApiError(parsed);
}
```

#### 1.2.5 Пример использования в API модулях

```typescript
// src/services/api/ai.ts

export const recognizeFood = async (...): Promise<RecognizeFoodResult> => {
    // ...
    const response = await fetchWithTimeout(URLS.recognize, { ... });

    if (!response.ok) {
        await throwApiError(response, 'Ошибка распознавания');
    }

    // ...
};
```

### 1.3 Интеграция с UI

#### 1.3.1 Создать хук `useApiError`

```typescript
// src/hooks/useApiError.ts

import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../services/api/client';
import { API_ERROR_MESSAGES } from '../constants';

export function useApiError() {
    const toast = useToast();
    const navigate = useNavigate();

    const handleError = useCallback((error: unknown) => {
        if (!(error instanceof ApiError)) {
            toast.error('Произошла неизвестная ошибка');
            return;
        }

        // Специальная обработка по кодам
        switch (error.code) {
            case 'DAILY_LIMIT_REACHED':
                toast.error('Дневной лимит фото исчерпан');
                // Опционально: показать модалку подписки
                break;

            case 'NOT_AVAILABLE_FOR_FREE':
                toast.error('Эта функция доступна только в PRO');
                navigate('/subscription');
                break;

            case 'INVALID_IMAGE':
                toast.error('Неверный формат изображения');
                break;

            case 'AI_SERVICE_TIMEOUT':
                toast.error('Сервис распознавания не отвечает. Попробуйте позже.');
                break;

            case 'NO_PAYMENT_METHOD':
                toast.error('Привяжите карту для автопродления');
                break;

            default:
                toast.error(error.message || API_ERROR_MESSAGES[error.code] || 'Ошибка');
        }
    }, [toast, navigate]);

    return { handleError };
}
```

#### 1.3.2 Обновить `constants.ts`

```typescript
// src/constants.ts

export const API_ERROR_CODES = {
    DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
    NOT_AVAILABLE_FOR_FREE: 'NOT_AVAILABLE_FOR_FREE',
    INVALID_IMAGE: 'INVALID_IMAGE',
    AI_SERVICE_TIMEOUT: 'AI_SERVICE_TIMEOUT',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    NO_SUBSCRIPTION: 'NO_SUBSCRIPTION',
    INVALID_PLAN: 'INVALID_PLAN',
    PAYMENT_ERROR: 'PAYMENT_ERROR',
    NO_PAYMENT_METHOD: 'NO_PAYMENT_METHOD',
    TIMEOUT: 'TIMEOUT',
    NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export const API_ERROR_MESSAGES: Record<string, string> = {
    [API_ERROR_CODES.DAILY_LIMIT_REACHED]: 'Дневной лимит фото исчерпан. Оформите PRO для безлимита.',
    [API_ERROR_CODES.NOT_AVAILABLE_FOR_FREE]: 'Эта функция доступна только в PRO подписке.',
    [API_ERROR_CODES.INVALID_IMAGE]: 'Неверный формат изображения. Используйте JPEG или PNG.',
    [API_ERROR_CODES.AI_SERVICE_TIMEOUT]: 'Сервис распознавания не отвечает. Попробуйте позже.',
    [API_ERROR_CODES.AI_SERVICE_ERROR]: 'Ошибка сервиса распознавания. Попробуйте позже.',
    [API_ERROR_CODES.NO_SUBSCRIPTION]: 'Подписка не найдена.',
    [API_ERROR_CODES.INVALID_PLAN]: 'Выбранный тариф недоступен.',
    [API_ERROR_CODES.PAYMENT_ERROR]: 'Ошибка при создании платежа. Попробуйте позже.',
    [API_ERROR_CODES.NO_PAYMENT_METHOD]: 'Привяжите карту для включения автопродления.',
    [API_ERROR_CODES.TIMEOUT]: 'Превышено время ожидания. Проверьте интернет-соединение.',
    [API_ERROR_CODES.NETWORK_ERROR]: 'Ошибка сети. Проверьте интернет-соединение.',
};
```

---

## 2. AI Recognition: убрать костыли

### 2.1 Где смотреть

| Файл | Назначение |
|------|------------|
| `src/services/api/ai.ts` | API функции recognizeFood, getTaskStatus |
| `src/hooks/useTaskPolling.ts` | Polling hook для async режима |
| `src/pages/FoodLogPage.tsx` | Основной флоу загрузки фото |
| `src/components/BatchResultsModal.tsx` | Показ результатов batch-распознавания |

### 2.2 Задачи

#### 2.2.1 Чёткие типы в `ai.ts`

```typescript
// src/services/api/ai.ts

// ============================================================
// Types
// ============================================================

/** Распознанный продукт */
export interface RecognizedItem {
    id?: string | number;
    name: string;
    grams: number;
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    confidence?: number;
}

/** Sync response (HTTP 200) */
export interface RecognizeSyncResult {
    recognized_items: RecognizedItem[];
    total_calories: number;
    total_protein: number;
    total_fat: number;
    total_carbohydrates: number;
    meal_id: number | string;
    photo_url?: string;
    isAsync: false;
}

/** Async response (HTTP 202) */
export interface RecognizeAsyncResult {
    task_id: string;
    meal_id: string;
    status: 'processing';
    message?: string;
    isAsync: true;
}

export type RecognizeFoodResult = RecognizeSyncResult | RecognizeAsyncResult;

/** Task status states */
export type TaskState = 'PENDING' | 'STARTED' | 'RETRY' | 'SUCCESS' | 'FAILURE';

/** Task result (when SUCCESS) */
export interface TaskSuccessResult {
    success: true;
    meal_id: string | number;
    recognized_items: RecognizedItem[];
    totals: {
        calories: number;
        protein: number;
        fat: number;
        carbohydrates: number;
    };
    recognition_time?: number;
    photo_url?: string;
}

/** Task result (when success=false) */
export interface TaskFailureResult {
    success: false;
    meal_id?: string | number;
    error: string;
}

export type TaskResult = TaskSuccessResult | TaskFailureResult;

/** Task status response */
export interface TaskStatusResponse {
    task_id: string;
    state: TaskState;
    result?: TaskResult;
    error?: string;
    message?: string;
}
```

#### 2.2.2 Обновить `recognizeFood`

```typescript
// src/services/api/ai.ts

export const recognizeFood = async (
    imageFile: File,
    description?: string,
    mealType?: string,
    date?: string
): Promise<RecognizeFoodResult> => {
    log(`Calling AI recognize: ${imageFile.name}`);

    const formData = new FormData();
    formData.append('image', imageFile);
    if (description) formData.append('description', description);
    if (mealType) formData.append('meal_type', mealType);
    if (date) formData.append('date', date);

    const response = await fetchWithTimeout(URLS.recognize, {
        method: 'POST',
        headers: getHeadersWithoutContentType(),
        body: formData,
    });

    // Async mode (HTTP 202)
    if (response.status === 202) {
        const data = await response.json();
        log(`Async mode: task_id=${data.task_id}, meal_id=${data.meal_id}`);
        return {
            task_id: data.task_id,
            meal_id: data.meal_id,
            status: 'processing',
            message: data.message,
            isAsync: true,
        };
    }

    // Error
    if (!response.ok) {
        await throwApiError(response, 'Ошибка распознавания');
    }

    // Sync mode (HTTP 200)
    const data = await response.json();
    log(`Sync mode: ${data.recognized_items?.length || 0} items`);

    return {
        recognized_items: data.recognized_items || [],
        total_calories: data.total_calories || 0,
        total_protein: data.total_protein || 0,
        total_fat: data.total_fat || 0,
        total_carbohydrates: data.total_carbohydrates || 0,
        meal_id: data.meal_id,
        photo_url: data.photo_url,
        isAsync: false,
    };
};
```

#### 2.2.3 Обновить `getTaskStatus`

```typescript
// src/services/api/ai.ts

export const getTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
    log(`Getting task status: ${taskId}`);

    const response = await fetchWithTimeout(URLS.taskStatus(taskId), {
        method: 'GET',
        headers: getHeaders(),
    });

    if (!response.ok) {
        await throwApiError(response, 'Ошибка получения статуса задачи');
    }

    const data = await response.json();
    log(`Task ${taskId}: state=${data.state}`);

    return {
        task_id: data.task_id,
        state: data.state,
        result: data.result,
        error: data.error,
        message: data.message,
    };
};
```

### 2.3 Обновить polling в `FoodLogPage.tsx`

#### 2.3.1 Состояния UI

```typescript
// src/pages/FoodLogPage.tsx

type RecognitionState =
    | 'idle'           // Начальное состояние
    | 'uploading'      // Отправка на сервер
    | 'processing'     // Celery обрабатывает (async)
    | 'success'        // Успешно распознано
    | 'soft-fail'      // Ничего не найдено, но без ошибки
    | 'error';         // Системная ошибка

interface RecognitionStatus {
    state: RecognitionState;
    message?: string;
    errorCode?: string;
}
```

#### 2.3.2 Новые polling параметры

```typescript
// src/constants.ts или src/pages/FoodLogPage.tsx

export const POLLING = {
    INITIAL_DELAY_MS: 1000,      // Было 2000, теперь 1000
    MAX_DELAY_MS: 10000,         // Было 5000, теперь 10000
    BACKOFF_MULTIPLIER: 2,       // Было 1.5, теперь 2 (быстрее растёт)
    MAX_DURATION_MS: 60000,      // 60 секунд максимум
};
```

#### 2.3.3 Обновлённый `pollTaskStatus`

```typescript
// src/pages/FoodLogPage.tsx

const pollTaskStatus = async (
    taskId: string,
    abortController: AbortController
): Promise<AnalysisResult | null> => {
    const startTime = Date.now();
    let attempt = 0;

    while (!abortController.signal.aborted) {
        const elapsed = Date.now() - startTime;

        // Timeout check
        if (elapsed >= POLLING.MAX_DURATION_MS) {
            throw new ApiError({
                code: 'TIMEOUT',
                message: 'Превышено время ожидания распознавания',
                details: { elapsed },
                status: 0,
            });
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
            POLLING.INITIAL_DELAY_MS * Math.pow(POLLING.BACKOFF_MULTIPLIER, attempt),
            POLLING.MAX_DELAY_MS
        );

        try {
            const taskStatus = await api.getTaskStatus(taskId);
            console.log(`[Polling] Task ${taskId}: ${taskStatus.state}`, taskStatus);

            switch (taskStatus.state) {
                case 'SUCCESS': {
                    const result = taskStatus.result;

                    // Backend вернул success: false
                    if (result && 'success' in result && result.success === false) {
                        throw new ApiError({
                            code: 'AI_RECOGNITION_FAILED',
                            message: result.error || 'Не удалось распознать еду',
                            details: {},
                            status: 0,
                        });
                    }

                    // Success path
                    if (result && 'recognized_items' in result) {
                        const items = result.recognized_items || [];
                        const totals = result.totals || {
                            calories: 0, protein: 0, fat: 0, carbohydrates: 0
                        };

                        // Если items пустые, но есть meal_id — делаем fallback
                        if (items.length === 0 && result.meal_id) {
                            const fallbackItems = await ensureMealItems(result.meal_id);
                            if (fallbackItems) {
                                return {
                                    recognized_items: fallbackItems,
                                    total_calories: fallbackItems.reduce((s, i) => s + i.calories, 0),
                                    total_protein: fallbackItems.reduce((s, i) => s + i.protein, 0),
                                    total_fat: fallbackItems.reduce((s, i) => s + i.fat, 0),
                                    total_carbohydrates: fallbackItems.reduce((s, i) => s + i.carbohydrates, 0),
                                    meal_id: result.meal_id,
                                    photo_url: result.photo_url,
                                };
                            }
                        }

                        return {
                            recognized_items: items,
                            total_calories: totals.calories,
                            total_protein: totals.protein,
                            total_fat: totals.fat,
                            total_carbohydrates: totals.carbohydrates,
                            meal_id: result.meal_id,
                            photo_url: result.photo_url,
                        };
                    }

                    // Неожиданный формат result
                    throw new ApiError({
                        code: 'INVALID_RESPONSE',
                        message: 'Неверный формат ответа от сервера',
                        details: { result },
                        status: 0,
                    });
                }

                case 'FAILURE':
                    throw new ApiError({
                        code: 'AI_SERVICE_ERROR',
                        message: taskStatus.error || 'Ошибка обработки фото',
                        details: {},
                        status: 0,
                    });

                case 'PENDING':
                case 'STARTED':
                case 'RETRY':
                    // Продолжаем polling
                    await sleep(delay);
                    attempt++;
                    continue;

                default:
                    // Неизвестное состояние — продолжаем polling
                    await sleep(delay);
                    attempt++;
                    continue;
            }
        } catch (err) {
            if (abortController.signal.aborted) return null;

            // Если это наша ApiError — пробрасываем
            if (err instanceof ApiError) throw err;

            // Network error — retry несколько раз
            if (attempt < 3) {
                await sleep(delay);
                attempt++;
                continue;
            }

            throw new ApiError({
                code: 'NETWORK_ERROR',
                message: 'Ошибка сети при получении результата',
                details: {},
                status: 0,
            });
        }
    }

    return null; // Aborted
};

// Helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

#### 2.3.4 Fallback функция (временная, пока бэк не починит)

```typescript
// src/pages/FoodLogPage.tsx

/**
 * Fallback: получить items из /meals/{id}/ если task вернул пустые items.
 * TODO: Убрать после фикса на бэкенде (Celery должен возвращать items в result)
 */
const ensureMealItems = async (
    mealId: string | number,
    maxAttempts = 2
): Promise<RecognizedItem[] | null> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Ждём перед запросом (DB propagation)
        await sleep(attempt * 1000);

        try {
            const mealData = await api.getMealAnalysis(mealId);
            if (mealData.recognized_items && mealData.recognized_items.length > 0) {
                console.log(`[Fallback] Attempt ${attempt}: found ${mealData.recognized_items.length} items`);
                return mealData.recognized_items.map(item => ({
                    id: String(item.id),
                    name: item.name,
                    grams: item.grams,
                    calories: item.calories,
                    protein: item.protein,
                    fat: item.fat,
                    carbohydrates: item.carbohydrates,
                }));
            }
            console.log(`[Fallback] Attempt ${attempt}: meal exists but 0 items`);
        } catch (err) {
            console.warn(`[Fallback] Attempt ${attempt} failed:`, err);
            // Если 404 — meal удалён, прекращаем
            if (err instanceof ApiError && err.status === 404) break;
        }
    }

    return null;
};
```

### 2.4 UI: правильные сообщения

#### 2.4.1 Soft-fail vs Error

```typescript
// src/pages/FoodLogPage.tsx

// В processBatch, после получения result:

if (result.recognized_items.length === 0) {
    // Soft-fail: ничего не найдено, но это не системная ошибка
    results.push({
        file,
        status: 'soft-fail', // Новый статус!
        message: 'Мы не смогли распознать блюдо. Попробуйте сделать фото крупнее.',
    });
} else {
    results.push({
        file,
        status: 'success',
        data: result,
    });
}
```

#### 2.4.2 В `BatchResultsModal.tsx`

```tsx
// src/components/BatchResultsModal.tsx

// Добавить обработку soft-fail
{result.status === 'soft-fail' && (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-yellow-700">
            <AlertCircle size={20} />
            <span className="font-medium">{result.message}</span>
        </div>
        <p className="text-yellow-600 text-sm mt-2">
            Советы: используйте хорошее освещение, сфотографируйте еду сверху
        </p>
    </div>
)}
```

---

## 3. Billing: только новые endpoints

### 3.1 Где смотреть

| Файл | Назначение |
|------|------------|
| `src/services/api/billing.ts` | Billing API |
| `src/services/api/urls.ts` | URL маппинг |
| `src/types/billing.ts` | TypeScript типы |
| `src/pages/SubscriptionPage.tsx` | Страница подписки |
| `src/contexts/BillingContext.tsx` | Billing state |

### 3.2 Задачи

#### 3.2.1 Обновить `urls.ts` — убрать legacy

```typescript
// src/services/api/urls.ts

export const URLS = {
    // ... other URLs ...

    // Billing endpoints (ONLY NEW)
    billingMe: `${API_BASE}/billing/me/`,
    subscriptionDetails: `${API_BASE}/billing/subscription/`,
    subscriptionAutoRenew: `${API_BASE}/billing/subscription/autorenew/`,
    createPayment: `${API_BASE}/billing/create-payment/`,
    paymentMethodDetails: `${API_BASE}/billing/payment-method/`,
    paymentsHistory: `${API_BASE}/billing/payments/`,
    bindCardStart: `${API_BASE}/billing/bind-card/start/`,
    plans: `${API_BASE}/billing/plans/`,

    // REMOVED (legacy):
    // plan: `${API_BASE}/billing/plan`,           // Use billingMe instead
    // cancelSubscription: `${API_BASE}/billing/cancel/`,  // Not used
    // resumeSubscription: `${API_BASE}/billing/resume/`,  // Not used
    // paymentMethods: `${API_BASE}/billing/payment-methods/`,  // Use paymentMethodDetails
};
```

#### 3.2.2 Удалить legacy функции из `billing.ts`

```typescript
// src/services/api/billing.ts

// УДАЛИТЬ эти функции:
// - getSubscriptionPlan() — использовать getBillingMe()
// - cancelSubscription() — не используется
// - resumeSubscription() — не используется

// ОСТАВИТЬ:
export const getBillingMe = async (): Promise<BillingMe> => { ... };
export const getSubscriptionDetails = async (): Promise<SubscriptionDetails> => { ... };
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => { ... };
export const createPayment = async (request: CreatePaymentRequest): Promise<CreatePaymentResponse> => { ... };
export const setAutoRenew = async (enabled: boolean): Promise<SubscriptionDetails> => { ... };
export const getPaymentMethod = async (): Promise<PaymentMethod> => { ... };
export const getPaymentsHistory = async (limit?: number): Promise<PaymentHistory> => { ... };
export const bindCard = async (): Promise<{ confirmation_url: string; payment_id: string }> => { ... };
```

#### 3.2.3 Нормализовать plan_code

```typescript
// src/types/billing.ts

// Строго только эти коды
export type BillingPlanCode = 'FREE' | 'PRO_MONTHLY' | 'PRO_YEARLY';

// Helper для нормализации (на случай legacy)
export function normalizePlanCode(code: string): BillingPlanCode {
    const normalized = code.toUpperCase();

    // Legacy mapping
    if (normalized === 'MONTHLY') return 'PRO_MONTHLY';
    if (normalized === 'YEARLY') return 'PRO_YEARLY';

    // Valid codes
    if (['FREE', 'PRO_MONTHLY', 'PRO_YEARLY'].includes(normalized)) {
        return normalized as BillingPlanCode;
    }

    // Default
    return 'FREE';
}
```

#### 3.2.4 Обновить `BillingContext.tsx`

```typescript
// src/contexts/BillingContext.tsx

// Использовать только getBillingMe и getSubscriptionDetails
const refresh = useCallback(async () => {
    try {
        setLoading(true);
        const [billingMe, subscription] = await Promise.all([
            api.getBillingMe(),
            api.getSubscriptionDetails(),
        ]);
        setBillingMe(billingMe);
        setSubscription(subscription);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
        setLoading(false);
    }
}, []);
```

---

## 4. Auth: безопасный Debug Mode

### 4.1 Где смотреть

| Файл | Назначение |
|------|------------|
| `src/services/api/auth.ts` | Auth API |
| `src/services/api/client.ts` | Headers, debug mode |
| `src/contexts/AuthContext.tsx` | Auth state |
| `src/components/BrowserDebugBanner.tsx` | Debug banner |
| `src/lib/telegram.ts` | Telegram helpers |

### 4.2 Задачи

#### 4.2.1 Опциональные поля в AuthResponse

```typescript
// src/services/api/types.ts

export interface AuthResponse {
    user: {
        id: number;
        username: string;
        telegram_id: number;
        first_name: string;
        last_name?: string;
        // Опциональные — не ломаем если бэк не прислал
        completed_ai_test?: boolean;
        is_client?: boolean;
    };
    is_admin?: boolean;
    profile?: Profile;
    goals?: DailyGoal;
}
```

#### 4.2.2 Проверка Debug Mode через env

```typescript
// src/lib/telegram.ts

/**
 * Проверяет, включён ли Browser Debug Mode
 */
export function isDebugModeEnabled(): boolean {
    // Только если явно включено в env
    return import.meta.env.VITE_DEBUG_MODE === 'true';
}

/**
 * Проверяет, нужно ли использовать Debug Mode
 * (включён в env И нет реального Telegram WebApp)
 */
export function shouldUseDebugMode(): boolean {
    const debugEnabled = isDebugModeEnabled();
    const hasTelegram = typeof window !== 'undefined' &&
        window.Telegram?.WebApp?.initData;

    return debugEnabled && !hasTelegram;
}
```

#### 4.2.3 Обновить `buildTelegramHeaders`

```typescript
// src/lib/telegram.ts

export function buildTelegramHeaders(): HeadersInit {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Telegram WebApp
    if (window.Telegram?.WebApp?.initData) {
        headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
        return headers;
    }

    // Debug Mode (только если явно включён)
    if (shouldUseDebugMode()) {
        headers['X-Debug-Mode'] = 'true';
        console.warn('[Auth] Using Debug Mode - payments disabled');
        return headers;
    }

    return headers;
}
```

#### 4.2.4 Блокировка платежей в Debug Mode

```typescript
// src/pages/SubscriptionPage.tsx

const handleSelectPlan = async (planId: PlanId) => {
    // Блокировать платежи в Debug Mode
    if (shouldUseDebugMode()) {
        toast.warning('Платежи недоступны в режиме отладки');
        return;
    }

    // ... остальная логика
};
```

#### 4.2.5 Обновить `BrowserDebugBanner.tsx`

```tsx
// src/components/BrowserDebugBanner.tsx

import { shouldUseDebugMode } from '../lib/telegram';

const BrowserDebugBanner: React.FC = () => {
    if (!shouldUseDebugMode()) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm font-medium z-50">
            ⚠️ Debug Mode — платежи и некоторые функции отключены
        </div>
    );
};
```

---

## 5. Roadmap по фазам

### Phase 1: Errors & Auth (0.5–1 день)

| # | Задача | Файлы | Приоритет |
|---|--------|-------|-----------|
| 1.1 | Добавить `parseApiError`, `ApiError`, `throwApiError` | `client.ts` | HIGH |
| 1.2 | Создать хук `useApiError` | `hooks/useApiError.ts` | HIGH |
| 1.3 | Обновить `API_ERROR_CODES` и `API_ERROR_MESSAGES` | `constants.ts` | HIGH |
| 1.4 | Сделать Auth поля опциональными | `types.ts` | MEDIUM |
| 1.5 | Обновить Debug Mode проверки | `lib/telegram.ts` | MEDIUM |

### Phase 2: AI Flow (1–2 дня)

| # | Задача | Файлы | Приоритет |
|---|--------|-------|-----------|
| 2.1 | Обновить типы в `ai.ts` | `api/ai.ts` | HIGH |
| 2.2 | Переписать `recognizeFood` и `getTaskStatus` | `api/ai.ts` | HIGH |
| 2.3 | Обновить polling в `FoodLogPage` | `pages/FoodLogPage.tsx` | HIGH |
| 2.4 | Добавить `ensureMealItems` fallback | `pages/FoodLogPage.tsx` | MEDIUM |
| 2.5 | Добавить soft-fail состояние в UI | `BatchResultsModal.tsx` | MEDIUM |
| 2.6 | Обновить polling параметры | `constants.ts` | LOW |

### Phase 3: Billing (0.5–1 день)

| # | Задача | Файлы | Приоритет |
|---|--------|-------|-----------|
| 3.1 | Удалить legacy URLs | `api/urls.ts` | HIGH |
| 3.2 | Удалить legacy функции | `api/billing.ts` | HIGH |
| 3.3 | Добавить `normalizePlanCode` | `types/billing.ts` | MEDIUM |
| 3.4 | Обновить `BillingContext` | `contexts/BillingContext.tsx` | MEDIUM |
| 3.5 | Проверить `SubscriptionPage` | `pages/SubscriptionPage.tsx` | MEDIUM |

### Phase 4: Debug/Security (0.5 дня)

| # | Задача | Файлы | Приоритет |
|---|--------|-------|-----------|
| 4.1 | Добавить `isDebugModeEnabled`, `shouldUseDebugMode` | `lib/telegram.ts` | HIGH |
| 4.2 | Обновить `buildTelegramHeaders` | `lib/telegram.ts` | HIGH |
| 4.3 | Блокировать платежи в Debug Mode | `SubscriptionPage.tsx` | HIGH |
| 4.4 | Обновить `BrowserDebugBanner` | `BrowserDebugBanner.tsx` | MEDIUM |
| 4.5 | Убедиться что `X-Debug-Mode` не в prod | CI/build check | LOW |

---

## 6. Чеклист перед релизом

- [ ] `parseApiError` покрывает все форматы ошибок от backend
- [ ] Все API модули используют `throwApiError` вместо ручного парсинга
- [ ] AI polling использует новые интервалы (1s → 2s → 4s → 8s → 10s)
- [ ] Soft-fail показывает понятное сообщение, не "Еда не распознана"
- [ ] Fallback `ensureMealItems` ограничен 2 попытками
- [ ] Legacy billing endpoints удалены из `urls.ts`
- [ ] `normalizePlanCode` используется при получении plan_code
- [ ] Debug Mode работает только когда `VITE_DEBUG_MODE=true`
- [ ] Платежи заблокированы в Debug Mode
- [ ] `BrowserDebugBanner` показывается только в Debug Mode
- [ ] Типы `AuthResponse` толерантны к отсутствующим полям

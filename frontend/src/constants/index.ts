/**
 * Константы приложения EatFit24
 */

// ============================================================
// Meal Types
// ============================================================

export const MEAL_TYPES = {
    BREAKFAST: 'BREAKFAST',
    LUNCH: 'LUNCH',
    DINNER: 'DINNER',
    SNACK: 'SNACK',
} as const;

export type MealType = typeof MEAL_TYPES[keyof typeof MEAL_TYPES];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
    BREAKFAST: 'Завтрак',
    LUNCH: 'Обед',
    DINNER: 'Ужин',
    SNACK: 'Перекус',
};

// ============================================================
// Billing / Plans
// ============================================================

export const PLAN_CODES = {
    FREE: 'FREE',
    PRO_MONTHLY: 'PRO_MONTHLY',
    PRO_YEARLY: 'PRO_YEARLY',
} as const;

export type PlanCode = typeof PLAN_CODES[keyof typeof PLAN_CODES];

// ============================================================
// API Error Codes (from backend)
// ============================================================

export const API_ERROR_CODES = {
    // AI Recognition
    DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    AI_SERVICE_TIMEOUT: 'AI_SERVICE_TIMEOUT',
    AI_RECOGNITION_FAILED: 'AI_RECOGNITION_FAILED',
    AI_PROXY_ERROR: 'AI_PROXY_ERROR',
    AI_EMPTY_RESULT: 'AI_EMPTY_RESULT',
    INVALID_IMAGE: 'INVALID_IMAGE',
    TASK_ERROR: 'TASK_ERROR',

    // Auth
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TELEGRAM_INVALID: 'TELEGRAM_INVALID',

    // Billing (new codes from backend)
    NO_SUBSCRIPTION: 'NO_SUBSCRIPTION',
    INVALID_PLAN: 'INVALID_PLAN',
    PAYMENT_ERROR: 'PAYMENT_ERROR',
    NO_PAYMENT_METHOD: 'NO_PAYMENT_METHOD',
    NOT_AVAILABLE_FOR_FREE: 'NOT_AVAILABLE_FOR_FREE',
    ACTIVE_SUBSCRIPTION: 'ACTIVE_SUBSCRIPTION',

    // General
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// ============================================================
// Error Messages (Russian localization)
// ============================================================

export const ERROR_MESSAGES: Record<string, string> = {
    // AI Recognition errors
    [API_ERROR_CODES.DAILY_LIMIT_REACHED]: 'Дневной лимит фото исчерпан. Оформите PRO для безлимита.',
    [API_ERROR_CODES.AI_SERVICE_ERROR]: 'Сервис распознавания временно недоступен',
    [API_ERROR_CODES.AI_SERVICE_TIMEOUT]: 'Сервис распознавания не отвечает. Попробуйте позже.',
    [API_ERROR_CODES.AI_RECOGNITION_FAILED]: 'Не удалось распознать еду на фото',
    [API_ERROR_CODES.AI_PROXY_ERROR]: 'Ошибка сервиса распознавания',
    [API_ERROR_CODES.AI_EMPTY_RESULT]: 'Ошибка обработки. Попробуйте ещё раз.',
    [API_ERROR_CODES.INVALID_IMAGE]: 'Неверный формат изображения. Используйте JPEG или PNG.',
    [API_ERROR_CODES.TASK_ERROR]: 'Ошибка обработки задачи',

    // Auth errors
    [API_ERROR_CODES.UNAUTHORIZED]: 'Сессия истекла. Откройте приложение заново.',
    [API_ERROR_CODES.FORBIDDEN]: 'Доступ запрещён',
    [API_ERROR_CODES.TELEGRAM_INVALID]: 'Ошибка авторизации Telegram',

    // Billing errors
    [API_ERROR_CODES.NO_SUBSCRIPTION]: 'Подписка не найдена',
    [API_ERROR_CODES.INVALID_PLAN]: 'Выбранный тариф недоступен',
    [API_ERROR_CODES.PAYMENT_ERROR]: 'Ошибка при создании платежа. Попробуйте позже.',
    [API_ERROR_CODES.NO_PAYMENT_METHOD]: 'Привяжите карту для включения автопродления.',
    [API_ERROR_CODES.NOT_AVAILABLE_FOR_FREE]: 'Эта функция доступна только в PRO подписке.',
    [API_ERROR_CODES.ACTIVE_SUBSCRIPTION]: 'У вас уже есть активная подписка.',

    // General errors
    [API_ERROR_CODES.NOT_FOUND]: 'Данные не найдены',
    [API_ERROR_CODES.VALIDATION_ERROR]: 'Некорректные данные',
    [API_ERROR_CODES.SERVER_ERROR]: 'Ошибка сервера. Попробуйте позже.',
    [API_ERROR_CODES.INTERNAL_ERROR]: 'Произошла внутренняя ошибка',
    [API_ERROR_CODES.NETWORK_ERROR]: 'Ошибка сети. Проверьте интернет-соединение.',
    [API_ERROR_CODES.TIMEOUT]: 'Превышено время ожидания. Проверьте интернет-соединение.',
    [API_ERROR_CODES.UNKNOWN_ERROR]: 'Произошла неизвестная ошибка',

    // Common English errors from backend (for partial matching)
    'No food items recognized': 'Мы не смогли распознать еду на фото. Попробуйте сделать фото крупнее.',
    'Meal not found': 'Приём пищи не найден',
    'AI service timeout': 'Сервис распознавания не отвечает',
    'Network error': 'Ошибка сети',
    'Request timeout': 'Превышено время ожидания',
    'Failed to fetch': 'Не удалось соединиться с сервером',
    'Unauthorized': 'Требуется авторизация',
    'Forbidden': 'Доступ запрещён',

    // Default
    'default': 'Произошла ошибка. Попробуйте ещё раз.',
};

/**
 * Получить локализованное сообщение об ошибке
 */
export function getErrorMessage(errorCode: string | undefined, fallback?: string): string {
    if (!errorCode) {
        return fallback || ERROR_MESSAGES['default'];
    }

    // Пробуем найти точное совпадение
    if (ERROR_MESSAGES[errorCode]) {
        return ERROR_MESSAGES[errorCode];
    }

    // Пробуем найти частичное совпадение (для длинных сообщений)
    const lowerCode = errorCode.toLowerCase();
    for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
        if (lowerCode.includes(key.toLowerCase())) {
            return message;
        }
    }

    return fallback || errorCode || ERROR_MESSAGES['default'];
}

// ============================================================
// Validation
// ============================================================

export const VALIDATION = {
    MIN_GRAMS: 1,
    MAX_GRAMS: 10000,
    MAX_PHOTO_SIZE_MB: 10,
    MAX_PHOTOS_PER_UPLOAD: 5,
} as const;

// ============================================================
// Polling (updated for better UX)
// ============================================================

export const POLLING = {
    MAX_DURATION_MS: 60000,     // 60 seconds max polling time
    INITIAL_DELAY_MS: 1000,     // Start with 1 second (was 2s)
    MAX_DELAY_MS: 10000,        // Cap at 10 seconds (was 5s)
    BACKOFF_MULTIPLIER: 2,      // Double each time: 1s -> 2s -> 4s -> 8s -> 10s
} as const;

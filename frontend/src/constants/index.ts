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
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
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
    AI_PROXY_ERROR: 'AI_PROXY_ERROR',
    AI_EMPTY_RESULT: 'AI_EMPTY_RESULT',
    INVALID_IMAGE: 'INVALID_IMAGE',
    TASK_ERROR: 'TASK_ERROR',
    
    // Auth
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TELEGRAM_INVALID: 'TELEGRAM_INVALID',
    
    // Billing
    NO_SUBSCRIPTION: 'NO_SUBSCRIPTION',
    INVALID_PLAN: 'INVALID_PLAN',
    PAYMENT_ERROR: 'PAYMENT_ERROR',
    
    // General
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// ============================================================
// Error Messages (Russian localization)
// ============================================================

export const ERROR_MESSAGES: Record<string, string> = {
    // AI Recognition errors
    [API_ERROR_CODES.DAILY_LIMIT_REACHED]: 'Лимит распознавания исчерпан на сегодня',
    [API_ERROR_CODES.AI_SERVICE_ERROR]: 'Сервис распознавания временно недоступен',
    [API_ERROR_CODES.AI_SERVICE_TIMEOUT]: 'Распознавание заняло слишком много времени',
    [API_ERROR_CODES.AI_PROXY_ERROR]: 'Ошибка сервиса распознавания',
    [API_ERROR_CODES.AI_EMPTY_RESULT]: 'Не удалось распознать еду на фото. Попробуйте другое фото.',
    [API_ERROR_CODES.INVALID_IMAGE]: 'Некорректный формат изображения',
    [API_ERROR_CODES.TASK_ERROR]: 'Ошибка обработки задачи',
    
    // Auth errors
    [API_ERROR_CODES.UNAUTHORIZED]: 'Сессия истекла. Откройте приложение заново.',
    [API_ERROR_CODES.FORBIDDEN]: 'Доступ запрещён',
    [API_ERROR_CODES.TELEGRAM_INVALID]: 'Ошибка авторизации Telegram',
    
    // Billing errors
    [API_ERROR_CODES.NO_SUBSCRIPTION]: 'Подписка не найдена',
    [API_ERROR_CODES.INVALID_PLAN]: 'Недоступный тарифный план',
    [API_ERROR_CODES.PAYMENT_ERROR]: 'Ошибка при создании платежа',
    
    // General errors
    [API_ERROR_CODES.NOT_FOUND]: 'Данные не найдены',
    [API_ERROR_CODES.VALIDATION_ERROR]: 'Некорректные данные',
    [API_ERROR_CODES.SERVER_ERROR]: 'Ошибка сервера. Попробуйте позже.',
    [API_ERROR_CODES.NETWORK_ERROR]: 'Проблема с интернетом. Проверьте подключение.',
    [API_ERROR_CODES.TIMEOUT]: 'Превышено время ожидания',
    
    // Common English errors from backend (for partial matching)
    'No food items recognized': 'Не удалось распознать продукты на фото',
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
// Polling
// ============================================================

export const POLLING = {
    MAX_DURATION_MS: 60000,    // 60 seconds
    INITIAL_DELAY_MS: 2000,    // 2 seconds
    MAX_DELAY_MS: 5000,        // 5 seconds
    BACKOFF_MULTIPLIER: 1.5,
} as const;

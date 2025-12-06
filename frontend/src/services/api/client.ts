/**
 * Base API Client
 * 
 * Provides core HTTP functionality:
 * - Fetch with timeout
 * - Retry with exponential backoff
 * - Global auth error handling (401/403)
 * - Telegram header injection
 */

import { buildTelegramHeaders, getTelegramDebugInfo } from '../../lib/telegram';

// ============================================================
// Configuration
// ============================================================

export const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
export const API_TIMEOUT = 150000; // 150 seconds
export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY = 1000; // ms

// ============================================================
// Error Classes
// ============================================================

export class UnauthorizedError extends Error {
    constructor(message: string = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends Error {
    constructor(message: string = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}

export class ApiError extends Error {
    status: number;
    code?: string;
    
    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

// ============================================================
// Auth Error Events
// ============================================================

export type AuthErrorType = 'session_expired' | 'forbidden' | 'telegram_invalid';

export interface AuthErrorEvent {
    type: AuthErrorType;
    message: string;
    status: number;
}

export const dispatchAuthError = (event: AuthErrorEvent) => {
    log(`Auth error: ${event.type} - ${event.message}`);
    window.dispatchEvent(new CustomEvent('auth:error', { detail: event }));
};

export const onAuthError = (callback: (event: AuthErrorEvent) => void): (() => void) => {
    const handler = (e: Event) => {
        callback((e as CustomEvent<AuthErrorEvent>).detail);
    };
    window.addEventListener('auth:error', handler);
    return () => window.removeEventListener('auth:error', handler);
};

// ============================================================
// Debug Logging
// ============================================================

const debugLogs: string[] = [];

export const log = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1];
    debugLogs.push(`${timestamp}: ${msg}`);
    if (debugLogs.length > 20) debugLogs.shift();
    console.log('[API]', msg);
};

export const getLogs = () => debugLogs;

export const getDebugInfo = () => ({
    ...getTelegramDebugInfo(),
    apiBase: API_BASE,
    logs: debugLogs,
});

// ============================================================
// Headers
// ============================================================

export const getHeaders = (): HeadersInit => {
    return buildTelegramHeaders();
};

export const getHeadersWithoutContentType = (): HeadersInit => {
    const headers = buildTelegramHeaders();
    delete (headers as Record<string, string>)['Content-Type'];
    return headers;
};

// ============================================================
// Auth Error Handler
// ============================================================

const handleAuthErrors = (response: Response): boolean => {
    if (response.status === 401) {
        dispatchAuthError({
            type: 'session_expired',
            message: 'Сессия истекла. Пожалуйста, откройте приложение заново из Telegram.',
            status: 401
        });
        return true;
    }
    
    if (response.status === 403) {
        dispatchAuthError({
            type: 'forbidden',
            message: 'Доступ запрещён. Попробуйте открыть приложение заново из Telegram.',
            status: 403
        });
        return true;
    }
    
    return false;
};

// ============================================================
// Fetch Functions
// ============================================================

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
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
};

export const fetchWithRetry = async (
    url: string,
    options: RequestInit = {},
    retries = API_RETRY_ATTEMPTS
): Promise<Response> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options);

            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }

            if (attempt < retries) {
                const delay = API_RETRY_DELAY * Math.pow(2, attempt);
                log(`Retry ${attempt + 1}/${retries} after ${delay}ms for ${url} (status: ${response.status})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt >= retries) {
                throw lastError;
            }

            const delay = API_RETRY_DELAY * Math.pow(2, attempt);
            log(`Network error, retry ${attempt + 1}/${retries} after ${delay}ms: ${lastError.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Unknown error');
};

// ============================================================
// Error Response Parser
// ============================================================

const FIELD_LABELS: Record<string, string> = {
    avatar: 'Аватар',
    birth_date: 'Дата рождения',
    gender: 'Пол',
    height: 'Рост',
    weight: 'Вес',
    activity_level: 'Уровень активности',
    goal_type: 'Цель',
    timezone: 'Часовой пояс',
};

export const parseErrorResponse = async (response: Response, fallback: string): Promise<string> => {
    const responseText = await response.text();

    if (!responseText) return fallback;

    try {
        const data = JSON.parse(responseText);

        if (typeof data.detail === 'string') return data.detail;
        if (typeof data.error === 'string') return data.error;

        const fieldMessages: string[] = [];
        Object.entries(data).forEach(([field, messages]) => {
            if (['detail', 'error', 'code'].includes(field)) return;

            const label = FIELD_LABELS[field] || field;

            if (Array.isArray(messages)) {
                fieldMessages.push(`${label}: ${messages.join(' ')}`);
            } else if (typeof messages === 'string') {
                fieldMessages.push(`${label}: ${messages}`);
            }
        });

        if (fieldMessages.length > 0) {
            return fieldMessages.join(' ');
        }

        return fallback;
    } catch {
        return fallback;
    }
};

// ============================================================
// Image URL Helper
// ============================================================

export const resolveImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;

    if (url.includes('backend:8000')) {
        return url.replace(/^http?:\/\/backend:8000/, '');
    }

    if (url.includes('localhost:8000') && !window.location.hostname.includes('localhost')) {
        return url.replace(/^http?:\/\/localhost:8000/, '');
    }

    if (url.startsWith('http')) return url;

    if (API_BASE.startsWith('http')) {
        try {
            const urlObj = new URL(API_BASE);
            return `${urlObj.origin}${url}`;
        } catch {
            return url;
        }
    }

    return url;
};

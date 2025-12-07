/**
 * Hook for handling API errors with toast notifications
 * 
 * Provides unified error handling for all API calls:
 * - Shows localized error messages via toast
 * - Handles specific error codes with appropriate actions
 * - Supports navigation for certain error types (e.g., subscription required)
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/api/client';
import { API_ERROR_CODES, ERROR_MESSAGES, getErrorMessage } from '../constants';

export interface UseApiErrorOptions {
    /** Don't navigate on NOT_AVAILABLE_FOR_FREE error */
    suppressNavigation?: boolean;
    /** Custom error handler called before default handling */
    onError?: (error: ApiError) => boolean; // return true to prevent default handling
}

export function useApiError(options: UseApiErrorOptions = {}) {
    const toast = useToast();
    const navigate = useNavigate();

    const handleError = useCallback((error: unknown) => {
        // Not an ApiError - show generic message
        if (!(error instanceof ApiError)) {
            const message = error instanceof Error 
                ? error.message 
                : 'Произошла неизвестная ошибка';
            toast.error(getErrorMessage(message));
            return;
        }

        // Custom handler can prevent default handling
        if (options.onError?.(error)) {
            return;
        }

        // Handle specific error codes
        switch (error.code) {
            case API_ERROR_CODES.DAILY_LIMIT_REACHED:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.DAILY_LIMIT_REACHED]);
                // Could show subscription modal here
                break;

            case API_ERROR_CODES.NOT_AVAILABLE_FOR_FREE:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.NOT_AVAILABLE_FOR_FREE]);
                if (!options.suppressNavigation) {
                    navigate('/subscription');
                }
                break;

            case API_ERROR_CODES.INVALID_IMAGE:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.INVALID_IMAGE]);
                break;

            case API_ERROR_CODES.AI_SERVICE_TIMEOUT:
            case API_ERROR_CODES.AI_SERVICE_ERROR:
                toast.error(ERROR_MESSAGES[error.code] || 'Сервис распознавания недоступен');
                break;

            case API_ERROR_CODES.AI_RECOGNITION_FAILED:
                toast.warning(error.message || ERROR_MESSAGES[API_ERROR_CODES.AI_RECOGNITION_FAILED]);
                break;

            case API_ERROR_CODES.NO_PAYMENT_METHOD:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.NO_PAYMENT_METHOD]);
                break;

            case API_ERROR_CODES.ACTIVE_SUBSCRIPTION:
                toast.info(ERROR_MESSAGES[API_ERROR_CODES.ACTIVE_SUBSCRIPTION]);
                break;

            case API_ERROR_CODES.TIMEOUT:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.TIMEOUT]);
                break;

            case API_ERROR_CODES.NETWORK_ERROR:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.NETWORK_ERROR]);
                break;

            case API_ERROR_CODES.UNAUTHORIZED:
                toast.error(ERROR_MESSAGES[API_ERROR_CODES.UNAUTHORIZED]);
                // Auth context should handle redirect
                break;

            default:
                // Use error message from API or fallback to localized message
                toast.error(error.message || getErrorMessage(error.code));
        }
    }, [toast, navigate, options]);

    /**
     * Check if error is a specific code
     */
    const isErrorCode = useCallback((error: unknown, code: string): boolean => {
        return error instanceof ApiError && error.code === code;
    }, []);

    return { 
        handleError,
        isErrorCode,
    };
}

export default useApiError;

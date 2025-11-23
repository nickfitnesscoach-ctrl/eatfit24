import { useState, useCallback } from 'react';

interface ErrorState {
  error: Error | null;
  hasError: boolean;
}

/**
 * Hook для обработки ошибок в функциональных компонентах
 *
 * @example
 * const { error, handleError, clearError } = useErrorHandler();
 *
 * try {
 *   await api.getData();
 * } catch (err) {
 *   handleError(err);
 * }
 */
export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    hasError: false,
  });

  const handleError = useCallback((error: unknown) => {
    console.error('[useErrorHandler] Error caught:', error);

    const errorObj = error instanceof Error
      ? error
      : new Error(String(error));

    setErrorState({
      error: errorObj,
      hasError: true,
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      hasError: false,
    });
  }, []);

  return {
    error: errorState.error,
    hasError: errorState.hasError,
    handleError,
    clearError,
  };
}

/**
 * Компонент для отображения ошибки
 */
interface ErrorDisplayProps {
  error: Error;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#fee',
      border: '1px solid #fcc',
      borderRadius: '8px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <div style={{ fontSize: '24px' }}>❌</div>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '4px',
            color: '#c00',
          }}>
            Ошибка
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#600',
            marginBottom: '8px',
          }}>
            {error.message}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Повторить
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Unified notification utility for billing module
 * Single place for all user-facing messages in billing
 *
 * Strategy:
 * 1) Telegram WebApp alert (если доступен)
 * 2) Browser alert (как безопасный fallback)
 */

/**
 * Показывает уведомление пользователю.
 * Внутри Telegram используется WebApp.showAlert,
 * вне Telegram — обычный browser alert.
 *
 * ВАЖНО:
 * - alert используется как fallback намеренно
 * - в биллинге лучше показать сообщение, чем промолчать
 */
export const showToast = (message: string): void => {
    // Защита от окружений без window (SSR / тесты)
    if (typeof window === 'undefined') {
        // В таких средах просто игнорируем показ
        return;
    }

    const tg = window.Telegram?.WebApp;

    if (tg?.showAlert) {
        tg.showAlert(message);
        return;
    }

    // Browser fallback (blocking, но надёжный)
    window.alert(message);
};

/**
 * Семантический алиас для успешных действий.
 * Нужен для читаемости кода и будущей кастомизации
 * (например, зелёные тосты вместо alert).
 */
export const showSuccess = (message: string): void => {
    showToast(message);
};

/**
 * Семантический алиас для ошибок.
 * Сейчас поведение то же, но намеренно разделено,
 * чтобы в будущем можно было легко поменять UX.
 */
export const showError = (message: string): void => {
    showToast(message);
};

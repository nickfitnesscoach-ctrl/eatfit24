/**
 * Unified notification utility for billing module
 * Uses Telegram WebApp API with browser fallback
 */

/**
 * Show notification using Telegram WebApp or browser alert
 */
export const showToast = (message: string): void => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
};

/**
 * Show success notification
 */
export const showSuccess = (message: string): void => {
    showToast(message);
};

/**
 * Show error notification
 */
export const showError = (message: string): void => {
    showToast(message);
};

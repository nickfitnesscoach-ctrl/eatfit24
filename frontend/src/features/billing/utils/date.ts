/**
 * Date formatting utilities for billing module
 * Single source of truth for all billing date formatting
 */

/**
 * Безопасно парсит дату.
 * Если дата невалидна — возвращаем null, а не Invalid Date.
 */
function safeParseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;

    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats date with time for payment history display
 * Example: "20 дек. 2025, 14:30"
 */
export const formatBillingDate = (dateString: string | null | undefined): string => {
    const date = safeParseDate(dateString);
    if (!date) return '—';

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Formats date as DD.MM.YYYY for subscription expiry display
 * Example: "20.12.2025"
 */
export const formatShortDate = (dateString: string | null | undefined): string => {
    const date = safeParseDate(dateString);
    if (!date) return '';

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
    });
};

/**
 * Alias for formatShortDate
 * Используется там, где важна семантика "дата окончания",
 * а не формат отображения.
 */
export const formatDate = formatShortDate;

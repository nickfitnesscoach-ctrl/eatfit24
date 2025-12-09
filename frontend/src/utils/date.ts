export const formatBillingDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats date as DD.MM.YYYY for subscription expiry display
 */
export const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
};

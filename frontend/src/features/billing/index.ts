/**
 * Billing Feature Module
 *
 * Публичная точка входа для всего billing.
 * Идея: остальные части приложения импортируют ТОЛЬКО отсюда,
 * а внутренняя структура (pages/components/hooks/utils) может меняться без боли.
 *
 * Правило:
 * - Pages и бизнес-хуки — публичные
 * - Мелкие UI-компоненты и утилиты — по необходимости
 */

// ==============================
// Public: Pages (роуты)
// ==============================
export { default as SubscriptionPage } from './pages/SubscriptionPage';
export { default as SubscriptionDetailsPage } from './pages/SubscriptionDetailsPage';
export { default as PaymentHistoryPage } from './pages/PaymentHistoryPage';

// ==============================
// Public: Hooks (основная логика UI)
// ==============================
export { useSubscriptionPlans } from './hooks/useSubscriptionPlans';
export { useSubscriptionStatus } from './hooks/useSubscriptionStatus';
export { useSubscriptionActions } from './hooks/useSubscriptionActions';
export { useSubscriptionDetails } from './hooks/useSubscriptionDetails';
export { usePaymentHistory } from './hooks/usePaymentHistory';
export { usePaymentPolling, setPollingFlagForPayment, clearPollingFlag } from './hooks/usePaymentPolling';

// ==============================
// Public: Types (контракты)
// ==============================
// ВАЖНО: сейчас PlanCode лежит в ./utils/types.
// Позже можно перенести в billing/types.ts, но не делаем это в рамках “бережного” рефакторинга.
export type { PlanCode } from './utils/types';

// ==============================
// Public: Utils (SSOT для биллинга)
// ==============================
export { formatBillingDate, formatShortDate, formatDate } from './utils/date';
export { showToast, showSuccess, showError } from './utils/notify';
export { assertBillingPlanCode, validatePlanCode, isPlanCodePro } from './utils/validation';

// ==============================
// Internal exports (опционально)
// ==============================
// Эти экспорты удобны для биллинга внутри самого модуля.
// Если хочешь сделать API “жёстче”, можно убрать их из public barrel
// и импортировать напрямую внутри billing/...
export { buildPlanCardState } from './utils/planCardState';
export { default as PlanCard } from './components/PlanCard';
export { SubscriptionHeader } from './components/SubscriptionHeader';
export { default as AdminTestPaymentCard } from './components/AdminTestPaymentCard';
export { default as PaymentHistoryList } from './components/PaymentHistoryList';

/**
 * Validation utilities for billing module
 * Strict plan code validation with fail-safe handling
 */

import type { BillingPlanCode } from '../../../types/billing';
import { IS_DEV } from '../../../config/env';
// Если ты не хочешь зависимости от notify — просто удали импорт и блок showToast ниже
import { showToast } from '../utils/notify';

const VALID_PLAN_CODES: readonly BillingPlanCode[] = ['FREE', 'PRO_MONTHLY', 'PRO_YEARLY'];

/**
 * Type guard: проверяем, что значение — один из разрешённых кодов тарифа.
 * Зачем: API/LS могут вернуть мусор, а UI не должен падать из-за этого.
 */
export function assertBillingPlanCode(value: unknown): value is BillingPlanCode {
    return typeof value === 'string' && VALID_PLAN_CODES.includes(value as BillingPlanCode);
}

/**
 * Валидируем plan_code, пришедший с сервера.
 *
 * Поведение:
 * - если код известен → возвращаем как есть
 * - если код неизвестен → возвращаем 'FREE' (fail-safe)
 *
 * DEV:
 * - логируем максимально заметно (console.error)
 * - опционально показываем уведомление через Telegram/Web fallback (НЕ блокирующее alert)
 *
 * PROD:
 * - предупреждаем в консоли и спокойно продолжаем работу
 */
export function validatePlanCode(planCode: unknown): BillingPlanCode {
    if (assertBillingPlanCode(planCode)) {
        return planCode;
    }

    const message = `Unknown plan_code received from API: ${String(planCode)}`;

    if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.error(`[Billing] ${message}`);

        // В dev важно быстро увидеть проблему, но alert() блокирует поток и бесит.
        // showToast использует Telegram showAlert (если есть) или browser alert (как fallback),
        // но в dev это приемлемо. Если хочешь полностью без попапов — убери строку ниже.
        try {
            showToast(`DEV: ${message}`);
        } catch {
            // ignore (например, если утилита используется в окружении без window)
        }
    } else {
        // eslint-disable-next-line no-console
        console.warn(`[Billing] ${message}, falling back to FREE`);
    }

    return 'FREE';
}

/**
 * Быстрый смысловой хелпер:
 * относится ли код к PRO-подписке.
 */
export function isPlanCodePro(planCode: BillingPlanCode): boolean {
    return planCode === 'PRO_MONTHLY' || planCode === 'PRO_YEARLY';
}

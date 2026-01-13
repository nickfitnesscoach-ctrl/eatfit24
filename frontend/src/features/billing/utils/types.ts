// billing/types.ts

/**
 * PlanCode — единый источник истины для кодов тарифов.
 *
 * Используется:
 * - в API
 * - в биллинге
 * - в логике карточек тарифов
 *
 * ВАЖНО:
 * - это доменный тип, а не UI-деталь
 * - любые новые тарифы добавляются ТОЛЬКО здесь
 */
export type PlanCode = 'FREE' | 'PRO_MONTHLY' | 'PRO_YEARLY';

/**
 * Явный порядок тарифов для UI.
 * Нужен для сортировки и предсказуемого отображения.
 */
export const PLAN_CODE_ORDER: readonly PlanCode[] = [
    'FREE',
    'PRO_MONTHLY',
    'PRO_YEARLY',
];

/**
 * Type guard для безопасной проверки значений,
 * пришедших с сервера или из localStorage.
 */
export function isPlanCode(value: unknown): value is PlanCode {
    return typeof value === 'string' && PLAN_CODE_ORDER.includes(value as PlanCode);
}

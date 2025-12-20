/**
 * Validation utilities for billing module
 * Strict plan code validation with fail-safe handling
 */

import type { BillingPlanCode } from '../../../types/billing';
import { IS_DEV } from '../../../config/env';

const VALID_PLAN_CODES: readonly BillingPlanCode[] = ['FREE', 'PRO_MONTHLY', 'PRO_YEARLY'];

/**
 * Type guard to check if a value is a valid BillingPlanCode
 */
export function assertBillingPlanCode(value: unknown): value is BillingPlanCode {
    return typeof value === 'string' && VALID_PLAN_CODES.includes(value as BillingPlanCode);
}

/**
 * Validate plan code from API response
 * In DEV mode: shows alert for debugging
 * In PROD mode: silently falls back to FREE with console warning
 */
export function validatePlanCode(planCode: unknown): BillingPlanCode {
    if (assertBillingPlanCode(planCode)) {
        return planCode;
    }

    const message = `Unknown plan_code received from API: ${planCode}`;

    if (IS_DEV) {
        console.error(`[Billing] ${message}`);
        // Show alert to developer for immediate visibility
        alert(`DEV Warning: ${message}`);
    } else {
        console.warn(`[Billing] ${message}, falling back to FREE`);
    }

    return 'FREE';
}

/**
 * Check if plan code represents a PRO subscription
 */
export function isPlanCodePro(planCode: BillingPlanCode): boolean {
    return planCode === 'PRO_MONTHLY' || planCode === 'PRO_YEARLY';
}

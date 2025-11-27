/**
 * Типы для Billing API
 */

export type BillingPlanCode = 'FREE' | 'MONTHLY' | 'YEARLY';

export interface BillingMe {
    plan_code: BillingPlanCode;
    plan_name: string;
    expires_at: string | null;
    is_active: boolean;
    daily_photo_limit: number | null;   // null = безлимит
    used_today: number;                // >= 0
    remaining_today: number | null;    // null = не считается (безлимит)
    auto_renew: boolean;
    payment_method: {
        type: string; // 'bank_card' etc
        last4?: string;
        brand?: string; // 'visa', 'mastercard'
    } | null;
}

export interface BillingState {
    data: BillingMe | null;
    loading: boolean;
    error: string | null;
}

export interface CreatePaymentRequest {
    plan_code: 'MONTHLY' | 'YEARLY';
    return_url?: string;
}

export interface CreatePaymentResponse {
    payment_id: string;
    yookassa_payment_id: string;
    confirmation_url: string;
}

export interface DailyLimitError {
    error: 'DAILY_LIMIT_REACHED';
    detail: string;
    current_plan: BillingPlanCode;
    daily_limit: number;
    used_today: number;
}

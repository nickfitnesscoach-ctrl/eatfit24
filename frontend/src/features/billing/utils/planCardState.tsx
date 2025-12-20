import React from 'react';
import type { Plan, PlanId } from '../components/PlanCard';
import { Loader2 } from 'lucide-react';
import type { SubscriptionDetails, BillingMe } from '../../../types/billing';
import { formatDate } from './date';

interface BillingContextData {
    subscription: SubscriptionDetails | null;
    billingMe: BillingMe | null;
}

interface PlanCardState {
    isCurrent: boolean;
    disabled: boolean;
    customButtonText?: string;
    bottomContent?: React.ReactNode;
}

interface BuildPlanCardStateParams {
    plan: Plan;
    subscription: SubscriptionDetails | null;
    billing: BillingContextData;
    isPro: boolean;
    isExpired: boolean;
    expiresAt: string | null;
    loadingPlanId: PlanId | null;
    togglingAutoRenew: boolean;
    handleSelectPlan: (planId: PlanId) => void;
    handleToggleAutoRenew: () => void;
    handleAddCard: () => void;
    navigate: (path: string) => void;
}

export const buildPlanCardState = ({
    plan,
    subscription,
    billing,
    isPro,
    isExpired,
    expiresAt,
    loadingPlanId,
    togglingAutoRenew,
    handleSelectPlan,
    handleToggleAutoRenew,
    handleAddCard,
    navigate
}: BuildPlanCardStateParams): PlanCardState => {
    let isCurrent = false;
    let customButtonText: string | undefined;
    let disabled = false;
    let bottomContent: React.ReactNode | undefined;

    if (!subscription) {
        return { isCurrent, disabled, customButtonText, bottomContent };
    }

    // Use proper plan codes - no legacy MONTHLY/YEARLY
    const userPlanCode = billing.billingMe?.plan_code ||
        (subscription.plan === 'free' ? 'FREE' : 'PRO_MONTHLY');

    // FREE CARD
    if (plan.id === 'free') {
        if (userPlanCode === 'FREE') {
            isCurrent = true;
            customButtonText = "Базовый бесплатный тариф";
            disabled = true;
        } else {
            customButtonText = "Базовый бесплатный тариф";
            disabled = true;
        }
    }
    // PRO CARDS
    else {
        // Map plan.id to proper plan codes (not legacy)
        const planCode = plan.id === 'pro_monthly' ? 'PRO_MONTHLY' : 'PRO_YEARLY';

        // If this specific PRO plan is active
        if (userPlanCode === planCode) {
            isCurrent = true;

            const autoRenew = subscription.autorenew_enabled;
            const paymentMethod = subscription.payment_method;
            const hasCard = paymentMethod?.is_attached ?? false;

            bottomContent = (
                <div className="space-y-3 mt-auto">
                    {/* Expiration Badge */}
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                        <p className="text-sm font-medium text-white">
                            Текущий план до {formatDate(expiresAt)}
                        </p>
                    </div>

                    {/* Auto-renew Status */}
                    <div className="space-y-2.5">
                        {hasCard && autoRenew ? (
                            // Variant 1: Auto-renew ON
                            <>
                                <div className="flex items-center justify-center gap-2 text-sm text-green-400">
                                    <span>🔄</span>
                                    <span>Автопродление включено</span>
                                </div>
                                <p className="text-xs text-center text-gray-400">
                                    {paymentMethod?.card_mask || 'Карта ••••'}
                                </p>
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="w-full text-center text-sm text-gray-300 hover:text-white underline decoration-gray-500 hover:decoration-white transition-all"
                                >
                                    Управлять автопродлением
                                </button>
                            </>
                        ) : hasCard && !autoRenew ? (
                            // Variant 2: Auto-renew OFF
                            <>
                                <div className="flex items-center justify-center gap-2 text-sm text-red-400">
                                    <span>⛔</span>
                                    <span>Автопродление выключено</span>
                                </div>
                                <button
                                    onClick={handleToggleAutoRenew}
                                    disabled={togglingAutoRenew}
                                    className="w-full py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    {togglingAutoRenew && <Loader2 className="animate-spin" size={14} />}
                                    Включить автопродление
                                </button>
                            </>
                        ) : (
                            // Variant 3: No Card
                            <>
                                <div className="flex items-center justify-center gap-2 text-sm text-yellow-500">
                                    <span>❗</span>
                                    <span>Автопродление недоступно</span>
                                </div>
                                <p className="text-xs text-center text-gray-400">
                                    Привяжите карту
                                </p>
                                <button
                                    onClick={handleAddCard}
                                    disabled={togglingAutoRenew}
                                    className="w-full py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    {togglingAutoRenew && <Loader2 className="animate-spin" size={14} />}
                                    Добавить карту
                                </button>
                            </>
                        )}
                    </div>
                </div>
            );
        }
        // If User is PRO but on DIFFERENT plan (e.g. Monthly vs Yearly)
        else if (isPro) {
            disabled = true;
            customButtonText = "У вас уже активен PRO";
        }
        // State C: Expired Pro (User is Free now, but was Pro)
        else if (isExpired) {
            bottomContent = (
                <div className="space-y-3 mt-auto">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <p className="text-sm font-medium text-red-400">
                            Доступ к PRO закончился {formatDate(expiresAt)}
                        </p>
                    </div>
                    <button
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={loadingPlanId === plan.id}
                        className="w-full py-3.5 bg-white text-black rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                    >
                        {loadingPlanId === plan.id ? (
                            <span className="animate-pulse">Загрузка...</span>
                        ) : (
                            `Вернуть PRO за ${plan.priceText}`
                        )}
                    </button>
                </div>
            );
        }
    }

    return { isCurrent, disabled, customButtonText, bottomContent };
};

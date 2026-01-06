import { useState, useEffect } from 'react';
import type { SubscriptionPlan } from '../../../types/billing';
import type { PlanCode } from '../utils/types';
import { api } from '../../../services/api';
import { mockSubscriptionPlans } from '../__mocks__/subscriptionPlans';

interface UseSubscriptionPlansResult {
    plans: SubscriptionPlan[];
    loading: boolean;
    error: string | null;
}

const ORDER: PlanCode[] = ['FREE', 'PRO_MONTHLY', 'PRO_YEARLY'];

/**
 * Check if mocks should be used:
 * 1. VITE_BILLING_MOCKS=1 in .env
 * 2. ?debug=1 in URL (browser only)
 */
const shouldUseMocks = (): boolean => {
    // Check env flag
    if (import.meta.env.VITE_BILLING_MOCKS === '1') {
        return true;
    }
    // Check URL param (browser debug mode)
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === '1' || params.get('mocks') === '1') {
            return true;
        }
    }
    return false;
};

/**
 * Normalize features: if plan.features is empty, generate from plan fields.
 * This ensures features are always displayed, even if API omits them.
 * 
 * SSOT: This is the ONLY place where features are generated/normalized.
 */
const normalizeFeatures = (plan: SubscriptionPlan): SubscriptionPlan => {
    // If features exist and not empty, return as-is
    if (plan.features && plan.features.length > 0) {
        return plan;
    }

    // Generate features from plan fields
    const features: string[] = [];

    // Photo limit
    if (plan.daily_photo_limit === null) {
        features.push('📸 Безлимитные фото');
    } else if (plan.daily_photo_limit > 0) {
        features.push(`📸 ${plan.daily_photo_limit} фото в день`);
    }

    // History
    if (plan.history_days === -1) {
        features.push('📊 Вся история');
    } else if (plan.history_days > 0) {
        features.push(`📊 История за ${plan.history_days} дней`);
    }

    // AI recognition
    if (plan.ai_recognition) {
        features.push('🤖 AI-распознавание еды');
    }

    // Advanced stats (PRO only)
    if (plan.advanced_stats) {
        features.push('📈 Расширенная статистика');
    }

    // Priority support (PRO only)
    if (plan.priority_support) {
        features.push('⭐ Приоритетная поддержка');
    }

    return { ...plan, features };
};

/**
 * Type guard to filter valid plan codes from API response
 */
function isPlanCode(code: string): code is PlanCode {
    return ORDER.includes(code as PlanCode);
}

export const useSubscriptionPlans = (): UseSubscriptionPlansResult => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setLoading(true);

                // DEV: return mocks if enabled
                if (shouldUseMocks()) {
                    console.log('[DEV] Using mock subscription plans');
                    const sortedMocks = [...mockSubscriptionPlans]
                        .sort((a, b) => ORDER.indexOf(a.code as PlanCode) - ORDER.indexOf(b.code as PlanCode))
                        .map(normalizeFeatures);
                    setPlans(sortedMocks);
                    return;
                }

                const apiPlans = await api.getSubscriptionPlans();

                const sortedPlans = apiPlans
                    .filter(p => isPlanCode(p.code))
                    .sort((a, b) => ORDER.indexOf(a.code as PlanCode) - ORDER.indexOf(b.code as PlanCode))
                    .map(normalizeFeatures);

                setPlans(sortedPlans);
            } catch (e) {
                console.error(e);
                setError('Не удалось загрузить тарифы, попробуйте позже');
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    return { plans, loading, error };
};


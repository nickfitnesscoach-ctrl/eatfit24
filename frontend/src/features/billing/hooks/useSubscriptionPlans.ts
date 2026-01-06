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
 * 2. ?debug=1 or ?mocks=1 in URL (browser only)
 */
const shouldUseMocks = (): boolean => {
    if (import.meta.env.VITE_BILLING_MOCKS === '1') {
        return true;
    }
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === '1' || params.get('mocks') === '1') {
            return true;
        }
    }
    return false;
};

/**
 * Type guard to filter valid plan codes from API response
 */
function isPlanCode(code: string): code is PlanCode {
    return ORDER.includes(code as PlanCode);
}

/**
 * Fetch subscription plans from API or use mocks in dev mode.
 * 
 * SSOT: Features come ONLY from API (or mocks).
 * This hook does NOT generate/modify feature texts.
 */
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
                        .sort((a, b) => ORDER.indexOf(a.code as PlanCode) - ORDER.indexOf(b.code as PlanCode));
                    setPlans(sortedMocks);
                    return;
                }

                // PROD: fetch from API
                const apiPlans = await api.getSubscriptionPlans();

                const sortedPlans = apiPlans
                    .filter(p => isPlanCode(p.code))
                    .sort((a, b) => ORDER.indexOf(a.code as PlanCode) - ORDER.indexOf(b.code as PlanCode));

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

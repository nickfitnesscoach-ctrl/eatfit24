import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { SubscriptionPlan } from '../../../types/billing';
import type { PlanCode } from '../utils/types';

interface UseSubscriptionPlansResult {
    plans: SubscriptionPlan[];
    loading: boolean;
    error: string | null;
}

const ORDER: PlanCode[] = ['FREE', 'PRO_MONTHLY', 'PRO_YEARLY'];

function isPlanCode(code: string): code is PlanCode {
    return ORDER.includes(code as PlanCode);
}

// DEV-only: мок подгружаем динамически, чтобы он НЕ попадал в prod-bundle
async function loadDevMockPlans(): Promise<SubscriptionPlan[]> {
    const mod = await import('../__mocks__/subscriptionPlans');
    return mod.mockSubscriptionPlans;
}

export const useSubscriptionPlans = (): UseSubscriptionPlansResult => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (import.meta.env.DEV) {
                const devPlans = await loadDevMockPlans();
                const sortedMocks = [...devPlans].sort(
                    (a, b) => ORDER.indexOf(a.code as PlanCode) - ORDER.indexOf(b.code as PlanCode),
                );
                setPlans(sortedMocks);
                return;
            }

            const apiPlans = await api.getSubscriptionPlans();

            const sortedPlans = (apiPlans || [])
                .filter((p) => p?.code && isPlanCode(p.code))
                .sort((a, b) => ORDER.indexOf(a.code as PlanCode) - ORDER.indexOf(b.code as PlanCode));

            setPlans(sortedPlans);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[billing] getSubscriptionPlans error:', e);
            setError('Не удалось загрузить тарифы, попробуйте позже');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return { plans, loading, error };
};

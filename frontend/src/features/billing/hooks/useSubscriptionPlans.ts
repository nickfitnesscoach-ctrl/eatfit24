import { useState, useEffect } from 'react';
import type { Plan } from '../components/PlanCard';
import { api } from '../../../services/api';
import { IS_DEV } from '../../../config/env';
import { mockSubscriptionPlans } from '../__mocks__/plans';

interface UseSubscriptionPlansResult {
    plans: Plan[];
    loading: boolean;
    error: string | null;
}

export const useSubscriptionPlans = (): UseSubscriptionPlansResult => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setLoading(true);

                // DEV MODE: Use mock plans from separate file
                const apiPlans = IS_DEV ? mockSubscriptionPlans : await api.getSubscriptionPlans();

                const uiPlans: Plan[] = apiPlans
                    .filter(p => ['FREE', 'PRO_MONTHLY', 'PRO_YEARLY'].includes(p.code))
                    .map(p => {
                        let id = p.code.toLowerCase();
                        if (p.code === 'PRO_MONTHLY') id = 'pro_monthly';
                        if (p.code === 'PRO_YEARLY') id = 'pro_yearly';
                        if (p.code === 'FREE') id = 'free';

                        let priceText = `${p.price} ₽`;
                        if (p.code === 'PRO_MONTHLY') priceText = `${p.price} ₽ / месяц`;
                        if (p.code === 'PRO_YEARLY') priceText = `${p.price} ₽ / год`;
                        if (p.code === 'FREE') priceText = '0 ₽';

                        return {
                            id,
                            code: p.code,
                            name: p.display_name,
                            priceText,
                            features: p.features || [],
                            oldPriceText: p.old_price ? `${p.old_price} ₽` : undefined,
                            tag: p.is_popular ? 'POPULAR' : undefined,
                            priceSubtext: p.code === 'PRO_YEARLY' ? `≈ ${Math.round(p.price / 12)} ₽ / месяц` : undefined
                        };
                    });

                // Sort: Free, Monthly, Yearly
                const order = ['free', 'pro_monthly', 'pro_yearly'];
                uiPlans.sort((a, b) => {
                    const idxA = order.indexOf(a.id);
                    const idxB = order.indexOf(b.id);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return 0;
                });

                setPlans(uiPlans);
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

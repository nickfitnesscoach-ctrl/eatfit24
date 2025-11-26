import React, { useState, useEffect } from 'react';
import PlanCard, { Plan, PlanId } from '../components/PlanCard';
import { api } from '../services/api';

const PLANS: Plan[] = [
    {
        id: 'free',
        name: 'Free',
        priceText: '0 ₽',
        features: [
            'До 3 фото в день',
            'Базовый анализ еды',
            'Ограниченная история (7 дней)'
        ]
    },
    {
        id: 'pro_monthly',
        name: 'PRO Plan',
        priceText: '299 ₽ / месяц',
        features: [
            'Безлимитный анализ еды',
            'Персональные рекомендации',
            'История прогресса',
            'Приоритетная поддержка'
        ]
    },
    {
        id: 'pro_yearly',
        name: 'PRO Plan – Год',
        priceText: '2490 ₽ / год',
        oldPriceText: '3588 ₽',
        priceSubtext: '≈ 208 ₽ / месяц',
        tag: 'POPULAR', // Or 'Выбор большинства' / '-30%'
        features: [
            'Безлимитный анализ еды',
            'Персональные рекомендации',
            'История прогресса',
            'Приоритетная поддержка'
        ]
    }
];

const SubscriptionPage: React.FC = () => {
    const [currentPlan, setCurrentPlan] = useState<{ id: PlanId }>({ id: 'free' });
    const [loadingPlanId, setLoadingPlanId] = useState<PlanId | null>(null);

    // Mock loading current plan from API
    useEffect(() => {
        // In a real app, we would fetch the current plan here
        // const fetchPlan = async () => {
        //     const plan = await api.getCurrentPlan();
        //     setCurrentPlan(plan);
        // };
        // fetchPlan();
    }, []);

    const showToast = (message: string) => {
        // Placeholder for toast notification
        alert(message);
    };

    const handleSelectPlan = async (planId: PlanId) => {
        if (planId === currentPlan.id) return;

        if (planId === 'free') {
            // Logic to switch to free plan
            setCurrentPlan({ id: 'free' });
            showToast("Вы используете бесплатный план");
            return;
        }

        // Check if running in Telegram Mini App
        const isTMA = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;

        try {
            setLoadingPlanId(planId);

            // Map PlanId to BillingPlanCode
            const planCode = planId === 'pro_monthly' ? 'MONTHLY' : 'YEARLY';

            // Call backend to create payment
            const { confirmation_url } = await api.createPayment({ plan_code: planCode });

            // Open payment URL
            if (isTMA && window.Telegram) {
                // Telegram Mini App: use WebApp API
                window.Telegram.WebApp.openLink(confirmation_url);
            } else {
                // Regular browser: redirect
                window.location.href = confirmation_url;
            }
        } catch (error) {
            console.error("Subscription error:", error);
            const errorMessage = error instanceof Error ? error.message : "Ошибка при оформлении подписки";
            showToast(errorMessage);
        } finally {
            setLoadingPlanId(null);
        }
    };

    return (
        <div className="p-4 pb-24 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Премиум доступ</h1>
                <p className="text-gray-500">Получи максимум от FoodMind AI</p>
            </div>

            <div className="space-y-4">
                {PLANS.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        isCurrent={plan.id === currentPlan.id}
                        isLoading={loadingPlanId === plan.id}
                        onSelect={handleSelectPlan}
                    />
                ))}
            </div>

            <p className="text-center text-xs text-gray-400 mt-8">
                Нажимая кнопку, вы соглашаетесь с условиями использования и политикой конфиденциальности.
            </p>
        </div>
    );
};

export default SubscriptionPage;

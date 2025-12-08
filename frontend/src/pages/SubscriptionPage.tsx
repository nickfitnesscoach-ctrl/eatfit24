import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanCard, { PlanId } from '../components/PlanCard';
import { api } from '../services/api';
import { useBilling } from '../contexts/BillingContext';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { SubscriptionHeader } from '../components/subscription/SubscriptionHeader';
import { buildPlanCardState } from '../utils/buildPlanCardState';

const SubscriptionPage: React.FC = () => {
    const billing = useBilling();
    const navigate = useNavigate();
    const { isBrowserDebug } = useAuth();
    const { isReady, isTelegramWebApp: webAppDetected, isBrowserDebug: webAppBrowserDebug } = useTelegramWebApp();
    const [loadingPlanId, setLoadingPlanId] = useState<PlanId | null>(null);
    const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);

    const { plans, loading: loadingPlans, error } = useSubscriptionPlans();
    const subscriptionStatus = useSubscriptionStatus(billing.subscription);

    const showToast = (message: string) => {
        const tg = window.Telegram?.WebApp;
        if (tg?.showAlert) {
            tg.showAlert(message);
        } else {
            alert(message);
        }
    };

    const handleSelectPlan = async (planId: PlanId) => {
        if (loadingPlanId) return;

        if (isBrowserDebug || webAppBrowserDebug) {
            showToast('Платежи недоступны в режиме отладки браузера');
            return;
        }

        const isTMA = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;

        try {
            setLoadingPlanId(planId);
            const plan = plans.find(p => p.id === planId);
            if (!plan) throw new Error("Plan not found");

            const { confirmation_url } = await api.createPayment({
                plan_code: plan.code,
                save_payment_method: true
            });

            if (isTMA && window.Telegram) {
                window.Telegram.WebApp.openLink(confirmation_url);
            } else {
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

    const handleToggleAutoRenew = async () => {
        if (togglingAutoRenew) return;
        try {
            setTogglingAutoRenew(true);
            await billing.toggleAutoRenew(true);
            showToast("Автопродление включено");
        } catch (error) {
            showToast("Не удалось изменить настройки автопродления");
        } finally {
            setTogglingAutoRenew(false);
        }
    };

    const handleAddCard = async () => {
        if (togglingAutoRenew) return;
        try {
            setTogglingAutoRenew(true);
            await billing.addPaymentMethod();
        } catch (error) {
            let errorMessage = "Не удалось запустить привязку карты";
            try {
                const errorData = JSON.parse((error as Error).message);
                errorMessage = errorData.message || errorMessage;
            } catch {
                errorMessage = (error as Error).message || errorMessage;
            }
            showToast(errorMessage);
        } finally {
            setTogglingAutoRenew(false);
        }
    };

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!webAppDetected && !isBrowserDebug && !webAppBrowserDebug) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center max-w-md">
                    <h2 className="text-xl font-bold text-orange-900 mb-2">
                        Откройте через Telegram
                    </h2>
                    <p className="text-orange-700">
                        Это приложение работает только внутри Telegram.
                        Пожалуйста, откройте бота и нажмите кнопку "Открыть приложение".
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 max-w-2xl mx-auto">
            <SubscriptionHeader
                topStatusText={subscriptionStatus.topStatusText}
                headerTitle={subscriptionStatus.headerTitle}
                headerSubtitle={subscriptionStatus.headerSubtitle}
            />

            <div className="space-y-4">
                {loadingPlans ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500 py-8 bg-red-50 rounded-xl">
                        {error}
                    </div>
                ) : plans.map((plan) => {
                    const cardState = buildPlanCardState({
                        plan,
                        subscription: billing.subscription,
                        billing: {
                            subscription: billing.subscription,
                            billingMe: billing.billingMe
                        },
                        isPro: subscriptionStatus.isPro,
                        isExpired: subscriptionStatus.isExpired,
                        expiresAt: billing.subscription?.expires_at ?? null,
                        loadingPlanId,
                        togglingAutoRenew,
                        handleSelectPlan,
                        handleToggleAutoRenew,
                        handleAddCard,
                        navigate
                    });

                    return (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            isCurrent={cardState.isCurrent}
                            isLoading={loadingPlanId === plan.id}
                            onSelect={handleSelectPlan}
                            customButtonText={cardState.customButtonText}
                            disabled={cardState.disabled}
                            bottomContent={cardState.bottomContent}
                        />
                    );
                })}
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
                Нажимая кнопку, вы соглашаетесь с условиями использования и политикой конфиденциальности.
            </p>
        </div>
    );
};

export default SubscriptionPage;

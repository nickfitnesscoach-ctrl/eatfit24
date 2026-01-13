import React, { useMemo } from 'react';
import { ChevronRight, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import AdminTestPaymentCard from '../components/AdminTestPaymentCard';
import { useSubscriptionDetails } from '../hooks/useSubscriptionDetails';
import { PageContainer } from '../../../components/shared/PageContainer';

const SubscriptionDetailsPage: React.FC = () => {
    const navigate = useNavigate();

    const {
        isPro,
        expiresAtFormatted,
        autoRenewEnabled,
        autoRenewAvailable,
        hasCard,
        cardInfoLabel,
        isAdmin,
        testLivePaymentAvailable,
        togglingAutoRenew,
        creatingTestPayment,
        handleToggleAutoRenew,
        handlePaymentMethodClick,
        handleCreateTestPayment,
    } = useSubscriptionDetails();

    /**
     * Все “человеческие тексты” держим рядом.
     * Так проще менять продуктовые формулировки и сложнее случайно сломать логику.
     */
    const tariffLabel = useMemo(() => {
        return isPro ? `PRO до ${expiresAtFormatted}` : 'Free';
    }, [isPro, expiresAtFormatted]);

    const autoRenewDescription = useMemo(() => {
        // Если нет карты/доступа — честно говорим, что нужно сделать
        if (!autoRenewAvailable) {
            return 'Автопродление недоступно — привяжите карту в разделе «Способ оплаты».';
        }

        // Автопродление доступно, дальше объясняем “что будет происходить”
        if (autoRenewEnabled) {
            return 'Ежемесячное списание через привязанную карту.';
        }

        return 'Списание не выполняется. Доступ к PRO сохранится до конца оплаченного периода.';
    }, [autoRenewAvailable, autoRenewEnabled]);

    const canToggleAutoRenew = autoRenewAvailable && !togglingAutoRenew;

    const showAdminCard = isAdmin && testLivePaymentAvailable;

    /**
     * Хелпер для кликабельных строк:
     * делаем блоки доступными с клавиатуры (Enter/Space),
     * при этом поведение для мыши/тапа не меняется.
     */
    const asButtonProps = (onActivate: () => void) => ({
        role: 'button' as const,
        tabIndex: 0,
        onClick: onActivate,
        onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
            }
        },
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <PageHeader title="Подписка и оплата" fallbackRoute="/subscription" />

            <PageContainer className="py-6 space-y-[var(--section-gap)]">
                <div className="bg-white rounded-[var(--radius-card)] overflow-hidden shadow-sm border border-gray-100">
                    {/* 1) Тариф: что у пользователя сейчас */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-gray-900 font-medium">Тариф</span>
                        <span className="text-gray-500 font-bold tabular-nums">{tariffLabel}</span>
                    </div>

                    {/* 2) Автопродление: объясняем “что будет”, а не “как работает код” */}
                    <div className="p-4 border-b border-gray-100 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-900 font-medium">Автопродление PRO</span>

                            <button
                                onClick={handleToggleAutoRenew}
                                disabled={!canToggleAutoRenew}
                                className={[
                                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                                    autoRenewEnabled ? 'bg-green-500' : 'bg-gray-200',
                                    !canToggleAutoRenew ? 'opacity-50 cursor-not-allowed' : '',
                                ].join(' ')}
                                aria-label="Переключить автопродление подписки"
                            >
                                <span
                                    className={[
                                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                        autoRenewEnabled ? 'translate-x-6' : 'translate-x-1',
                                    ].join(' ')}
                                />
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed">{autoRenewDescription}</p>
                    </div>

                    {/* 3) Способ оплаты: привязка/информация о карте */}
                    <div
                        {...asButtonProps(() => void handlePaymentMethodClick())}
                        className="p-4 border-b border-gray-100 flex justify-between items-center active:bg-gray-50 cursor-pointer transition-colors"
                    >
                        <div className="space-y-1">
                            <span className="text-gray-900 font-medium block">Способ оплаты</span>

                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                {hasCard && <CreditCard size={14} />}
                                <span className="tabular-nums">{cardInfoLabel}</span>
                            </div>
                        </div>

                        <ChevronRight size={20} className="text-gray-300" />
                    </div>

                    {/* 4) История оплат: отдельный экран */}
                    <div
                        {...asButtonProps(() => navigate('/settings/history'))}
                        className="p-4 flex justify-between items-center active:bg-gray-50 cursor-pointer transition-colors"
                    >
                        <span className="text-gray-900 font-medium">История оплат</span>
                        <ChevronRight size={20} className="text-gray-300" />
                    </div>
                </div>

                {/* 5) Админский блок: скрыт для обычных пользователей */}
                {showAdminCard && (
                    <AdminTestPaymentCard
                        creatingTestPayment={creatingTestPayment}
                        onCreateTestPayment={handleCreateTestPayment}
                    />
                )}
            </PageContainer>
        </div>
    );
};

export default SubscriptionDetailsPage;

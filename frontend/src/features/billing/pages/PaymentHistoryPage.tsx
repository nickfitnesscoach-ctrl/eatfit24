import React from 'react';
import PageHeader from '../../../components/PageHeader';
import PaymentHistoryList from '../components/PaymentHistoryList';
import { usePaymentHistory } from '../hooks/usePaymentHistory';
import { PageContainer } from '../../../components/shared/PageContainer';

const PaymentHistoryPage: React.FC = () => {
    /**
     * История оплат — это “архив” действий пользователя.
     * Мы просто показываем список и аккуратно обрабатываем состояния:
     * - загрузка
     * - ошибка
     * - успех
     */
    const { payments, loading, error, reload } = usePaymentHistory(20);

    return (
        <div className="min-h-screen bg-gray-50">
            <PageHeader title="История оплат" fallbackRoute="/settings/subscription" />

            <PageContainer className="py-6 space-y-[var(--section-gap)]">
                {/* 1) Пока грузим — показываем понятный индикатор */}
                {loading && (
                    <div className="p-4 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                    </div>
                )}

                {/* 2) Если случилась ошибка — объясняем пользователю и даём кнопку “повторить” */}
                {!loading && error && (
                    <div className="p-4 text-center space-y-3">
                        <div className="text-sm text-gray-600">{error}</div>
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm"
                        >
                            Повторить
                        </button>
                    </div>
                )}

                {/* 3) Успешная загрузка — показываем список */}
                {!loading && !error && <PaymentHistoryList payments={payments} />}
            </PageContainer>
        </div>
    );
};

export default PaymentHistoryPage;

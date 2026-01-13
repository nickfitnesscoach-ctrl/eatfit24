// frontend/src/features/billing/components/PaymentHistoryList.tsx
//
// Список истории платежей пользователя.
// Отображает:
// - пустое состояние, если платежей нет
// - карточки платежей со статусом, датой и суммой
//
// Важно:
// - React импортировать не нужно (современный JSX transform)
// - используем обычную функцию вместо React.FC

import type { PaymentHistoryItem } from '../../../types/billing';
import { PAYMENT_STATUS_BADGES, PAYMENT_STATUS_LABELS } from '../../../constants/billing';
import { formatBillingDate } from '../utils/date';

interface PaymentHistoryListProps {
    payments: PaymentHistoryItem[];
}

export default function PaymentHistoryList({ payments }: PaymentHistoryListProps) {
    // Получаем css-класс бейджа по статусу платежа
    // Если статус неизвестен — используем pending
    const getStatusBadge = (status: string) => {
        return PAYMENT_STATUS_BADGES[status] || PAYMENT_STATUS_BADGES.pending;
    };

    // Пустое состояние
    if (payments.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                Нет платежей
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {payments.map((payment) => (
                <div
                    key={payment.id}
                    className="bg-white rounded-xl p-4 shadow-sm"
                >
                    <div className="flex justify-between items-start gap-4">
                        {/* Левая часть: описание + дата */}
                        <div className="flex flex-col gap-0.5">
                            <div className="font-medium">
                                {payment.description}
                            </div>
                            <div className="text-sm text-gray-500">
                                {formatBillingDate(payment.paid_at)}
                            </div>
                        </div>

                        {/* Правая часть: сумма + статус */}
                        <div className="flex flex-col items-end gap-1">
                            <div className="font-bold">
                                {payment.amount} {payment.currency}
                            </div>
                            <span
                                className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(payment.status)}`}
                            >
                                {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

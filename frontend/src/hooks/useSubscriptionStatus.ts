import { SubscriptionDetails } from '../types/billing';

interface SubscriptionStatus {
    isPro: boolean;
    isExpired: boolean;
    topStatusText: string;
    headerTitle: string;
    headerSubtitle: string;
}

const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });
};

export const useSubscriptionStatus = (subscription: SubscriptionDetails | null): SubscriptionStatus => {
    const isPro = subscription?.plan === 'pro' && subscription?.is_active;
    const expiresAt = subscription?.expires_at ?? null;
    const isExpired = !isPro && !!expiresAt;

    let headerTitle = "Премиум доступ";
    let headerSubtitle = "Получи максимум от EatFit24";
    let topStatusText = "Текущий тариф: Free";

    if (isPro) {
        topStatusText = `Текущий тариф: PRO до ${formatDate(expiresAt)}`;
    } else if (isExpired) {
        topStatusText = `Подписка закончилась ${formatDate(expiresAt)}`;
    }

    return {
        isPro,
        isExpired,
        topStatusText,
        headerTitle,
        headerSubtitle
    };
};

import type { SubscriptionDetails } from '../../../types/billing';
import { formatDate } from '../utils/date';

interface SubscriptionStatus {
    isPro: boolean;
    isExpired: boolean;
    topStatusText: string;
    headerTitle: string;
    headerSubtitle: string;
}

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

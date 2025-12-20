/**
 * Mock subscription plans for development/testing
 * Matches SubscriptionPlan interface from types/billing.ts
 */

import type { SubscriptionPlan } from '../../../types/billing';

export const mockSubscriptionPlans: SubscriptionPlan[] = [
    {
        code: 'FREE',
        display_name: 'Базовый',
        price: 0,
        duration_days: 0,
        daily_photo_limit: 3,
        history_days: 7,
        ai_recognition: true,
        advanced_stats: false,
        priority_support: false,
        features: [
            '3 анализа еды в день',
            'Базовая статистика',
            'Дневник питания'
        ],
        is_popular: false,
    },
    {
        code: 'PRO_MONTHLY',
        display_name: 'PRO месяц',
        price: 299,
        duration_days: 30,
        daily_photo_limit: null, // unlimited
        history_days: -1, // unlimited
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        features: [
            'Безлимитные анализы еды',
            'Персональные рекомендации',
            'Подробная статистика',
            'Приоритетная поддержка'
        ],
        is_popular: true,
        old_price: 499,
    },
    {
        code: 'PRO_YEARLY',
        display_name: 'PRO год',
        price: 2990,
        duration_days: 365,
        daily_photo_limit: null, // unlimited
        history_days: -1, // unlimited
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        features: [
            'Все возможности PRO',
            'Экономия 17%',
            'Безлимитные анализы еды',
            'Персональные рекомендации'
        ],
        is_popular: false,
        old_price: 4990,
    }
];

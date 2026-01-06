/**
 * DEV-only mock data for subscription plans.
 * 
 * RULES:
 * 1. Only imported in useSubscriptionPlans.ts
 * 2. Matches API response 1:1 (SubscriptionPlan interface)
 * 3. Stress-tests UI: long texts, edge cases, 0₽
 * 
 * @see src/types/billing.ts for SubscriptionPlan interface
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
            '📸 3 фото в день',
            '📊 История за 7 дней',
            '🤖 AI-распознавание еды',
        ],
    },
    {
        code: 'PRO_MONTHLY',
        display_name: 'Премиум',
        price: 299,
        duration_days: 30,
        daily_photo_limit: null,
        history_days: -1,
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        features: [
            '📸 Безлимитные фото',
            '📊 Вся история',
            '📈 Расширенная статистика',
            '⭐ Приоритетная поддержка',
        ],
    },
    {
        code: 'PRO_YEARLY',
        display_name: 'Премиум Годовой',
        price: 2490,
        duration_days: 365,
        daily_photo_limit: null,
        history_days: -1,
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        is_popular: true,
        old_price: 3588,  // 299 × 12
        features: [
            '📸 Безлимитные фото',
            '📊 Вся история без ограничений',
            '📈 Расширенная статистика и отчёты',
            '⭐ Приоритетная поддержка 24/7',
            '🎁 2 месяца в подарок',
        ],
    },
];

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
            '3 AI-распознавания в день',
            'Базовый расчет КБЖУ',
            'История питания (7 дней)',
        ],
        is_popular: false,
    },
    {
        code: 'PRO_MONTHLY',
        display_name: 'PRO Месяц',
        price: 299,
        duration_days: 30,
        daily_photo_limit: null, // unlimited
        history_days: -1, // unlimited
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        features: [
            'AI-распознавание без лимитов',
            'Мгновенный подсчет калорий',
            'Анализ прогресса и привычек',
            'История за 180 дней'
        ],
        is_popular: false,
    },
    {
        code: 'PRO_YEARLY',
        display_name: 'PRO Год',
        price: 2990,
        duration_days: 365,
        daily_photo_limit: null, // unlimited
        history_days: -1, // unlimited
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        features: [
            'Все функции PRO-доступа',
            'Подарок: Стратегия с тренером',
            'Аудит твоего питания',
            'План выхода на цель'
        ],
        is_popular: false,
        old_price: 4990,
    }
];

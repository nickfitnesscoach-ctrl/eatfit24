/**
 * DEV-only мок данных для тарифов подписки.
 *
 * Назначение:
 * - используется ТОЛЬКО в DEV-режиме
 * - подменяет реальный API для разработки и тестирования UI
 *
 * ПРАВИЛА ИСПОЛЬЗОВАНИЯ:
 * 1. Импортируется ТОЛЬКО в useSubscriptionPlans.ts
 * 2. Структура данных совпадает с API 1:1 (SubscriptionPlan)
 * 3. Содержит edge-cases для стресс-теста интерфейса:
 *    - цена 0₽
 *    - null / -1 значения
 *    - длинные тексты
 *    - old_price только у годового тарифа
 *
 * ⚠️ ВАЖНО:
 * Этот файл НЕ ДОЛЖЕН попасть в production-сборку.
 * Если это произойдёт — значит нарушена архитектура.
 *
 * @see src/types/billing.ts — источник истины для SubscriptionPlan
 */

import type { SubscriptionPlan } from '../../../types/billing';

// Защита от случайного импорта в PROD: не ломаем приложение, но сигналим в консоль.
// В идеале мок не должен попадать в prod-bundle вообще (это обеспечим dynamic import ниже).
if (import.meta.env.PROD) {
    // eslint-disable-next-line no-console
    console.warn('mockSubscriptionPlans was imported in PROD (should not happen)');
}

/**
 * Порядок тарифов ВАЖЕН для UI:
 * FREE → PRO_MONTHLY → PRO_YEARLY
 */
export const mockSubscriptionPlans: SubscriptionPlan[] = [
    /**
     * FREE — базовый тариф
     * Используется для онбординга и знакомства с продуктом
     */
    {
        code: 'FREE',
        display_name: 'Базовый',
        price: 0,
        duration_days: 0,               // бессрочный
        daily_photo_limit: 3,           // лимит фото в день
        history_days: 7,                // история за 7 дней
        ai_recognition: true,
        advanced_stats: false,
        priority_support: false,
        features: [
            '3 AI-распознавания в день',
            'Базовый расчет КБЖУ',
            'История питания (7 дней)',
        ],
    },

    /**
     * PRO_MONTHLY — платный тариф на месяц
     * Основной entry-point для монетизации
     */
    {
        code: 'PRO_MONTHLY',
        display_name: 'PRO Месяц',
        price: 299,
        duration_days: 30,
        daily_photo_limit: null,        // безлимит
        history_days: -1,               // без ограничений
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        features: [
            'Полная свобода питания',
            'Мгновенный подсчет калорий',
            'Анализ прогресса и привычек',
            'Адаптивный план под твою цель',
        ],
    },

    /**
     * PRO_YEARLY — годовой тариф (основной продающий)
     * Всегда должен выглядеть самым выгодным
     */
    {
        code: 'PRO_YEARLY',
        display_name: 'PRO Год',
        price: 2990,
        old_price: 4990,                // для отображения выгоды
        duration_days: 365,
        daily_photo_limit: null,
        history_days: -1,
        ai_recognition: true,
        advanced_stats: true,
        priority_support: true,
        is_popular: true,               // UI-бейдж "популярный"
        features: [
            'Все функции PRO-доступа',
            'Бонус: Стратегия с тренером',
            'Аудит твоего питания',
            'План выхода на цель',
        ],
    },
];

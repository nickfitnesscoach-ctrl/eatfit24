// billing/utils/text.ts
import React from 'react';
import { Zap, Calculator, Calendar, Gift, FileCheck, Target } from 'lucide-react';

/**
 * Очищает текст фичи от визуального мусора:
 * - ведущих эмодзи (🔥 ⚡ 🎁 и т.п.)
 * - replacement characters
 * - zero-width символов и variation selectors
 *
 * ВАЖНО:
 * - эмодзи убираем только в начале строки,
 *   чтобы не ломать осмысленный текст дальше.
 */
export function cleanFeatureText(input: string): string {
    if (!input) return '';

    return input
        // ведущие эмодзи (если среда поддерживает Unicode property escapes)
        .replace(/^\p{Extended_Pictographic}+\s*/u, '')
        // replacement character (битые символы)
        .replace(/\uFFFD/g, '')
        // zero-width + variation selectors
        .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, '')
        .trim();
}

/**
 * Правила соответствия "смысл → иконка".
 * Порядок важен: более специфичные правила должны идти выше.
 */
const FEATURE_ICON_RULES: Array<{
    keywords: string[];
    icon: React.ReactNode;
}> = [
    {
        // Подарки, бонусы
        keywords: ['подар', 'бонус', 'в подарок'],
        icon: <Gift className="w-5 h-5" />,
    },
    {
        // Аудит, проверки, разборы
        keywords: ['аудит', 'провер', 'разбор'],
        icon: <FileCheck className="w-5 h-5" />,
    },
    {
        // Цели, планы, стратегии
        keywords: ['цель', 'план', 'стратег'],
        icon: <Target className="w-5 h-5" />,
    },
    {
        // История, периоды, дни/недели
        keywords: ['истори', 'дней', 'дня', 'недел'],
        icon: <Calendar className="w-5 h-5" />,
    },
    {
        // КБЖУ, калории, расчёты
        keywords: ['кбжу', 'калор', 'расчёт', 'расчет', 'подсчет'],
        icon: <Calculator className="w-5 h-5" />,
    },
    {
        // AI, лимиты, распознавание
        keywords: ['ai', 'нейро', 'распозна', 'лимит', 'безлимит'],
        icon: <Zap className="w-5 h-5" />,
    },
];

/**
 * Возвращает иконку по СМЫСЛУ текста фичи.
 *
 * ВАЖНО:
 * - мы не полагаемся на эмодзи
 * - мы не парсим формат
 * - только семантика
 */
export function getPlanFeatureIcon(cleanText: string): React.ReactNode | null {
    const t = (cleanText || '').toLowerCase();
    if (!t) return null;

    for (const rule of FEATURE_ICON_RULES) {
        if (rule.keywords.some((k) => t.includes(k))) {
            return rule.icon;
        }
    }

    return null;
}

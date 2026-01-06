import React from 'react';
import { Zap, Calculator, Calendar, Gift, FileCheck, Target } from 'lucide-react';

/**
 * Cleans feature strings from:
 * - leading emoji/pictograms
 * - replacement char ()
 * - zero-width / variation selectors
 */
export function cleanFeatureText(feature: string): string {
    return (
        feature
            // remove leading emoji/pictograms
            .replace(/^\p{Extended_Pictographic}+\s*/u, '')
            // remove replacement character (often shows as "")
            .replace(/\uFFFD/g, '')
            // remove zero-width & variation selectors
            .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, '')
            .trim()
    );
}

/**
 * Returns a смысловая иконка based on cleaned feature text.
 * No emojis, just clear logic based on keywords.
 */
export function getPlanFeatureIcon(cleanText: string): React.ReactNode {
    const t = cleanText.toLowerCase();

    // Gift/Bonus
    if (t.includes('бонус') || t.includes('подарок') || t.includes('стратег')) {
        return React.createElement(Gift, { className: "w-5 h-5" });
    }

    // Audit/Check
    if (t.includes('аудит') || t.includes('анализ') || t.includes('проверка')) {
        return React.createElement(FileCheck, { className: "w-5 h-5" });
    }

    // Target/Plan
    if (t.includes('цель') || t.includes('план') || t.includes('программ')) {
        return React.createElement(Target, { className: "w-5 h-5" });
    }

    // Calculation/Nutrients
    if (t.includes('кбжу') || t.includes('расчет') || t.includes('расчёт') || t.includes('нутриент')) {
        return React.createElement(Calculator, { className: "w-5 h-5" });
    }

    // History/Days
    if (t.includes('истори') || t.includes('дней') || t.includes('дня') || t.includes('день') || t.includes('отчёт')) {
        return React.createElement(Calendar, { className: "w-5 h-5" });
    }

    // Default: Limits/AI/Zap
    return React.createElement(Zap, { className: "w-5 h-5" });
}

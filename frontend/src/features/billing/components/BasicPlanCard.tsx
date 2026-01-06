import React from 'react';
import { Zap, Calculator, Calendar } from 'lucide-react';

interface BasicPlanCardProps {
    displayName: string;
    price: number;
    features: string[];
    ctaText: string;
    isCurrent: boolean;
    isLoading: boolean;
    disabled?: boolean;
    onSelect: () => void;
}

/**
 * Cleans feature strings from:
 * - leading emoji/pictograms
 * - replacement char (�)
 * - zero-width / variation selectors
 */
function cleanFeatureText(feature: string): string {
    return (
        feature
            .replace(/^\p{Extended_Pictographic}+\s*/u, '')
            .replace(/\uFFFD/g, '')
            .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, '')
            .trim()
    );
}

function getFeatureIcon(cleanText: string): React.ReactNode {
    const t = cleanText.toLowerCase();

    if (t.includes('кбжу') || t.includes('расчет') || t.includes('расчёт') || t.includes('нутриент')) {
        return <Calculator className="w-5 h-5" />;
    }
    if (t.includes('истори') || t.includes('дней') || t.includes('дня') || t.includes('день')) {
        return <Calendar className="w-5 h-5" />;
    }
    // default for limits / AI-recognition
    return <Zap className="w-5 h-5" />;
}

export function BasicPlanCard({
    displayName,
    price,
    features,
    ctaText,
    isCurrent,
    isLoading,
    disabled,
    onSelect,
}: BasicPlanCardProps) {
    const isButtonDisabled = Boolean(disabled || isCurrent || isLoading);

    return (
        <div className="relative w-full">
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200">
                {/* Header section */}
                <div className="mb-6">
                    <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-2">
                        Ограниченный доступ
                    </p>

                    <div className="flex items-baseline justify-between gap-4">
                        <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
                            {displayName}
                        </h2>

                        <div className="flex items-baseline gap-1 shrink-0">
                            <span className="text-5xl font-bold text-slate-900 tabular-nums">
                                {price}
                            </span>
                            <span className="text-xl font-semibold text-slate-600">
                                ₽
                            </span>
                        </div>
                    </div>
                </div>

                {/* Features list */}
                <div className="bg-slate-50 rounded-2xl p-5 mb-6 space-y-3.5">
                    {features.map((feature, index) => {
                        const cleanText = cleanFeatureText(feature);

                        return (
                            <div key={index} className="flex items-center gap-3">
                                <div className="text-slate-600 flex-shrink-0">
                                    {getFeatureIcon(cleanText)}
                                </div>

                                <span className="text-slate-700 text-base font-medium">
                                    {cleanText}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* CTA Button */}
                <button
                    onClick={onSelect}
                    disabled={isButtonDisabled}
                    className={`w-full py-4 px-6 rounded-2xl font-semibold text-base uppercase tracking-wide transition-all duration-200
            ${isButtonDisabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : 'bg-transparent hover:bg-slate-50 text-slate-900 border border-slate-300 hover:border-slate-400'
                        }
            ${isLoading ? 'opacity-70 cursor-wait' : ''}
          `}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Ждем...</span>
                        </div>
                    ) : (
                        ctaText
                    )}
                </button>
            </div>
        </div>
    );
}

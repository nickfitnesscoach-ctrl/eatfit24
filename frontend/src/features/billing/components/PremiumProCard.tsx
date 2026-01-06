import React from 'react';
import { Gift } from 'lucide-react';
import { PlanPriceStack } from './PlanPriceStack';
import { cleanFeatureText, getPlanFeatureIcon } from '../utils/text';

interface PremiumProCardProps {
    displayName: string;
    price: number;
    oldPrice?: number;
    priceSubtext?: string;
    features: string[];
    ctaText: string;
    isCurrent: boolean;
    isLoading: boolean;
    disabled?: boolean;
    onSelect: () => void;
    bottomContent?: React.ReactNode;
}

export function PremiumProCard({
    displayName,
    price,
    oldPrice,
    priceSubtext,
    features,
    ctaText,
    isCurrent,
    isLoading,
    disabled,
    onSelect,
    bottomContent,
}: PremiumProCardProps) {
    const isButtonDisabled = Boolean(disabled || isCurrent || isLoading);

    return (
        <div className="relative w-full h-full">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-purple-500/20 blur-3xl -z-10" />

            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-xl flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between gap-6 mb-8">
                    <div className="min-w-0">
                        <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-2">
                            Премиум функции
                        </p>

                        <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">
                            {displayName}
                        </h2>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-700/40 border border-white/5">
                                <span className="text-slate-200 text-[10px] font-black uppercase tracking-wide">
                                    Выбор пользователей
                                </span>
                            </span>

                            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-amber-500 text-slate-900 shadow-sm">
                                <Gift className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-wide">
                                    2 мес в подарок
                                </span>
                            </span>
                        </div>
                    </div>

                    <PlanPriceStack
                        priceMain={price}
                        priceUnit="₽/год"
                        oldPrice={oldPrice}
                        priceSubtext={priceSubtext}
                        alignRight={true}
                        isDark={true}
                    />
                </div>

                {/* Features list */}
                <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/30 mb-6 space-y-4">
                    {features.map((feature, index) => {
                        const cleanFeature = cleanFeatureText(feature);
                        return (
                            <div key={index} className="flex items-center gap-3 group">
                                <div className="text-amber-400 flex-shrink-0 transition-transform group-hover:scale-110">
                                    {getPlanFeatureIcon(cleanFeature)}
                                </div>
                                <span className="text-slate-100 text-base font-medium">
                                    {cleanFeature}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* CTA section */}
                <div className="mt-auto">
                    {bottomContent ? (
                        bottomContent
                    ) : (
                        <button
                            onClick={onSelect}
                            disabled={isButtonDisabled}
                            className={`w-full py-4 px-6 rounded-2xl font-bold text-lg uppercase tracking-wide transition-all duration-200
                                ${isButtonDisabled
                                    ? 'bg-white/10 text-white/30 cursor-not-allowed border border-white/5'
                                    : 'bg-white hover:bg-slate-50 text-slate-900 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
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
                    )}
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl -z-10" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-3xl -z-10" />
            </div>
        </div>
    );
}

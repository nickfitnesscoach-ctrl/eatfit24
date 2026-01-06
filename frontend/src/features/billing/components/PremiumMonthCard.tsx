// billing/components/PremiumMonthCard.tsx
import { Check } from 'lucide-react';
import { cleanFeatureText } from '../utils/text';

interface PremiumMonthCardProps {
    displayName: string;
    price: number;
    features: string[];
    ctaText: string;
    isCurrent: boolean;
    isLoading: boolean;
    disabled?: boolean;
    onSelect: () => void;
    bottomContent?: React.ReactNode;
}

export function PremiumMonthCard({
    displayName,
    price,
    features,
    ctaText,
    isCurrent,
    isLoading,
    disabled,
    onSelect,
    bottomContent,
}: PremiumMonthCardProps) {
    const isButtonDisabled = Boolean(disabled || isCurrent || isLoading);

    return (
        <div className="relative w-full max-w-md mx-auto">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20 blur-3xl -z-10" />

            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-700/50 backdrop-blur-xl">
                {/* Header with title and price */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-2">
                            Премиум функций
                        </p>
                        <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">
                            {displayName}
                        </h2>
                        <div className="inline-flex items-center bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wide">
                                Полный безлимит
                            </span>
                        </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                        <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-bold text-white bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent">
                                {price}
                            </span>
                            <span className="text-xl font-bold text-slate-300">₽/мес</span>
                        </div>
                    </div>
                </div>

                {/* Features list */}
                <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/30 mb-6 space-y-4">
                    {features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-3 group">
                            <div className="text-emerald-400 flex-shrink-0 transition-transform group-hover:scale-110">
                                <Check className="w-5 h-5" />
                            </div>
                            <span className="text-slate-100 text-base font-medium">
                                {cleanFeatureText(feature)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* CTA Button */}
                {bottomContent ? (
                    bottomContent
                ) : (
                    <button
                        onClick={onSelect}
                        disabled={isButtonDisabled}
                        className={[
                            'w-full font-bold text-lg py-4 px-6 rounded-2xl transition-all duration-200 uppercase tracking-wide',
                            isButtonDisabled
                                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 text-slate-900 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
                            isLoading ? 'opacity-70 cursor-wait' : '',
                        ].join(' ')}
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

                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full blur-3xl -z-10" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-cyan-500/10 to-transparent rounded-full blur-3xl -z-10" />
            </div>
        </div>
    );
}


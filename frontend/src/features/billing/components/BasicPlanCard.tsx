import { PlanPriceStack } from './PlanPriceStack';
import { cleanFeatureText, getPlanFeatureIcon } from '../utils/text';

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
        <div className="relative w-full h-full">
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-200 flex flex-col h-full">
                {/* Header section (Unified with Premium but light) */}
                <div className="flex items-start justify-between gap-6 mb-8">
                    <div className="min-w-0">
                        <p className="text-slate-400 text-xs font-medium tracking-wider uppercase mb-2">
                            Ограниченный доступ
                        </p>
                        <h2 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                            {displayName}
                        </h2>
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-wide">
                                Базовый план
                            </span>
                        </div>
                    </div>

                    <PlanPriceStack
                        priceMain={price}
                        priceUnit="₽"
                        alignRight={true}
                    />
                </div>

                {/* Features list */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 space-y-4">
                    {features.map((feature, index) => {
                        const cleanText = cleanFeatureText(feature);
                        return (
                            <div key={index} className="flex items-center gap-3">
                                <div className="text-slate-500 flex-shrink-0">
                                    {getPlanFeatureIcon(cleanText)}
                                </div>
                                <span className="text-slate-700 text-base font-medium">
                                    {cleanText}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* CTA Button */}
                <div className="mt-auto">
                    <button
                        onClick={onSelect}
                        disabled={isButtonDisabled}
                        className={`w-full py-4 px-6 rounded-2xl font-bold text-lg uppercase tracking-wide transition-all duration-200
                            ${isButtonDisabled
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'bg-transparent hover:bg-slate-50 text-slate-900 border border-slate-300 hover:border-slate-400 shadow-sm hover:shadow active:scale-[0.98]'
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
        </div>
    );
}

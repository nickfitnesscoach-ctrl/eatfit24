import React from 'react';

interface PlanPriceStackProps {
    priceMain: string | number;
    priceUnit?: string;
    oldPrice?: string | number;
    priceSubtext?: string;
    alignRight?: boolean;
    isDark?: boolean;
}

/**
 * PlanPriceStack ensures a stable 2-row layout for prices.
 * Prevents layout jumps by enforcing minimum heights and using non-breaking spaces.
 */
export const PlanPriceStack: React.FC<PlanPriceStackProps> = ({
    priceMain,
    priceUnit,
    oldPrice,
    priceSubtext,
    alignRight = false,
    isDark = false
}) => {
    const mainTextColor = isDark ? 'text-white' : 'text-slate-900';
    const unitTextColor = isDark ? 'text-slate-300' : 'text-slate-600';
    const secondaryTextColor = isDark ? 'text-slate-400' : 'text-slate-500';
    const alignmentClass = alignRight ? 'text-right justify-end' : 'text-left justify-start';

    return (
        <div className={`flex flex-col ${alignmentClass} shrink-0`}>
            {/* Row 1: Main Price + Unit */}
            <div className={`flex items-baseline gap-1 ${alignmentClass}`}>
                <span className={`text-5xl font-bold tabular-nums leading-none ${mainTextColor}`}>
                    {priceMain}
                </span>
                {priceUnit && (
                    <span className={`text-xl font-bold whitespace-nowrap leading-none ${unitTextColor}`}>
                        {priceUnit}
                    </span>
                )}
            </div>

            {/* Row 2: Old Price + Subtext (Stable height) */}
            <div className={`mt-2 flex items-baseline gap-3 min-h-[1.25rem] ${alignmentClass}`}>
                {oldPrice ? (
                    <span className={`${secondaryTextColor} text-sm font-semibold line-through`}>
                        {oldPrice} ₽
                    </span>
                ) : null}

                <span className={`${secondaryTextColor} text-sm font-medium`}>
                    {priceSubtext ?? (oldPrice ? '' : '\u00A0')}
                </span>
            </div>
        </div>
    );
};

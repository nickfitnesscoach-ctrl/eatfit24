import React from 'react';

interface SubscriptionHeaderProps {
    topStatusText: string;
    headerTitle: string;
    headerSubtitle: string;
}

export const SubscriptionHeader: React.FC<SubscriptionHeaderProps> = ({
    topStatusText,
    headerTitle,
    headerSubtitle
}) => {
    return (
        <div className="px-4 pt-2 pb-3 text-center mb-6">
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-slate-500">
                {topStatusText}
            </p>

            <h1 className="mt-1 text-[22px] font-bold leading-tight text-slate-900">
                {headerTitle}
            </h1>

            <p className="mt-2 text-sm leading-snug text-slate-600">
                {headerSubtitle}
            </p>
        </div>
    );
};

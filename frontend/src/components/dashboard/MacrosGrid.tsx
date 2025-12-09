import React from 'react';

export interface MacroInfo {
    label: string;
    icon: React.ReactNode;
    consumed: number;
    goal?: number;
    progressPercent: number;
    barColorClass: string;
}

interface MacrosGridProps {
    items: MacroInfo[];
}

export const MacrosGrid: React.FC<MacrosGridProps> = ({ items }) => {
    return (
        <div className="grid grid-cols-3 gap-3">
            {items.map((item, index) => (
                <div key={index} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                        {item.icon}
                        <span className="text-xs text-gray-500">{item.label}</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{item.consumed}г</p>
                    <div className="bg-gray-100 rounded-full h-1.5 mt-2">
                        <div
                            className={`${item.barColorClass} rounded-full h-1.5 transition-all`}
                            style={{ width: `${item.progressPercent}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">из {item.goal || '—'}г</p>
                </div>
            ))}
        </div>
    );
};

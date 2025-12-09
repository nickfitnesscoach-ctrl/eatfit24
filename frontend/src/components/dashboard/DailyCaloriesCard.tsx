import React from 'react';
import { Flame } from 'lucide-react';

interface DailyCaloriesCardProps {
    consumedCalories: number;
    goalCalories?: number;
    remainingCalories: number;
    progressPercent: number;
}

export const DailyCaloriesCard: React.FC<DailyCaloriesCardProps> = ({
    consumedCalories,
    goalCalories,
    remainingCalories,
    progressPercent
}) => {
    return (
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-xl">
                        <Flame size={28} />
                    </div>
                    <div>
                        <p className="text-white/80 text-sm">Калории сегодня</p>
                        <p className="text-3xl font-bold">{consumedCalories}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-white/80 text-sm">Цель</p>
                    <p className="text-xl font-semibold">{goalCalories || '—'}</p>
                </div>
            </div>

            <div className="bg-white/20 rounded-full h-3 mb-3">
                <div
                    className="bg-white rounded-full h-3 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            <div className="flex justify-between text-sm">
                <span className="text-white/80">Осталось: {remainingCalories} ккал</span>
                <span className="text-white/80">{Math.round(progressPercent)}%</span>
            </div>
        </div>
    );
};

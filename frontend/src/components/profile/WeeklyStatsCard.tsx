import React from 'react';
import { TrendingUp, ChevronRight } from 'lucide-react';

interface WeeklyStatsCardProps {
    isOpen: boolean;
    onToggle: () => void;
    avgCalories: number;
    avgProtein: number;
    avgFat: number;
    avgCarbs: number;
}

const WeeklyStatsCard: React.FC<WeeklyStatsCardProps> = ({
    isOpen,
    onToggle,
    avgCalories,
    avgProtein,
    avgFat,
    avgCarbs
}) => {
    return (
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-4 transition-all duration-300">
            <div
                className="py-0.5 px-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center shrink-0 mt-1">
                        <TrendingUp size={24} className="text-white" />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight">Среднее КБЖУ за неделю</h2>
                        <p className="text-xs text-gray-500 leading-tight">Ваш прогресс</p>
                    </div>
                </div>
                <ChevronRight
                    size={24}
                    className={`text-gray-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                />
            </div>

            <div className={`grid grid-cols-2 gap-2 px-4 pb-4 transition-all duration-300 origin-top ${isOpen ? 'opacity-100 max-h-[500px] mt-0' : 'opacity-0 max-h-0 overflow-hidden mt-0 pb-0'
                }`}>
                <div className="flex flex-col p-3 bg-orange-50 rounded-xl">
                    <span className="text-gray-600 text-xs mb-0.5">Калории</span>
                    <span className="text-xl font-bold text-orange-600">{avgCalories}</span>
                    <span className="text-xs text-gray-500">ккал/день</span>
                </div>
                <div className="flex flex-col p-3 bg-blue-50 rounded-xl">
                    <span className="text-gray-600 text-xs mb-0.5">Белки</span>
                    <span className="text-xl font-bold text-blue-600">{avgProtein}г</span>
                    <span className="text-xs text-gray-500">в среднем</span>
                </div>
                <div className="flex flex-col p-3 bg-yellow-50 rounded-xl">
                    <span className="text-gray-600 text-xs mb-0.5">Жиры</span>
                    <span className="text-xl font-bold text-yellow-600">{avgFat}г</span>
                    <span className="text-xs text-gray-500">в среднем</span>
                </div>
                <div className="flex flex-col p-3 bg-green-50 rounded-xl">
                    <span className="text-gray-600 text-xs mb-0.5">Углеводы</span>
                    <span className="text-xl font-bold text-green-600">{avgCarbs}г</span>
                    <span className="text-xs text-gray-500">в среднем</span>
                </div>
            </div>
        </div>
    );
};

export default WeeklyStatsCard;

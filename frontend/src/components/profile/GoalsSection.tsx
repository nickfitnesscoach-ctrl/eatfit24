import React from 'react';
import { Target } from 'lucide-react';

interface UserGoals {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
}

interface GoalsSectionProps {
    goals: UserGoals | null;
    editedGoals: UserGoals | null;
    isEditingGoals: boolean;
    isLoading: boolean;
    error: string | null;
    onEdit: () => void;
    onChangeBju: (field: 'protein' | 'fat' | 'carbohydrates', value: number) => void;
    onAutoCalculate: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const GoalsSection: React.FC<GoalsSectionProps> = ({
    goals,
    editedGoals,
    isEditingGoals,
    isLoading,
    error,
    onEdit,
    onChangeBju,
    onAutoCalculate,
    onSave,
    onCancel
}) => {
    return (
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                        <Target size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Мои цели</h2>
                        <p className="text-sm text-gray-500">Дневные показатели КБЖУ</p>
                    </div>
                </div>
                {!isEditingGoals && (
                    <button
                        onClick={onEdit}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                        Редактировать
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
            ) : isEditingGoals && editedGoals ? (
                <div>
                    {/* Calories - auto-calculated, shown prominently */}
                    <div className="bg-gradient-to-br from-orange-500 to-red-500 p-5 rounded-2xl mb-4 text-white">
                        <div className="text-sm text-white/80 mb-1">Калории (рассчитано автоматически)</div>
                        <div className="text-4xl font-bold">{editedGoals.calories} ккал</div>
                        <div className="text-xs text-white/60 mt-1">= Б×4 + Ж×9 + У×4</div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border-2 border-blue-100">
                            <label className="text-sm text-blue-600 font-medium mb-2 block">Белки</label>
                            <input
                                type="number"
                                value={editedGoals.protein}
                                onChange={(e) => onChangeBju('protein', parseInt(e.target.value) || 0)}
                                className="w-full text-2xl font-bold text-blue-700 bg-white/50 rounded-lg px-2 py-1 border-2 border-blue-200 focus:outline-none focus:border-blue-400"
                            />
                            <div className="text-xs text-blue-500 mt-1">г/день</div>
                        </div>
                        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-2xl border-2 border-yellow-100">
                            <label className="text-sm text-yellow-600 font-medium mb-2 block">Жиры</label>
                            <input
                                type="number"
                                value={editedGoals.fat}
                                onChange={(e) => onChangeBju('fat', parseInt(e.target.value) || 0)}
                                className="w-full text-2xl font-bold text-yellow-700 bg-white/50 rounded-lg px-2 py-1 border-2 border-yellow-200 focus:outline-none focus:border-yellow-400"
                            />
                            <div className="text-xs text-yellow-500 mt-1">г/день</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-2xl border-2 border-green-100">
                            <label className="text-sm text-green-600 font-medium mb-2 block">Углеводы</label>
                            <input
                                type="number"
                                value={editedGoals.carbohydrates}
                                onChange={(e) => onChangeBju('carbohydrates', parseInt(e.target.value) || 0)}
                                className="w-full text-2xl font-bold text-green-700 bg-white/50 rounded-lg px-2 py-1 border-2 border-green-200 focus:outline-none focus:border-green-400"
                            />
                            <div className="text-xs text-green-500 mt-1">г/день</div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onAutoCalculate}
                            className="flex-1 px-4 py-3 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors font-medium"
                        >
                            Рассчитать по формуле Маффина-Сан Жеора
                        </button>
                    </div>
                    <div className="flex gap-3 mt-3">
                        <button
                            onClick={onSave}
                            className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium"
                        >
                            Сохранить
                        </button>
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                        >
                            Отменить
                        </button>
                    </div>
                </div>
            ) : goals ? (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-2xl border-2 border-orange-100">
                        <div className="text-sm text-orange-600 font-medium mb-1">Калории</div>
                        <div className="text-2xl font-bold text-orange-700">{goals.calories}</div>
                        <div className="text-xs text-orange-500 mt-1">ккал/день</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border-2 border-blue-100">
                        <div className="text-sm text-blue-600 font-medium mb-1">Белки</div>
                        <div className="text-2xl font-bold text-blue-700">{goals.protein}</div>
                        <div className="text-xs text-blue-500 mt-1">г/день</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-2xl border-2 border-yellow-100">
                        <div className="text-sm text-yellow-600 font-medium mb-1">Жиры</div>
                        <div className="text-2xl font-bold text-yellow-700">{goals.fat}</div>
                        <div className="text-xs text-yellow-500 mt-1">г/день</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-2xl border-2 border-green-100">
                        <div className="text-sm text-green-600 font-medium mb-1">Углеводы</div>
                        <div className="text-2xl font-bold text-green-700">{goals.carbohydrates}</div>
                        <div className="text-xs text-green-500 mt-1">г/день</div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">Цели не установлены</p>
                    <button
                        onClick={onEdit}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                        Установить цели
                    </button>
                </div>
            )}
        </div>
    );
};

export default GoalsSection;

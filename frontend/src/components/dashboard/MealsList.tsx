import React from 'react';
import { ChevronRight, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Meal } from '../../types/meal';
import { MEAL_TYPE_LABELS } from '../../constants/meals';
import { MealPhotoStrip } from '../meal/MealPhotoGallery';

interface MealsListProps {
    meals: Meal[];
    onOpenMeal: (mealId: number) => void;
}

export const MealsList: React.FC<MealsListProps> = ({
    meals,
    onOpenMeal,
}) => {
    const navigate = useNavigate();

    return (
        <div className="bg-white rounded-[var(--radius-card)] p-[var(--card-p)] shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-[var(--card-p)]">
                <h2 className="text-lg font-bold text-gray-900">Сегодня</h2>
                <span className="text-sm text-gray-500">{meals.length} приемов пищи</span>
            </div>

            {meals.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-400 mb-2">Пока нет записей</p>
                    <p className="text-sm text-gray-300">Добавьте первый прием пищи</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {meals.map((meal) => {
                        // Backend returns 'items' field, with 'food_items' as fallback
                        const items = meal.items || meal.food_items || [];
                        const mealCalories = items.reduce((sum, item) =>
                            sum + (parseFloat(String(item.calories)) || 0), 0) || 0;

                        // P0: Derived state logic (with fallback for old backend versions)
                        const photosCount = meal.photos_count ?? meal.photos?.length ?? 0;

                        const hasSuccess =
                            meal.has_success ??
                            meal.photos?.some(p => p.status === 'SUCCESS') ??
                            (items.length > 0);

                        const isProcessing =
                            meal.is_processing ??
                            meal.photos?.some(p => p.status === 'PENDING' || p.status === 'PROCESSING') ??
                            (meal.status === 'PROCESSING');

                        // allFailed = есть фото, но нет успеха и ничего не обрабатывается
                        const allFailed = photosCount > 0 && !hasSuccess && !isProcessing;

                        const handleRetry = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            // Navigate to log page with retry context
                            navigate('/log', {
                                state: {
                                    retryMealId: meal.id,
                                    retryMealPhotoId: meal.latest_failed_photo_id ?? undefined,
                                    selectedDate: meal.date,
                                    mealType: meal.meal_type
                                }
                            });
                        };

                        return (
                            <div
                                key={meal.id}
                                className="relative group"
                            >
                                <div
                                    onClick={() => onOpenMeal(meal.id)}
                                    className="flex items-center gap-3 p-[var(--card-p)] bg-white border border-gray-100 rounded-[var(--radius-card)] cursor-pointer hover:bg-gray-50 transition-colors active:scale-[0.98] shadow-sm"
                                >
                                    {/* 1. Photos (Fixed) */}
                                    <div className="w-16 min-w-16 flex items-center">
                                        <MealPhotoStrip
                                            photos={meal.photos || []}
                                            fallbackPhotoUrl={meal.photo_url}
                                        />
                                    </div>

                                    {/* 2. Text (Flexible) */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 flex items-center gap-2 truncate">
                                            {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                                            {isProcessing && (
                                                <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
                                            )}
                                            {allFailed && (
                                                <AlertCircle size={14} className="text-red-500 shrink-0" />
                                            )}
                                        </div>
                                        <div className={`text-sm truncate mt-0.5 ${allFailed ? 'text-red-500' : 'text-gray-500'}`}>
                                            {isProcessing
                                                ? 'Обработка...'
                                                : allFailed
                                                    ? 'Ошибка распознавания'
                                                    : `${items.length} ${items.length === 1 ? 'блюдо' : 'блюд'}`}
                                        </div>
                                    </div>

                                    {/* 3. Kcal or Retry Button (Fixed) */}
                                    <div className="w-[84px] min-w-[84px] text-right whitespace-nowrap">
                                        {allFailed ? (
                                            <button
                                                onClick={handleRetry}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors active:scale-95"
                                            >
                                                <RefreshCw size={12} />
                                                Повторить
                                            </button>
                                        ) : (
                                            <div className="tabular-nums">
                                                <span className="font-bold text-orange-600">
                                                    {Math.round(mealCalories)}
                                                </span>
                                                <span className="text-xs text-orange-400 font-medium ml-1">ккал</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 4. Chevron (Fixed) - only show if not allFailed */}
                                    {!allFailed && (
                                        <div className="w-6 min-w-6 flex justify-end">
                                            <ChevronRight size={18} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

import React from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Meal } from '../../types/meal';
import { MEAL_TYPE_LABELS } from '../../constants/meals';
import { MealPhotoStrip } from '../meal/MealPhotoGallery';

interface MealsListProps {
    meals: Meal[];
    onOpenMeal: (mealId: number) => void;
    onDeleteMealClick: (e: React.MouseEvent, mealId: number) => void;
}

export const MealsList: React.FC<MealsListProps> = ({
    meals,
    onOpenMeal,
    onDeleteMealClick
}) => {
    return (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
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

                        return (
                            <div
                                key={meal.id}
                                className="relative group"
                            >
                                <div
                                    onClick={() => onOpenMeal(meal.id)}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Photo gallery for multi-photo meals */}
                                        <MealPhotoStrip
                                            photos={meal.photos || []}
                                            fallbackPhotoUrl={meal.photo_url}
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {items.length} {items.length === 1 ? 'блюдо' : 'блюд'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-orange-600">
                                            {Math.round(mealCalories)} ккал
                                        </span>
                                        <button
                                            onClick={(e) => onDeleteMealClick(e, meal.id)}
                                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            aria-label="Удалить приём пищи"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <ChevronRight size={18} className="text-gray-400" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

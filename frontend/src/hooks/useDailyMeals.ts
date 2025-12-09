import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { Meal, TotalConsumed } from '../types/meal';

interface MealsCacheEntry {
    meals: Meal[];
    consumed: TotalConsumed;
}

type MealsCache = Record<string, MealsCacheEntry>;

interface UseDailyMealsOptions {
    initialDate: Date;
    enabled?: boolean; // Controls if hook should load data (for WebApp gating)
}

interface UseDailyMealsResult {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;

    meals: Meal[];
    consumed: TotalConsumed;

    loading: boolean;
    error: string | null;
    setError: (val: string | null) => void;

    refresh: () => Promise<void>;
    deleteMeal: (mealId: number) => Promise<void>;
}

export const useDailyMeals = ({ initialDate, enabled = true }: UseDailyMealsOptions): UseDailyMealsResult => {
    const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
    const [meals, setMeals] = useState<Meal[]>([]);
    const [consumed, setConsumed] = useState<TotalConsumed>({
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cache persists across date switches
    const mealsCacheRef = useRef<MealsCache>({});
    // StrictMode protection
    const hasFetchedInitialRef = useRef(false);

    /**
     * Load meals for a specific date with caching
     * - Uses cache if available (instant)
     * - Only shows loading when fetching new date
     * - Cache invalidates on explicit refresh
     */
    const loadMeals = useCallback(async (date: Date, forceRefresh = false) => {
        const dateStr = date.toISOString().split('T')[0];

        // Check cache first (unless force refresh)
        if (!forceRefresh && mealsCacheRef.current[dateStr]) {
            const cached = mealsCacheRef.current[dateStr];
            setMeals(cached.meals);
            setConsumed(cached.consumed);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const mealsData = await api.getMeals(dateStr);

            let loadedMeals: Meal[] = [];
            let loadedConsumed: TotalConsumed = {
                calories: 0,
                protein: 0,
                fat: 0,
                carbohydrates: 0
            };

            // API returns object: {date, daily_goal, total_consumed, progress, meals}
            if (mealsData && mealsData.meals && Array.isArray(mealsData.meals)) {
                loadedMeals = mealsData.meals;

                if (mealsData.total_consumed) {
                    loadedConsumed = {
                        calories: Math.round(mealsData.total_consumed.calories || 0),
                        protein: Math.round(mealsData.total_consumed.protein || 0),
                        fat: Math.round(mealsData.total_consumed.fat || 0),
                        carbohydrates: Math.round(mealsData.total_consumed.carbohydrates || 0)
                    };
                }
            } else if (Array.isArray(mealsData)) {
                // Fallback: old format returns array directly
                loadedMeals = mealsData;

                let totalCalories = 0;
                let totalProtein = 0;
                let totalFat = 0;
                let totalCarbs = 0;

                mealsData.forEach((meal: any) => {
                    meal.items?.forEach((item: any) => {
                        totalCalories += parseFloat(item.calories) || 0;
                        totalProtein += parseFloat(item.protein) || 0;
                        totalFat += parseFloat(item.fat) || 0;
                        totalCarbs += parseFloat(item.carbohydrates) || 0;
                    });
                });

                loadedConsumed = {
                    calories: Math.round(totalCalories),
                    protein: Math.round(totalProtein),
                    fat: Math.round(totalFat),
                    carbohydrates: Math.round(totalCarbs)
                };
            }

            // Update cache
            mealsCacheRef.current[dateStr] = {
                meals: loadedMeals,
                consumed: loadedConsumed
            };

            setMeals(loadedMeals);
            setConsumed(loadedConsumed);
        } catch (err) {
            console.error('Dashboard load error:', err);
            setError('Не удалось загрузить данные');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Initial load - runs once on mount
     */
    useEffect(() => {
        // StrictMode protection
        if (hasFetchedInitialRef.current) return;
        if (!enabled) return;

        hasFetchedInitialRef.current = true;
        loadMeals(selectedDate);
    }, [enabled, selectedDate, loadMeals]);

    /**
     * Load meals when date changes (after initial mount)
     */
    useEffect(() => {
        // Skip if initial load not done
        if (!hasFetchedInitialRef.current) return;

        loadMeals(selectedDate);
    }, [selectedDate, loadMeals]);

    /**
     * Force refresh - invalidates cache and reloads
     */
    const refresh = useCallback(async () => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        delete mealsCacheRef.current[dateStr];
        await loadMeals(selectedDate, true);
    }, [selectedDate, loadMeals]);

    /**
     * Delete meal and refresh data
     */
    const deleteMeal = useCallback(async (mealId: number) => {
        try {
            await api.deleteMeal(mealId);
            // Invalidate cache and reload
            const dateStr = selectedDate.toISOString().split('T')[0];
            delete mealsCacheRef.current[dateStr];
            await loadMeals(selectedDate, true);
        } catch (err) {
            console.error('Delete meal error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Не удалось удалить приём пищи';
            setError(errorMessage);
            throw err; // Re-throw to allow caller to handle
        }
    }, [selectedDate, loadMeals]);

    return {
        selectedDate,
        setSelectedDate,
        meals,
        consumed,
        loading,
        error,
        setError,
        refresh,
        deleteMeal
    };
};

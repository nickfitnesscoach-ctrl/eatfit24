import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface WeeklyStats {
    avgCalories: number;
    avgProtein: number;
    avgFat: number;
    avgCarbs: number;
}

export const useWeeklyKbjuStats = () => {
    const [stats, setStats] = useState<WeeklyStats>({
        avgCalories: 0,
        avgProtein: 0,
        avgFat: 0,
        avgCarbs: 0
    });

    const getWeekDays = () => {
        const days = [];
        const today = new Date();
        const currentDay = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            days.push(date);
        }
        return days;
    };

    const loadWeeklyStats = async () => {
        try {
            const weekDaysData = getWeekDays();
            const mealsData = await Promise.all(
                weekDaysData.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    return api.getMeals(dateStr).catch(() => []);
                })
            );

            let totalCalories = 0;
            let totalProtein = 0;
            let totalFat = 0;
            let totalCarbs = 0;
            let daysWithData = 0;

            mealsData.forEach(dayMeals => {
                if (dayMeals && dayMeals.length > 0) {
                    daysWithData++;
                    dayMeals.forEach((meal: any) => {
                        meal.food_items?.forEach((item: any) => {
                            totalCalories += item.calories || 0;
                            totalProtein += item.protein || 0;
                            totalFat += item.fat || 0;
                            totalCarbs += item.carbohydrates || 0;
                        });
                    });
                }
            });

            const avgCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
            const avgProtein = daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0;
            const avgFat = daysWithData > 0 ? Math.round(totalFat / daysWithData) : 0;
            const avgCarbs = daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0;

            setStats({
                avgCalories,
                avgProtein,
                avgFat,
                avgCarbs
            });
        } catch (error) {
            console.error('Failed to load weekly stats:', error);
        }
    };

    useEffect(() => {
        loadWeeklyStats();
    }, []);

    return stats;
};

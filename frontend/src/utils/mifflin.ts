/**
 * Mifflin-St Jeor formula calculation utilities
 * Calculates daily caloric needs and macronutrient targets
 */

import { Profile } from '../types/profile';

export interface MifflinTargets {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
}

/**
 * Activity level multipliers for TDEE calculation
 */
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
    sedentary: 1.2,          // Минимальная активность
    lightly_active: 1.375,   // Легкая активность
    moderately_active: 1.55, // Умеренная активность
    very_active: 1.725,      // Высокая активность
    extra_active: 1.9,       // Очень высокая активность
};

/**
 * Goal type caloric adjustments
 */
const GOAL_MULTIPLIERS: Record<string, number> = {
    weight_loss: 0.8,    // 20% дефицит
    maintenance: 1.0,    // Поддержание веса
    weight_gain: 1.15,   // 15% профицит
};

/**
 * Macronutrient distribution (percentage of total calories)
 */
const MACRO_DISTRIBUTION = {
    protein: 0.30,  // 30% калорий из белка
    fat: 0.25,      // 25% калорий из жиров
    carbs: 0.45,    // 45% калорий из углеводов
};

/**
 * Caloric values per gram of macronutrients
 */
const CALORIES_PER_GRAM = {
    protein: 4,
    fat: 9,
    carbs: 4,
};

/**
 * Minimum daily caloric intake by gender
 */
const MIN_CALORIES = {
    M: 1400, // Мужчины
    F: 1200, // Женщины
};

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    return age;
}

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor formula
 */
function calculateBMR(
    gender: 'M' | 'F',
    age: number,
    heightCm: number,
    weightKg: number
): number {
    // Mifflin-St Jeor formula:
    // Men: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + 5
    // Women: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) - 161

    const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;

    if (gender === 'M') {
        return baseBMR + 5;
    } else {
        return baseBMR - 161;
    }
}

/**
 * Round calories to nearest 5
 */
function roundToNearest5(value: number): number {
    return Math.round(value / 5) * 5;
}

/**
 * Check if profile has all required fields for calculation
 */
export function hasRequiredProfileData(profile: Profile | null): boolean {
    if (!profile) return false;

    return !!(
        profile.gender &&
        profile.birth_date &&
        profile.height &&
        profile.weight &&
        profile.activity_level
    );
}

/**
 * Get missing profile fields for user feedback
 */
export function getMissingProfileFields(profile: Profile | null): string[] {
    const missing: string[] = [];

    if (!profile) {
        return ['Профиль не загружен'];
    }

    if (!profile.gender) missing.push('Пол');
    if (!profile.birth_date) missing.push('Дата рождения');
    if (!profile.height) missing.push('Рост');
    if (!profile.weight) missing.push('Вес');
    if (!profile.activity_level) missing.push('Уровень активности');

    return missing;
}

/**
 * Calculate daily caloric and macronutrient targets using Mifflin-St Jeor formula
 *
 * @param profile - User profile with gender, birth_date, height, weight, activity_level
 * @returns Calculated targets for calories, protein, fat, and carbohydrates
 * @throws Error if required profile data is missing
 */
export function calculateMifflinTargets(profile: Profile): MifflinTargets {
    // Validate required fields
    if (!hasRequiredProfileData(profile)) {
        const missing = getMissingProfileFields(profile);
        throw new Error(
            `Не хватает данных профиля для расчёта: ${missing.join(', ')}`
        );
    }

    const { gender, birth_date, height, weight, activity_level, goal_type } = profile;

    // Calculate age
    const age = calculateAge(birth_date!);

    // Calculate BMR using Mifflin-St Jeor formula
    const bmr = calculateBMR(gender!, age, height!, weight!);

    // Get activity multiplier
    const activityMultiplier = ACTIVITY_MULTIPLIERS[activity_level!] || 1.2;

    // Calculate Total Daily Energy Expenditure (TDEE)
    const tdee = bmr * activityMultiplier;

    // Apply goal adjustment
    const goalMultiplier = goal_type ? GOAL_MULTIPLIERS[goal_type] : 1.0;
    let targetCalories = tdee * goalMultiplier;

    // Apply minimum caloric threshold
    const minCalories = MIN_CALORIES[gender!];
    if (targetCalories < minCalories) {
        targetCalories = minCalories;
    }

    // Round to nearest 5
    targetCalories = roundToNearest5(targetCalories);

    // Calculate macronutrients in grams
    const proteinCalories = targetCalories * MACRO_DISTRIBUTION.protein;
    const fatCalories = targetCalories * MACRO_DISTRIBUTION.fat;
    const carbCalories = targetCalories * MACRO_DISTRIBUTION.carbs;

    const proteinGrams = proteinCalories / CALORIES_PER_GRAM.protein;
    const fatGrams = fatCalories / CALORIES_PER_GRAM.fat;
    const carbGrams = carbCalories / CALORIES_PER_GRAM.carbs;

    // Round to 2 decimal places
    const roundTo2 = (n: number) => Math.round(n * 100) / 100;

    return {
        calories: targetCalories,
        protein: roundTo2(proteinGrams),
        fat: roundTo2(fatGrams),
        carbohydrates: roundTo2(carbGrams),
    };
}

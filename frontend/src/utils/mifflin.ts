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
    sedentary: 1.2,          // low
    lightly_active: 1.375,   // moderate
    moderately_active: 1.55, // high
    very_active: 1.725,      // very_high
    extra_active: 1.725,     // same as very_active
};

/**
 * Goal type caloric adjustments
 */
const GOAL_ADJUSTMENTS: Record<string, number> = {
    weight_loss: -0.15,   // -15%
    maintenance: 0.0,     // 0%
    weight_gain: +0.15,   // +15%
};

/**
 * Caloric values per gram of macronutrients
 */
const _CALORIES_PER_GRAM = {
    protein: 4,
    fat: 9,
    carbs: 4,
};
// Export for potential future use
export { _CALORIES_PER_GRAM as CALORIES_PER_GRAM };

/**
 * Minimum daily caloric intake by gender (calorie floor)
 */
const CAL_FLOOR = {
    M: 1600, // Мужчины
    F: 1300, // Женщины
};

/**
 * Minimum fat intake for females (grams)
 */
const MIN_FAT_FEMALE = 40;

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
export function roundToNearest5(value: number): number {
    return Math.round(value / 5) * 5;
}

/**
 * Calculate BMI (Body Mass Index)
 */
function calculateBMI(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100.0;
    return weightKg / (heightM * heightM);
}

/**
 * Calculate Ideal Body Weight (IBW) at BMI 25
 */
function calculateIBW(heightCm: number): number {
    const heightM = heightCm / 100.0;
    return 25.0 * (heightM * heightM);
}

/**
 * Calculate Adjusted Body Weight (ABW) for obesity
 * ABW = IBW + 0.4 * (TBW - IBW)
 */
function calculateABW(weightKg: number, ibw: number): number {
    return ibw + 0.4 * (weightKg - ibw);
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
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
 * with goal-specific protein/fat/carb distribution and minimums
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
    const goalAdjustment = goal_type ? GOAL_ADJUSTMENTS[goal_type] : 0.0;
    let targetCalories = tdee * (1 + goalAdjustment);

    // Calculate obesity indicators for weight loss
    const bmi = calculateBMI(weight!, height!);
    const ibw = calculateIBW(height!);
    const useABW = bmi >= 30.0 || weight! > ibw * 1.2;
    const baseWeightLoss = useABW ? calculateABW(weight!, ibw) : weight!;

    let proteins: number;
    let fats: number;
    let carbs: number;

    // Goal-specific macronutrient calculations
    if (goal_type === 'weight_gain') {
        // НАБОР МАССЫ
        // Белок: 2 г/кг от текущего веса
        proteins = Math.round(weight! * 2.0);

        // Жиры: таргет 1 г/кг, кламп 0.9-1.1 г/кг и 20-35% ккал
        const fatsTarget = weight! * 1.0;
        const fatsLoGkg = weight! * 0.9;
        const fatsHiGkg = weight! * 1.1;
        const fatsLoPct = (targetCalories * 0.20) / 9.0;
        const fatsHiPct = (targetCalories * 0.35) / 9.0;
        fats = Math.round(clamp(fatsTarget, Math.max(fatsLoGkg, fatsLoPct), Math.min(fatsHiGkg, fatsHiPct)));

        // Минимум жиров для женщин
        if (gender === 'F' && fats < MIN_FAT_FEMALE) {
            fats = MIN_FAT_FEMALE;
        }

        // Углеводы: остаток, но >= 4 г/кг
        carbs = Math.round((targetCalories - proteins * 4 - fats * 9) / 4);
        const carbsMin = Math.round(weight! * 4.0);
        if (carbs < carbsMin) {
            carbs = carbsMin;
            // Пересчитываем калории, если углеводов не хватало
            targetCalories = proteins * 4 + fats * 9 + carbs * 4;
        }

    } else if (goal_type === 'weight_loss') {
        // ПОХУДЕНИЕ
        // Белок: женщины 1.5 г/кг, мужчины 2.0 г/кг (от ABW/TBW)
        const proteinPerKg = gender === 'F' ? 1.5 : 2.0;
        proteins = Math.round(baseWeightLoss * proteinPerKg);

        // Жиры: таргет 0.75 г/кг, кламп 0.6-1.0 г/кг и 20-35% ккал
        const fatsTarget = baseWeightLoss * 0.75;
        const fatsLoGkg = baseWeightLoss * 0.6;
        const fatsHiGkg = baseWeightLoss * 1.0;
        const fatsLoPct = (targetCalories * 0.20) / 9.0;
        const fatsHiPct = (targetCalories * 0.35) / 9.0;
        fats = Math.round(clamp(fatsTarget, Math.max(fatsLoGkg, fatsLoPct), Math.min(fatsHiGkg, fatsHiPct)));

        // Минимум жиров для женщин
        if (gender === 'F' && fats < MIN_FAT_FEMALE) {
            fats = MIN_FAT_FEMALE;
        }

        // Углеводы: остаток, но жёсткий минимум 120 г
        carbs = Math.round((targetCalories - proteins * 4 - fats * 9) / 4);
        const carbsMin = 120;
        if (carbs < carbsMin) {
            carbs = carbsMin;
            targetCalories = proteins * 4 + fats * 9 + carbs * 4;
        }

        // Калорийный пол: 1600 муж / 1300 жен
        const calFloor = CAL_FLOOR[gender!];
        if (targetCalories < calFloor) {
            const needCarbG = Math.ceil((calFloor - (proteins * 4 + fats * 9)) / 4);
            carbs = Math.max(carbs, needCarbG);
            targetCalories = proteins * 4 + fats * 9 + carbs * 4;
        }

    } else {
        // ПОДДЕРЖАНИЕ (maintenance) или fallback
        proteins = Math.round(weight! * 1.8);

        const fatsTarget = weight! * 0.8;
        const fatsLoPct = (targetCalories * 0.20) / 9.0;
        const fatsHiPct = (targetCalories * 0.35) / 9.0;
        fats = Math.round(clamp(fatsTarget, fatsLoPct, fatsHiPct));

        // Минимум жиров для женщин
        if (gender === 'F' && fats < MIN_FAT_FEMALE) {
            fats = MIN_FAT_FEMALE;
        }

        carbs = Math.round((targetCalories - proteins * 4 - fats * 9) / 4);
    }

    // Round to 2 decimal places
    const roundTo2 = (n: number) => Math.round(n * 100) / 100;

    return {
        calories: Math.round(targetCalories),
        protein: roundTo2(proteins),
        fat: roundTo2(fats),
        carbohydrates: roundTo2(carbs),
    };
}

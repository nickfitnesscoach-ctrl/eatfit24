/**
 * Tests for Mifflin-St Jeor calculation utilities
 */

import { calculateMifflinTargets, hasRequiredProfileData, getMissingProfileFields } from './mifflin';
import { Profile } from '../types/profile';

describe('Mifflin-St Jeor Calculations', () => {
    describe('calculateMifflinTargets', () => {
        test('should calculate correctly for a 30-year-old male with moderate activity', () => {
            const profile: Profile = {
                gender: 'M',
                birth_date: '1994-01-15', // ~30 years old
                height: 180, // cm
                weight: 80, // kg
                activity_level: 'moderately_active',
                goal_type: 'maintenance',
            };

            const result = calculateMifflinTargets(profile);

            // BMR = 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 800 + 1125 - 150 + 5 = 1780
            // TDEE = 1780 * 1.55 = 2759
            // Target = 2759 * 1.0 (maintenance) = 2759, rounded to nearest 5 = 2760
            expect(result.calories).toBe(2760);

            // Protein: (2760 * 0.30) / 4 = 828 / 4 = 207g
            expect(result.protein).toBe(207);

            // Fat: (2760 * 0.25) / 9 = 690 / 9 = 76.67g
            expect(result.fat).toBe(76.67);

            // Carbs: (2760 * 0.45) / 4 = 1242 / 4 = 310.5g
            expect(result.carbohydrates).toBe(310.5);
        });

        test('should calculate correctly for a 25-year-old female with weight loss goal', () => {
            const profile: Profile = {
                gender: 'F',
                birth_date: '1999-06-10', // ~25 years old
                height: 165, // cm
                weight: 65, // kg
                activity_level: 'lightly_active',
                goal_type: 'weight_loss',
            };

            const result = calculateMifflinTargets(profile);

            // BMR = 10 * 65 + 6.25 * 165 - 5 * 25 - 161 = 650 + 1031.25 - 125 - 161 = 1395.25
            // TDEE = 1395.25 * 1.375 = 1918.47
            // Target = 1918.47 * 0.8 (weight loss) = 1534.78, rounded to nearest 5 = 1535
            expect(result.calories).toBe(1535);

            // Verify macros are calculated correctly
            expect(result.protein).toBeCloseTo(115.13, 2);
            expect(result.fat).toBeCloseTo(42.64, 2);
            expect(result.carbohydrates).toBeCloseTo(172.69, 2);
        });

        test('should apply minimum calorie threshold for females', () => {
            const profile: Profile = {
                gender: 'F',
                birth_date: '2004-01-01', // ~20 years old
                height: 150, // cm
                weight: 45, // kg
                activity_level: 'sedentary',
                goal_type: 'weight_loss',
            };

            const result = calculateMifflinTargets(profile);

            // Result should be at least 1200 for females
            expect(result.calories).toBeGreaterThanOrEqual(1200);
        });

        test('should apply minimum calorie threshold for males', () => {
            const profile: Profile = {
                gender: 'M',
                birth_date: '2004-01-01', // ~20 years old
                height: 160, // cm
                weight: 50, // kg
                activity_level: 'sedentary',
                goal_type: 'weight_loss',
            };

            const result = calculateMifflinTargets(profile);

            // Result should be at least 1400 for males
            expect(result.calories).toBeGreaterThanOrEqual(1400);
        });

        test('should handle weight gain goal correctly', () => {
            const profile: Profile = {
                gender: 'M',
                birth_date: '1995-03-20', // ~29 years old
                height: 175, // cm
                weight: 70, // kg
                activity_level: 'very_active',
                goal_type: 'weight_gain',
            };

            const result = calculateMifflinTargets(profile);

            // BMR = 10 * 70 + 6.25 * 175 - 5 * 29 + 5 = 700 + 1093.75 - 145 + 5 = 1653.75
            // TDEE = 1653.75 * 1.725 = 2852.72
            // Target = 2852.72 * 1.15 (weight gain) = 3280.63, rounded to nearest 5 = 3280
            expect(result.calories).toBe(3280);
        });

        test('should throw error for missing gender', () => {
            const profile: Profile = {
                birth_date: '1990-01-01',
                height: 170,
                weight: 70,
                activity_level: 'moderately_active',
            };

            expect(() => calculateMifflinTargets(profile)).toThrow();
        });

        test('should throw error for missing birth_date', () => {
            const profile: Profile = {
                gender: 'M',
                height: 170,
                weight: 70,
                activity_level: 'moderately_active',
            };

            expect(() => calculateMifflinTargets(profile)).toThrow();
        });
    });

    describe('hasRequiredProfileData', () => {
        test('should return true when all required fields are present', () => {
            const profile: Profile = {
                gender: 'M',
                birth_date: '1990-01-01',
                height: 180,
                weight: 75,
                activity_level: 'moderately_active',
            };

            expect(hasRequiredProfileData(profile)).toBe(true);
        });

        test('should return false when gender is missing', () => {
            const profile: Profile = {
                birth_date: '1990-01-01',
                height: 180,
                weight: 75,
                activity_level: 'moderately_active',
            };

            expect(hasRequiredProfileData(profile)).toBe(false);
        });

        test('should return false when profile is null', () => {
            expect(hasRequiredProfileData(null)).toBe(false);
        });
    });

    describe('getMissingProfileFields', () => {
        test('should return empty array when all fields are present', () => {
            const profile: Profile = {
                gender: 'F',
                birth_date: '1995-05-15',
                height: 165,
                weight: 60,
                activity_level: 'lightly_active',
            };

            expect(getMissingProfileFields(profile)).toEqual([]);
        });

        test('should list all missing fields', () => {
            const profile: Profile = {
                gender: 'M',
            };

            const missing = getMissingProfileFields(profile);
            expect(missing).toContain('Дата рождения');
            expect(missing).toContain('Рост');
            expect(missing).toContain('Вес');
            expect(missing).toContain('Уровень активности');
        });

        test('should handle null profile', () => {
            const missing = getMissingProfileFields(null);
            expect(missing).toEqual(['Профиль не загружен']);
        });
    });
});

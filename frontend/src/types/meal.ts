export interface TotalConsumed {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
}

export interface FoodItem {
    id: number;
    name: string;
    calories: number | string;
    protein: number | string;
    fat: number | string;
    carbohydrates: number | string;
}

export interface Meal {
    id: number;
    meal_type: string;
    date: string;
    items: FoodItem[];
    food_items?: FoodItem[]; // Fallback for old format
}

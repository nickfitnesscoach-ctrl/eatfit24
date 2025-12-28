/**
 * AI Recognition API Types
 * Aligned with backend:
 * - POST /api/v1/ai/recognize/ -> 202 { task_id, meal_id: null, status: "processing" }
 * - GET  /api/v1/ai/task/<id>/ -> 200 { task_id, status, state, result? , error? }
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface RecognizeRequest {
    image: File;
    meal_type: MealType;
    date?: string; // YYYY-MM-DD
    user_comment?: string;
}

export interface ApiRecognizedItem {
    name: string;
    amount_grams: number;
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    confidence?: number | null;
}

export interface RecognitionTotals {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
}

export interface RecognizeResponse {
    task_id: string;
    meal_id: number | null;
    status: 'processing';
}

export type TaskState = 'PENDING' | 'STARTED' | 'RETRY' | 'SUCCESS' | 'FAILURE';
export type TaskStatus = 'processing' | 'success' | 'failed';

export interface TaskResult {
    meal_id: number | null;
    items: ApiRecognizedItem[];
    totals: Partial<RecognitionTotals> | {}; // backend гарантирует объект, но может быть пустой
    error?: string;
    error_message?: string;
    meta?: Record<string, any>;
    total_calories?: number; // иногда приходит
}

export interface TaskStatusResponse {
    task_id: string;
    status: TaskStatus;
    state: TaskState;
    result?: TaskResult;
    error?: string;
}

// =====================
// UI types
// =====================

export interface RecognizedItem {
    id: string;
    name: string;
    grams: number;
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    confidence?: number | null;
}

export interface AnalysisResult {
    meal_id: number | string | null;
    recognized_items: RecognizedItem[];
    total_calories: number;
    total_protein: number;
    total_fat: number;
    total_carbohydrates: number;
    photo_url?: string;
}

export interface BatchResult {
    file: File;
    status: 'success' | 'error';
    data?: AnalysisResult;
    error?: string;
}

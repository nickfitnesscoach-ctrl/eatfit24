/**
 * AI Recognition API
 * 
 * Implements endpoints from API Contract:
 * - POST /api/v1/ai/recognize/
 * - GET /api/v1/ai/task/<id>/
 */

import {
    fetchWithTimeout,
    getHeaders,
    getHeadersWithoutContentType,
    log,
    throwApiError,
} from '../../../services/api/client';
import { URLS } from '../../../services/api/urls';
import type {
    RecognizeResponse,
    TaskStatusResponse,
    AnalysisResult,
    RecognizedItem,
    MealType,
} from './ai.types';

// ============================================================
// AI Recognition
// ============================================================

/**
 * Map UI meal type to API meal type
 * UI uses lowercase (завтрак → breakfast)
 * API uses UPPERCASE (BREAKFAST, LUNCH, DINNER, SNACK)
 */
const MEAL_TYPE_MAP: Record<string, string> = {
    'завтрак': 'BREAKFAST',
    'breakfast': 'BREAKFAST',
    'обед': 'LUNCH',
    'lunch': 'LUNCH',
    'ужин': 'DINNER',
    'dinner': 'DINNER',
    'перекус': 'SNACK',
    'snack': 'SNACK',
};

/**
 * Convert UI meal type to API format
 * @param mealType - Meal type from UI (e.g., "Завтрак", "breakfast", "BREAKFAST")
 * @returns API-compatible meal type (BREAKFAST/LUNCH/DINNER/SNACK) or undefined
 */
const mapMealTypeToApi = (mealType?: string): string | undefined => {
    if (!mealType) return undefined;

    // Normalize to lowercase for lookup
    const normalized = mealType.toLowerCase().trim();

    // Return mapped value or fallback to SNACK if unknown
    return MEAL_TYPE_MAP[normalized] || 'SNACK';
};

/**
 * Recognize food from image (async mode)
 * POST /api/v1/ai/recognize/
 *
 * @param imageFile - Image file (JPEG/PNG)
 * @param userComment - Optional user comment about the food
 * @param mealType - Meal type (breakfast/lunch/dinner/snack)
 * @param date - Date string YYYY-MM-DD
 * @returns RecognizeResponse with task_id for polling
 */
export const recognizeFood = async (
    imageFile: File,
    userComment?: string,
    mealType?: MealType | string,
    date?: string
): Promise<RecognizeResponse> => {
    log(`AI recognize: ${imageFile.name}`);

    const formData = new FormData();
    formData.append('image', imageFile);

    // API uses user_comment (not description)
    if (userComment) {
        formData.append('user_comment', userComment);
    }

    // Map UI meal type to API format (UPPERCASE)
    const apiMealType = mapMealTypeToApi(mealType);
    if (apiMealType) {
        formData.append('meal_type', apiMealType);
    }

    if (date) {
        formData.append('date', date);
    }

    const response = await fetchWithTimeout(URLS.recognize, {
        method: 'POST',
        headers: getHeadersWithoutContentType(),
        body: formData,
    });

    // Log X-Request-ID for debugging
    const requestId = response.headers.get('X-Request-ID');
    if (requestId) {
        log(`X-Request-ID: ${requestId}`);
    }

    // Handle 429 (daily limit) - per contract: {detail: "Request was throttled..."}
    if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.detail || 'Дневной лимит исчерпан');
        (error as any).code = 'DAILY_LIMIT_REACHED';
        (error as any).error = 'DAILY_LIMIT_REACHED';
        throw error;
    }

    // Handle other errors
    if (!response.ok && response.status !== 202) {
        await throwApiError(response, 'Ошибка распознавания');
    }

    // 202 Accepted = async processing started
    const data = await response.json();
    log(`Async mode: task_id=${data.task_id}, meal_id=${data.meal_id}`);

    return {
        task_id: data.task_id,
        meal_id: data.meal_id,
        status: 'processing',
    };
};

// ============================================================
// Task Status (for async recognition)
// ============================================================

/**
 * Get task status
 * GET /api/v1/ai/task/<task_id>/
 */
export const getTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
    log(`Get task status: ${taskId}`);

    const response = await fetchWithTimeout(URLS.taskStatus(taskId), {
        method: 'GET',
        headers: getHeaders(),
    });

    if (!response.ok) {
        await throwApiError(response, 'Ошибка получения статуса задачи');
    }

    const data = await response.json();
    log(`Task ${taskId}: state=${data.state}, status=${data.status}`);

    return {
        task_id: data.task_id,
        status: data.status,
        state: data.state,
        result: data.result,
        error: data.error,
    };
};

// ============================================================
// Mapping Helpers
// ============================================================

/**
 * Map API result to UI display format
 * Converts API's amount_grams → UI's grams
 * Converts API's items → UI's recognized_items
 * Falls back to calculating totals from items if not provided
 */
export const mapToAnalysisResult = (
    result: TaskStatusResponse['result'],
    mealId?: number | string,
    photoUrl?: string
): AnalysisResult | null => {
    if (!result) return null;

    const recognizedItems: RecognizedItem[] = result.items.map((item, index) => ({
        id: String(index),
        name: item.name,
        grams: item.amount_grams, // API → UI mapping
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbohydrates: item.carbohydrates,
    }));

    // Check if totals are provided and non-zero
    const hasValidTotals = result.totals && (
        result.totals.calories > 0 ||
        result.totals.protein > 0 ||
        result.totals.fat > 0 ||
        result.totals.carbohydrates > 0
    );

    // Calculate totals from items as fallback
    const calculateFromItems = () => ({
        calories: recognizedItems.reduce((sum, item) => sum + (item.calories || 0), 0),
        protein: recognizedItems.reduce((sum, item) => sum + (item.protein || 0), 0),
        fat: recognizedItems.reduce((sum, item) => sum + (item.fat || 0), 0),
        carbohydrates: recognizedItems.reduce((sum, item) => sum + (item.carbohydrates || 0), 0),
    });

    const totals = hasValidTotals ? result.totals! : calculateFromItems();

    return {
        meal_id: mealId ?? result.meal_id,
        recognized_items: recognizedItems,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_fat: totals.fat,
        total_carbohydrates: totals.carbohydrates,
        photo_url: photoUrl,
    };
};

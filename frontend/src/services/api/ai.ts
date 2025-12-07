/**
 * AI Recognition API Module
 * 
 * Handles food photo recognition with sync/async modes.
 */

import {
    fetchWithTimeout,
    getHeaders,
    getHeadersWithoutContentType,
    log,
    throwApiError,
} from './client';
import { URLS } from './urls';

// ============================================================
// Types
// ============================================================

/** Распознанный продукт */
export interface RecognizedItem {
    id?: string | number;
    name: string;
    grams: number;
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    confidence?: number;
}

/** Sync response (HTTP 200) */
export interface RecognizeSyncResult {
    recognized_items: RecognizedItem[];
    total_calories: number;
    total_protein: number;
    total_fat: number;
    total_carbohydrates: number;
    meal_id: number | string;
    photo_url?: string;
    isAsync: false;
}

/** Async response (HTTP 202) */
export interface RecognizeAsyncResult {
    task_id: string;
    meal_id: string;
    status: 'processing';
    message?: string;
    isAsync: true;
}

export type RecognizeFoodResult = RecognizeSyncResult | RecognizeAsyncResult;

/** Task status states */
export type TaskState = 'PENDING' | 'STARTED' | 'RETRY' | 'SUCCESS' | 'FAILURE';

/** Task result (when SUCCESS) */
export interface TaskSuccessResult {
    success: true;
    meal_id: string | number;
    recognized_items: RecognizedItem[];
    totals: {
        calories: number;
        protein: number;
        fat: number;
        carbohydrates: number;
    };
    recognition_time?: number;
    photo_url?: string;
}

/** Task result (when success=false) */
export interface TaskFailureResult {
    success: false;
    meal_id?: string | number;
    error: string;
}

export type TaskResult = TaskSuccessResult | TaskFailureResult;

/** Task status response */
export interface TaskStatusResponse {
    task_id: string;
    state: TaskState;
    result?: TaskResult;
    error?: string;
    message?: string;
}

// Legacy type alias for backward compatibility
export type RecognizeResult = RecognizeSyncResult;

// ============================================================
// AI Recognition
// ============================================================

/**
 * Recognize food from image
 * Supports both sync (HTTP 200) and async (HTTP 202) backend modes
 */
export const recognizeFood = async (
    imageFile: File,
    description?: string,
    mealType?: string,
    date?: string
): Promise<RecognizeFoodResult> => {
    log(`Calling AI recognize: ${imageFile.name}`);

    const formData = new FormData();
    formData.append('image', imageFile);
    if (description) formData.append('description', description);
    if (mealType) formData.append('meal_type', mealType);
    if (date) formData.append('date', date);

    const response = await fetchWithTimeout(URLS.recognize, {
        method: 'POST',
        headers: getHeadersWithoutContentType(),
        body: formData,
    });

    // Async mode (HTTP 202 Accepted)
    if (response.status === 202) {
        const data = await response.json();
        log(`Async mode: task_id=${data.task_id}, meal_id=${data.meal_id}`);
        return {
            task_id: data.task_id,
            meal_id: data.meal_id,
            status: 'processing',
            message: data.message,
            isAsync: true,
        };
    }

    // Error
    if (!response.ok) {
        await throwApiError(response, 'Ошибка распознавания');
    }

    // Sync mode (HTTP 200)
    const data = await response.json();
    log(`Sync mode: ${data.recognized_items?.length || 0} items`);

    return {
        recognized_items: data.recognized_items || [],
        total_calories: data.total_calories || 0,
        total_protein: data.total_protein || 0,
        total_fat: data.total_fat || 0,
        total_carbohydrates: data.total_carbohydrates || 0,
        meal_id: data.meal_id,
        photo_url: data.photo_url,
        isAsync: false,
    };
};

// ============================================================
// Task Status (for async recognition)
// ============================================================

export const getTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
    log(`Getting task status: ${taskId}`);

    const response = await fetchWithTimeout(URLS.taskStatus(taskId), {
        method: 'GET',
        headers: getHeaders(),
    });

    if (!response.ok) {
        await throwApiError(response, 'Ошибка получения статуса задачи');
    }

    const data = await response.json();
    log(`Task ${taskId}: state=${data.state}`);

    return {
        task_id: data.task_id,
        state: data.state,
        result: data.result,
        error: data.error,
        message: data.message,
    };
};

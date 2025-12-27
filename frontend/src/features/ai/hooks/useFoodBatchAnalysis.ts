/**
 * Hook for managing batch food photo analysis with per-photo status tracking
 * 
 * Features:
 * - Sequential processing (1-at-a-time)
 * - Per-photo status updates (6 states)
 * - 2-phase polling (fast first 15s, then slow)
 * - Retry for individual failed photos (works during active batch)
 * - Own URL management (creates and revokes preview URLs)
 * 
 * Aligned with API Contract:
 * - Uses user_comment (not description)
 * - Uses lowercase meal_type
 * - Maps items/amount_grams from API response
 */

import { useState, useRef, useCallback } from 'react';
import { recognizeFood, getTaskStatus, mapToAnalysisResult } from '../api';
import type { AnalysisResult, TaskStatusResponse } from '../api';
import type { FileWithComment, BatchAnalysisOptions, PhotoQueueItem, PhotoUploadStatus } from '../model';
import { POLLING_CONFIG, AI_ERROR_CODES, getAiErrorMessage } from '../model';
import { preprocessImage, PreprocessError } from '../lib';
import { api } from '../../../services/api';

// ============================================================
// Hook Interface
// ============================================================

interface UseFoodBatchAnalysisResult {
    /** Whether any photo is currently being processed */
    isProcessing: boolean;
    /** Queue of all photos with their individual statuses */
    photoQueue: PhotoQueueItem[];
    /** Start processing a batch of files */
    startBatch: (files: FileWithComment[]) => Promise<void>;
    /** Retry a single failed photo by its ID */
    retryPhoto: (id: string) => void;
    /** Cancel all processing */
    cancelBatch: () => void;
    /** Cleanup preview URLs (call on unmount or after closing results) */
    cleanup: () => void;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate stable unique ID for a photo
 */
let idCounter = 0;
const generatePhotoId = (file: File, index: number): string => {
    idCounter++;
    return `${file.name}-${file.size}-${index}-${idCounter}`;
};

/**
 * Get polling delay based on elapsed time (2-phase strategy)
 * Phase 1: 1s for first 15 seconds
 * Phase 2: 3s after 15 seconds (with backoff)
 */
const getPollingDelay = (elapsedMs: number, attempt: number): number => {
    if (elapsedMs < POLLING_CONFIG.FAST_PHASE_DURATION_MS) {
        return POLLING_CONFIG.FAST_PHASE_DELAY_MS;
    }

    // Slow phase with backoff
    const slowAttempt = attempt - Math.floor(POLLING_CONFIG.FAST_PHASE_DURATION_MS / POLLING_CONFIG.FAST_PHASE_DELAY_MS);
    const delay = POLLING_CONFIG.SLOW_PHASE_DELAY_MS * Math.pow(POLLING_CONFIG.BACKOFF_MULTIPLIER, Math.max(0, slowAttempt));
    return Math.min(delay, POLLING_CONFIG.SLOW_PHASE_MAX_DELAY_MS);
};

// ============================================================
// Main Hook
// ============================================================

/**
 * Hook for managing batch food photo analysis with per-photo status
 */
export const useFoodBatchAnalysis = (
    options: BatchAnalysisOptions
): UseFoodBatchAnalysisResult => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [photoQueue, setPhotoQueue] = useState<PhotoQueueItem[]>([]);

    // Refs for managing async state
    const abortControllerRef = useRef<AbortController | null>(null);
    const isCancelledRef = useRef(false);
    // Ref to get current queue in async functions (updated synchronously)
    const queueRef = useRef<PhotoQueueItem[]>([]);
    // Track URLs created by this hook for proper cleanup
    const ownedUrlsRef = useRef<Set<string>>(new Set());

    /**
     * Helper to update photoQueue and queueRef synchronously
     */
    const setPhotoQueueSync = useCallback((updater: (prev: PhotoQueueItem[]) => PhotoQueueItem[]) => {
        setPhotoQueue(prev => {
            const next = updater(prev);
            queueRef.current = next;
            return next;
        });
    }, []);

    /**
     * Update a single photo's status in the queue
     */
    const updatePhotoStatus = useCallback((
        id: string,
        updates: Partial<PhotoQueueItem>
    ) => {
        // Don't update if cancelled (prevents ghost updates after cancel)
        if (isCancelledRef.current) return;

        setPhotoQueueSync(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }, [setPhotoQueueSync]);

    /**
     * Poll task status until completion or timeout
     */
    const pollTaskStatus = async (
        taskId: string,
        mealId: number,
        abortController: AbortController
    ): Promise<AnalysisResult | null> => {
        const startTime = Date.now();
        let attempt = 0;

        while (!abortController.signal.aborted && !isCancelledRef.current) {
            const elapsed = Date.now() - startTime;

            if (elapsed >= POLLING_CONFIG.CLIENT_TIMEOUT_MS) {
                const timeoutError = new Error('Превышено время ожидания распознавания');
                (timeoutError as any).errorType = AI_ERROR_CODES.TASK_TIMEOUT;
                throw timeoutError;
            }

            const delay = getPollingDelay(elapsed, attempt);

            try {
                const taskStatus: TaskStatusResponse = await getTaskStatus(taskId);
                console.log(`[Polling] Task ${taskId}: state=${taskStatus.state}, status=${taskStatus.status}, elapsed=${elapsed}ms`);

                // SUCCESS
                if (taskStatus.state === 'SUCCESS' && taskStatus.status === 'success') {
                    let analysisResult = mapToAnalysisResult(taskStatus.result, mealId);

                    // Fallback: if empty items but meal_id exists, try fetching from meal API
                    if ((!analysisResult || analysisResult.recognized_items.length === 0) && mealId) {
                        console.log(`[Polling] Empty items but meal_id=${mealId}, trying fallback...`);

                        for (let fAttempt = 1; fAttempt <= 3; fAttempt++) {
                            const delayMs = fAttempt * 1000;
                            await new Promise(resolve => setTimeout(resolve, delayMs));

                            try {
                                const mealData = await api.getMealAnalysis(mealId);
                                if (mealData.recognized_items && mealData.recognized_items.length > 0) {
                                    console.log(`[Polling] Fallback SUCCESS: found ${mealData.recognized_items.length} items`);

                                    analysisResult = {
                                        meal_id: mealId,
                                        recognized_items: mealData.recognized_items.map(item => ({
                                            id: String(item.id),
                                            name: item.name,
                                            grams: item.grams,
                                            calories: item.calories,
                                            protein: item.protein,
                                            fat: item.fat,
                                            carbohydrates: item.carbohydrates,
                                        })),
                                        total_calories: mealData.recognized_items.reduce((sum, i) => sum + (i.calories || 0), 0),
                                        total_protein: mealData.recognized_items.reduce((sum, i) => sum + (i.protein || 0), 0),
                                        total_fat: mealData.recognized_items.reduce((sum, i) => sum + (i.fat || 0), 0),
                                        total_carbohydrates: mealData.recognized_items.reduce((sum, i) => sum + (i.carbohydrates || 0), 0),
                                    };
                                    break;
                                }
                            } catch (fallbackErr) {
                                console.warn(`[Polling] Fallback attempt ${fAttempt} failed:`, fallbackErr);
                                const errMsg = (fallbackErr as Error)?.message || '';
                                if (errMsg.includes('404')) break;
                            }
                        }
                    }

                    // If still empty but has meal_id, return with neutral message
                    if ((!analysisResult || analysisResult.recognized_items.length === 0) && mealId) {
                        return {
                            meal_id: mealId,
                            recognized_items: [],
                            total_calories: 0,
                            total_protein: 0,
                            total_fat: 0,
                            total_carbohydrates: 0,
                            _neutralMessage: 'Анализ завершён, проверьте дневник',
                        };
                    }

                    // No meal_id and no items = failure
                    if (!analysisResult || analysisResult.recognized_items.length === 0) {
                        const emptyError = new Error('Ошибка обработки');
                        (emptyError as any).errorType = AI_ERROR_CODES.EMPTY_RESULT;
                        throw emptyError;
                    }

                    return analysisResult;
                }

                // FAILURE
                if (taskStatus.state === 'FAILURE' || taskStatus.status === 'failed') {
                    const failError = new Error(taskStatus.error || 'Ошибка обработки фото');
                    (failError as any).errorType = AI_ERROR_CODES.TASK_FAILURE;
                    throw failError;
                }

                // Still processing - wait and retry
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;

            } catch (err: any) {
                if (abortController.signal.aborted || isCancelledRef.current) return null;

                // Rethrow known error types
                if (err.errorType) throw err;

                // Network error - retry a few times
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    attempt++;
                    continue;
                }

                const networkError = new Error('Ошибка сети при получении результата');
                (networkError as any).errorType = AI_ERROR_CODES.NETWORK_ERROR;
                throw networkError;
            }
        }

        return null; // Aborted
    };

    /**
     * Process a single photo through the full pipeline
     */
    const processPhoto = async (
        item: PhotoQueueItem,
        abortController: AbortController
    ): Promise<void> => {
        const { id, file, comment } = item;

        if (isCancelledRef.current) return;

        try {
            // Stage 1: Compressing
            updatePhotoStatus(id, { status: 'compressing' });

            const { file: processedFile, metrics } = await preprocessImage(file);
            console.log('[Preprocess]', {
                original_size: metrics.originalSize,
                output_size: metrics.outputSize,
                original_px: `${metrics.originalPx.width}x${metrics.originalPx.height}`,
                output_px: `${metrics.outputPx.width}x${metrics.outputPx.height}`,
                processing_ms: metrics.processingMs,
            });

            if (abortController.signal.aborted || isCancelledRef.current) return;

            // Stage 2: Uploading
            updatePhotoStatus(id, { status: 'uploading' });

            const dateStr = options.getDateString();
            const mealTypeValue = options.getMealType().toLowerCase();

            const recognizeResponse = await recognizeFood(
                processedFile,
                comment,
                mealTypeValue,
                dateStr
            );

            if (abortController.signal.aborted || isCancelledRef.current) return;

            // Stage 3: Processing (polling)
            updatePhotoStatus(id, {
                status: 'processing',
                taskId: recognizeResponse.task_id,
                mealId: recognizeResponse.meal_id,
            });

            const result = await pollTaskStatus(
                recognizeResponse.task_id,
                recognizeResponse.meal_id,
                abortController
            );

            if (!result || isCancelledRef.current) {
                // Cancelled
                return;
            }

            // Stage 4: Success
            if (result.meal_id || (result.recognized_items && result.recognized_items.length > 0)) {
                updatePhotoStatus(id, {
                    status: 'success',
                    result,
                });
            } else {
                updatePhotoStatus(id, {
                    status: 'error',
                    error: 'Ошибка обработки. Попробуйте ещё раз.',
                });
            }

        } catch (err: any) {
            if (isCancelledRef.current) return;

            console.error(`[Queue] Error processing photo ${id}:`, err);

            // Check for daily limit
            if (err.code === AI_ERROR_CODES.DAILY_LIMIT_REACHED ||
                err.error === AI_ERROR_CODES.DAILY_LIMIT_REACHED) {
                options.onDailyLimitReached?.();
                updatePhotoStatus(id, {
                    status: 'error',
                    error: getAiErrorMessage(AI_ERROR_CODES.DAILY_LIMIT_REACHED),
                });
                // Don't continue processing other photos
                abortController.abort();
                return;
            }

            // Handle preprocess errors
            if (err instanceof PreprocessError) {
                updatePhotoStatus(id, {
                    status: 'error',
                    error: getAiErrorMessage(err.code),
                });
                return;
            }

            // General error
            const errorMessage = getAiErrorMessage(err.errorType || err.error || err.message);
            updatePhotoStatus(id, {
                status: 'error',
                error: errorMessage,
            });
        }
    };

    /**
     * Get next pending photo from current queue state
     */
    const getNextPendingPhoto = (): PhotoQueueItem | null => {
        return queueRef.current.find(p => p.status === 'pending') || null;
    };

    /**
     * Process queue dynamically - picks up pending items including retries
     */
    const processQueue = async (abortController: AbortController): Promise<void> => {
        while (!abortController.signal.aborted && !isCancelledRef.current) {
            const nextPhoto = getNextPendingPhoto();
            if (!nextPhoto) {
                // No more pending photos
                break;
            }

            await processPhoto(nextPhoto, abortController);
        }
    };

    /**
     * Start processing a batch of files (sequential, 1-at-a-time)
     */
    const startBatch = async (filesWithComments: FileWithComment[]): Promise<void> => {
        if (isProcessing) {
            console.warn('[Queue] Already processing, ignoring startBatch');
            return;
        }

        // Cleanup previous batch URLs before starting new one
        ownedUrlsRef.current.forEach(url => {
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        });
        ownedUrlsRef.current.clear();

        isCancelledRef.current = false;
        setIsProcessing(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Initialize queue with all photos as pending
        // Hook creates its own URLs for full ownership (avoid race with FoodLogPage cleanup)
        const initialQueue: PhotoQueueItem[] = filesWithComments.map((item, index) => {
            // Create a new URL that this hook owns
            const ownedUrl = URL.createObjectURL(item.file);
            ownedUrlsRef.current.add(ownedUrl);

            return {
                id: generatePhotoId(item.file, index),
                file: item.file,
                comment: item.comment,
                previewUrl: ownedUrl,
                status: 'pending' as PhotoUploadStatus,
            };
        });

        setPhotoQueueSync(() => initialQueue);

        try {
            // Process queue dynamically (picks up pending items including retries)
            await processQueue(abortController);
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    /**
     * Retry a single failed photo
     * This marks the photo as pending - the queue processor will pick it up
     */
    const retryPhoto = useCallback((id: string): void => {
        const photo = queueRef.current.find(p => p.id === id);
        if (!photo || photo.status !== 'error') {
            console.warn(`[Queue] Cannot retry photo ${id}: not found or not in error state`);
            return;
        }

        // Mark as pending - queue processor will pick it up (sync update)
        setPhotoQueueSync(prev => prev.map(item =>
            item.id === id
                ? { ...item, status: 'pending' as PhotoUploadStatus, error: undefined, result: undefined, taskId: undefined, mealId: undefined }
                : item
        ));

        // If not currently processing, start the queue again
        if (!isProcessing && abortControllerRef.current === null) {
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            isCancelledRef.current = false;
            setIsProcessing(true);

            processQueue(abortController).finally(() => {
                setIsProcessing(false);
                abortControllerRef.current = null;
            });
        }
    }, [isProcessing, setPhotoQueueSync]);

    /**
     * Cancel all processing and cleanup URLs
     */
    const cancelBatch = useCallback((): void => {
        isCancelledRef.current = true;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        // Cleanup URLs on cancel
        ownedUrlsRef.current.forEach(url => {
            try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        });
        ownedUrlsRef.current.clear();
        setPhotoQueue([]);
        queueRef.current = [];
        setIsProcessing(false);
    }, []);

    /**
     * Cleanup preview URLs to prevent memory leaks
     * Call this when closing results or on unmount
     */
    const cleanup = useCallback((): void => {
        // Revoke all URLs that this hook created
        ownedUrlsRef.current.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // Ignore errors from already-revoked URLs
            }
        });
        ownedUrlsRef.current.clear();
        setPhotoQueue([]);
    }, []);

    return {
        isProcessing,
        photoQueue,
        startBatch,
        retryPhoto,
        cancelBatch,
        cleanup,
    };
};

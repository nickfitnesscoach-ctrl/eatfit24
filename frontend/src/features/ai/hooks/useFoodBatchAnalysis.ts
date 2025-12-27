/**
 * Hook for managing batch food photo analysis with per-photo status tracking
 *
 * Features:
 * - Sequential processing (1-at-a-time)
 * - Per-photo status updates
 * - 2-phase polling (fast first 15s, then slow with backoff)
 * - Retry for individual failed photos (works during active batch)
 * - Proper cancellation (AbortController passed everywhere + abortable sleeps)
 * - Own URL management (creates and revokes preview URLs)
 *
 * Notes:
 * - Hook "owns" previewUrl for items passed into startBatch from that moment.
 *   Parent MUST NOT revoke previewUrl after calling startBatch.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { recognizeFood, getTaskStatus, mapToAnalysisResult } from '../api';
import type { AnalysisResult, TaskStatusResponse } from '../api';
import type {
    FileWithComment,
    BatchAnalysisOptions,
    PhotoQueueItem,
    PhotoUploadStatus,
} from '../model';
import { POLLING_CONFIG, AI_ERROR_CODES, getAiErrorMessage } from '../model';
import { preprocessImage, PreprocessError } from '../lib';
import { api } from '../../../services/api';

// ============================================================
// Hook Interface
// ============================================================

interface UseFoodBatchAnalysisResult {
    isProcessing: boolean;
    photoQueue: PhotoQueueItem[];
    startBatch: (files: FileWithComment[]) => Promise<void>;
    retryPhoto: (id: string) => void;
    cancelBatch: () => void;
    cleanup: () => void;
}

// ============================================================
// Helpers
// ============================================================

let idCounter = 0;
const generatePhotoId = (file: File, index: number): string => {
    idCounter += 1;
    return `${file.name}-${file.size}-${index}-${idCounter}`;
};

const getPollingDelay = (elapsedMs: number, attempt: number): number => {
    if (elapsedMs < POLLING_CONFIG.FAST_PHASE_DURATION_MS) {
        return POLLING_CONFIG.FAST_PHASE_DELAY_MS;
    }
    const fastAttempts = Math.floor(
        POLLING_CONFIG.FAST_PHASE_DURATION_MS / POLLING_CONFIG.FAST_PHASE_DELAY_MS
    );
    const slowAttempt = Math.max(0, attempt - fastAttempts);
    const delay =
        POLLING_CONFIG.SLOW_PHASE_DELAY_MS *
        Math.pow(POLLING_CONFIG.BACKOFF_MULTIPLIER, slowAttempt);
    return Math.min(delay, POLLING_CONFIG.SLOW_PHASE_MAX_DELAY_MS);
};

const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> =>
    new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();

        const onAbort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            resolve();
        };

        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        signal.addEventListener('abort', onAbort, { once: true });
    });

const isAbortError = (err: any) =>
    err?.name === 'AbortError' || err?.code === 'ERR_CANCELED';

// ============================================================
// Main Hook
// ============================================================

export const useFoodBatchAnalysis = (
    options: BatchAnalysisOptions
): UseFoodBatchAnalysisResult => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [photoQueue, setPhotoQueue] = useState<PhotoQueueItem[]>([]);

    // lifecycle + run guards
    const isMountedRef = useRef(true);
    const isCancelledRef = useRef(false);
    const processingRef = useRef(false);
    const runIdRef = useRef(0);

    // current queue snapshot (source of truth for async loops)
    const queueRef = useRef<PhotoQueueItem[]>([]);

    // abort + owned URLs
    const abortControllerRef = useRef<AbortController | null>(null);
    const ownedUrlsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const setStateSafe = useCallback((fn: () => void) => {
        if (!isMountedRef.current) return;
        fn();
    }, []);

    /**
     * Single "state setter" that keeps queueRef and state in sync.
     * Never uses React state closure in async flows.
     */
    const setPhotoQueueSync = useCallback(
        (updater: (prev: PhotoQueueItem[]) => PhotoQueueItem[]) => {
            const next = updater(queueRef.current);
            queueRef.current = next;
            if (isMountedRef.current) setPhotoQueue(next);
        },
        []
    );

    const updatePhoto = useCallback(
        (id: string, patch: Partial<PhotoQueueItem>) => {
            if (isCancelledRef.current) return;
            setPhotoQueueSync((prev) =>
                prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
            );
        },
        [setPhotoQueueSync]
    );

    const resetOwnedUrls = useCallback(() => {
        ownedUrlsRef.current.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                /* ignore */
            }
        });
        ownedUrlsRef.current.clear();
    }, []);

    const pollTaskStatus = useCallback(
        async (
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
                    const taskStatus: TaskStatusResponse = await getTaskStatus(
                        taskId,
                        abortController.signal
                    );

                    // SUCCESS
                    if (taskStatus.state === 'SUCCESS' && taskStatus.status === 'success') {
                        let analysisResult = mapToAnalysisResult(taskStatus.result, mealId);

                        // Fallback: if empty items but meal_id exists, try fetching from meal API
                        if (
                            (!analysisResult || analysisResult.recognized_items.length === 0) &&
                            mealId
                        ) {
                            for (let fAttempt = 1; fAttempt <= 3; fAttempt++) {
                                await abortableSleep(fAttempt * 1000, abortController.signal);
                                if (abortController.signal.aborted || isCancelledRef.current)
                                    return null;

                                try {
                                    const mealData = await api.getMealAnalysis(
                                        mealId,
                                        abortController.signal
                                    );

                                    if (
                                        mealData?.recognized_items &&
                                        mealData.recognized_items.length > 0
                                    ) {
                                        analysisResult = {
                                            meal_id: mealId,
                                            recognized_items: mealData.recognized_items.map((item) => ({
                                                id: String(item.id),
                                                name: item.name,
                                                grams: item.grams,
                                                calories: item.calories,
                                                protein: item.protein,
                                                fat: item.fat,
                                                carbohydrates: item.carbohydrates,
                                            })),
                                            total_calories: mealData.recognized_items.reduce(
                                                (sum, i) => sum + (i.calories || 0),
                                                0
                                            ),
                                            total_protein: mealData.recognized_items.reduce(
                                                (sum, i) => sum + (i.protein || 0),
                                                0
                                            ),
                                            total_fat: mealData.recognized_items.reduce(
                                                (sum, i) => sum + (i.fat || 0),
                                                0
                                            ),
                                            total_carbohydrates: mealData.recognized_items.reduce(
                                                (sum, i) => sum + (i.carbohydrates || 0),
                                                0
                                            ),
                                        };
                                        break;
                                    }
                                } catch (fallbackErr: any) {
                                    const msg = fallbackErr?.message || '';
                                    if (msg.includes('404')) break;
                                }
                            }
                        }

                        // If still empty but has meal_id, return neutral (UX-friendly)
                        if (
                            (!analysisResult || analysisResult.recognized_items.length === 0) &&
                            mealId
                        ) {
                            return {
                                meal_id: mealId,
                                recognized_items: [],
                                total_calories: 0,
                                total_protein: 0,
                                total_fat: 0,
                                total_carbohydrates: 0,
                                _neutralMessage: 'Анализ завершён, проверьте дневник',
                            } as any;
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

                    // Still processing
                    await abortableSleep(delay, abortController.signal);
                    attempt += 1;
                } catch (err: any) {
                    if (abortController.signal.aborted || isCancelledRef.current) return null;
                    if (isAbortError(err)) return null;

                    // Rethrow known typed errors
                    if (err?.errorType) throw err;

                    // Network-ish retry a few times
                    if (attempt < 3) {
                        await abortableSleep(delay, abortController.signal);
                        attempt += 1;
                        continue;
                    }

                    const networkError = new Error('Ошибка сети при получении результата');
                    (networkError as any).errorType = AI_ERROR_CODES.NETWORK_ERROR;
                    throw networkError;
                }
            }

            return null;
        },
        [/* stable */]
    );

    const processPhoto = useCallback(
        async (item: PhotoQueueItem, abortController: AbortController): Promise<void> => {
            const { id, file, comment } = item;
            if (isCancelledRef.current) return;

            try {
                // Stage 1: Compressing
                updatePhoto(id, { status: 'compressing' });

                const { file: processedFile } = await preprocessImage(file);
                if (abortController.signal.aborted || isCancelledRef.current) return;

                // Stage 2: Uploading
                updatePhoto(id, { status: 'uploading' });

                const dateStr = options.getDateString();
                const mealTypeValue = options.getMealType().toLowerCase();

                const recognizeResponse = await recognizeFood(
                    processedFile,
                    comment,
                    mealTypeValue,
                    dateStr,
                    abortController.signal
                );

                if (abortController.signal.aborted || isCancelledRef.current) return;

                // Stage 3: Processing
                updatePhoto(id, {
                    status: 'processing',
                    taskId: recognizeResponse.task_id,
                    mealId: recognizeResponse.meal_id,
                });

                const result = await pollTaskStatus(
                    recognizeResponse.task_id,
                    recognizeResponse.meal_id,
                    abortController
                );

                if (!result || isCancelledRef.current) return;

                // Stage 4: Success / Error
                if (result.meal_id || (result.recognized_items?.length ?? 0) > 0) {
                    updatePhoto(id, { status: 'success', result });
                } else {
                    updatePhoto(id, {
                        status: 'error',
                        error: 'Ошибка обработки. Попробуйте ещё раз.',
                    });
                }
            } catch (err: any) {
                if (isCancelledRef.current || abortController.signal.aborted) return;
                if (isAbortError(err)) return;

                // Daily limit
                if (
                    err?.code === AI_ERROR_CODES.DAILY_LIMIT_REACHED ||
                    err?.error === AI_ERROR_CODES.DAILY_LIMIT_REACHED
                ) {
                    options.onDailyLimitReached?.();
                    updatePhoto(id, {
                        status: 'error',
                        error: getAiErrorMessage(AI_ERROR_CODES.DAILY_LIMIT_REACHED),
                    });
                    abortController.abort();
                    return;
                }

                // Preprocess errors
                if (err instanceof PreprocessError) {
                    updatePhoto(id, { status: 'error', error: getAiErrorMessage(err.code) });
                    return;
                }

                // General
                const msg = getAiErrorMessage(err?.errorType || err?.error || err?.message);
                updatePhoto(id, { status: 'error', error: msg });
            }
        },
        [options, pollTaskStatus, updatePhoto]
    );

    const getNextPendingPhoto = useCallback((): PhotoQueueItem | null => {
        return queueRef.current.find((p) => p.status === 'pending') || null;
    }, []);

    const processQueue = useCallback(
        async (abortController: AbortController): Promise<void> => {
            while (!abortController.signal.aborted && !isCancelledRef.current) {
                const next = getNextPendingPhoto();
                if (!next) break;
                await processPhoto(next, abortController);
            }
        },
        [getNextPendingPhoto, processPhoto]
    );

    const finalizeRun = useCallback(
        (runId: number) => {
            if (runIdRef.current !== runId) return;
            processingRef.current = false;
            abortControllerRef.current = null;
            setStateSafe(() => setIsProcessing(false));
        },
        [setStateSafe]
    );

    const startBatch = useCallback(
        async (filesWithComments: FileWithComment[]): Promise<void> => {
            if (processingRef.current) {
                console.warn('[Queue] Already processing, ignoring startBatch');
                return;
            }

            // New run
            resetOwnedUrls();
            isCancelledRef.current = false;

            runIdRef.current += 1;
            const runId = runIdRef.current;

            processingRef.current = true;
            setStateSafe(() => setIsProcessing(true));

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            const initialQueue: PhotoQueueItem[] = filesWithComments.map((item, index) => {
                const previewUrl = item.previewUrl || URL.createObjectURL(item.file);
                ownedUrlsRef.current.add(previewUrl);

                return {
                    id: generatePhotoId(item.file, index),
                    file: item.file,
                    comment: item.comment,
                    previewUrl,
                    status: 'pending' as PhotoUploadStatus,
                };
            });

            setPhotoQueueSync(() => initialQueue);

            try {
                await processQueue(abortController);
            } finally {
                finalizeRun(runId);
            }
        },
        [finalizeRun, processQueue, resetOwnedUrls, setPhotoQueueSync, setStateSafe]
    );

    const retryPhoto = useCallback(
        (id: string): void => {
            const photo = queueRef.current.find((p) => p.id === id);
            if (!photo || photo.status !== 'error') return;
            if (photo.error === 'Отменено') return;

            setPhotoQueueSync((prev) =>
                prev.map((p) =>
                    p.id === id
                        ? {
                            ...p,
                            status: 'pending' as PhotoUploadStatus,
                            error: undefined,
                            result: undefined,
                            taskId: undefined,
                            mealId: undefined,
                        }
                        : p
                )
            );

            // If nothing is running, spin up a new run over existing queue
            if (!processingRef.current && abortControllerRef.current === null) {
                isCancelledRef.current = false;

                runIdRef.current += 1;
                const runId = runIdRef.current;

                processingRef.current = true;
                setStateSafe(() => setIsProcessing(true));

                const abortController = new AbortController();
                abortControllerRef.current = abortController;

                processQueue(abortController).finally(() => finalizeRun(runId));
            }
        },
        [finalizeRun, processQueue, setPhotoQueueSync, setStateSafe]
    );

    const cancelBatch = useCallback((): void => {
        isCancelledRef.current = true;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            // keep it non-null until finalizeRun? we can null it now safely
            abortControllerRef.current = null;
        }

        // Mark in-flight items as cancelled (no retry)
        setPhotoQueueSync((prev) =>
            prev.map((p) => {
                if (p.status === 'success' || p.status === 'error') return p;
                return { ...p, status: 'error' as const, error: 'Отменено' };
            })
        );

        processingRef.current = false;
        setStateSafe(() => setIsProcessing(false));
    }, [setPhotoQueueSync, setStateSafe]);

    const cleanup = useCallback((): void => {
        // hard stop
        isCancelledRef.current = true;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        resetOwnedUrls();

        processingRef.current = false;
        setStateSafe(() => setIsProcessing(false));
        setPhotoQueueSync(() => []);
    }, [resetOwnedUrls, setPhotoQueueSync, setStateSafe]);

    return {
        isProcessing,
        photoQueue,
        startBatch,
        retryPhoto,
        cancelBatch,
        cleanup,
    };
};

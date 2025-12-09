import { useState, useRef } from 'react';
import { api } from '../services/api';
import { BatchResult, AnalysisResult } from '../components/BatchResultsModal';
import { FileWithComment } from '../types/food';
import { POLLING, getErrorMessage, API_ERROR_CODES } from '../constants';
import { convertHeicToJpeg } from '../utils/imageUtils';

// Polling constants
const POLLING_MAX_DURATION = POLLING.MAX_DURATION_MS;
const POLLING_INITIAL_DELAY = POLLING.INITIAL_DELAY_MS;
const POLLING_MAX_DELAY = POLLING.MAX_DELAY_MS;
const POLLING_BACKOFF_MULTIPLIER = POLLING.BACKOFF_MULTIPLIER;

interface UseFoodBatchAnalysisOptions {
  onDailyLimitReached?: () => void;     // чтобы страница могла показать модалку
  getDateString: () => string;          // selectedDate → 'YYYY-MM-DD'
  getMealType: () => string;            // текущий mealType
}

interface UseFoodBatchAnalysisResult {
  isProcessing: boolean;
  progress: { current: number; total: number };
  results: BatchResult[];
  error: string | null;
  startBatch: (files: FileWithComment[]) => Promise<void>;
  cancelBatch: () => void;
}

/**
 * Hook for managing batch food photo analysis
 * Handles file processing, polling, fallbacks, and error handling
 */
export const useFoodBatchAnalysis = (
  options: UseFoodBatchAnalysisOptions
): UseFoodBatchAnalysisResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);

  // For async polling cancellation
  const pollingAbortRef = useRef<AbortController | null>(null);

  /**
   * Poll task status until completion or timeout
   *
   * Backend returns on SUCCESS:
   * {
   *   state: "SUCCESS",
   *   result: {
   *     success: true/false,
   *     meal_id: "...",
   *     recognized_items: [...],
   *     totals: { calories, protein, fat, carbohydrates },
   *     error?: "..." (when success: false)
   *   }
   * }
   */
  const pollTaskStatus = async (taskId: string, abortController: AbortController): Promise<AnalysisResult | null> => {
    const startTime = Date.now();
    let attempt = 0;

    while (!abortController.signal.aborted) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= POLLING_MAX_DURATION) {
        const timeoutError = new Error('Превышено время ожидания распознавания');
        (timeoutError as any).errorType = 'TIMEOUT';
        throw timeoutError;
      }

      const delay = Math.min(
        POLLING_INITIAL_DELAY * Math.pow(POLLING_BACKOFF_MULTIPLIER, attempt),
        POLLING_MAX_DELAY
      );

      try {
        const taskStatus = await api.getTaskStatus(taskId);
        console.log(`[Polling] Task ${taskId} state: ${taskStatus.state}`, taskStatus);

        if (taskStatus.state === 'SUCCESS') {
          const result = taskStatus.result;

          console.log(`[Polling] SUCCESS result FULL:`, JSON.stringify(result, null, 2));

          // Type guard: check if result is a success result
          const isSuccessResult = result && 'recognized_items' in result;

          // Extract data from task result (with type narrowing)
          let recognizedItems = isSuccessResult ? (result.recognized_items || []) : [];
          const totals = isSuccessResult ? result.totals : undefined;
          const mealId = result?.meal_id;
          const resultSuccess = result?.success;

          // CASE 1: Backend says success=false explicitly
          // But if we have a meal_id, we should still try to see if anything was saved
          if (result && resultSuccess === false && !mealId) {
            console.log(`[Polling] Backend returned success=false with no meal_id, throwing error`);
            const emptyError = new Error(result.error || 'Ошибка обработки фото');
            (emptyError as any).errorType = 'AI_EMPTY_RESULT';
            throw emptyError;
          }

          // CASE 2: Empty items but we have meal_id (Universal Fallback)
          // This covers both "success=true but empty items" AND "success=false but meal_id exists"
          if (recognizedItems.length === 0 && mealId) {
            console.log(`[Polling] Empty items but meal_id=${mealId} exists. Trying fallback...`);

            // Try up to 3 times with increasing delays
            for (let fAttempt = 1; fAttempt <= 3; fAttempt++) {
              const delayMs = fAttempt * 1000;
              await new Promise(resolve => setTimeout(resolve, delayMs));

              try {
                const mealData = await api.getMealAnalysis(mealId);
                if (mealData.recognized_items && mealData.recognized_items.length > 0) {
                  console.log(`[Polling] Fallback SUCCESS on attempt ${fAttempt}: found ${mealData.recognized_items.length} items`);

                  // Map from MealAnalysis format to AnalysisResult format
                  recognizedItems = mealData.recognized_items.map(item => ({
                    id: String(item.id),
                    name: item.name,
                    grams: item.grams,
                    calories: item.calories,
                    protein: item.protein,
                    fat: item.fat,
                    carbohydrates: item.carbohydrates
                  }));
                  break; // Success - exit retry loop
                } else {
                  console.log(`[Polling] Fallback attempt ${fAttempt}: meal exists but 0 items`);
                }
              } catch (fallbackErr) {
                console.warn(`[Polling] Fallback attempt ${fAttempt} failed:`, fallbackErr);
                const errMsg = (fallbackErr as Error)?.message || '';
                if (errMsg.includes('404')) break; // Meal deleted
              }
            }
          }

          // Check again after fallback
          // UI HOTFIX: Не выбрасываем ошибку если есть mealId - бэкенд создал приём пищи
          // Пустые items при наличии mealId - это нормально, пользователь увидит meal в дневнике
          if (recognizedItems.length === 0 && !mealId) {
            // Still empty and no meal_id -> genuine failure
            const emptyError = new Error('Ошибка обработки');
            (emptyError as any).errorType = 'AI_EMPTY_RESULT';
            throw emptyError;
          }

          // Calculate totals from items if not provided
          type ItemType = typeof recognizedItems[number];
          const finalTotals = totals || {
            calories: recognizedItems.reduce((sum: number, i: ItemType) => sum + (i.calories || 0), 0),
            protein: recognizedItems.reduce((sum: number, i: ItemType) => sum + (i.protein || 0), 0),
            fat: recognizedItems.reduce((sum: number, i: ItemType) => sum + (i.fat || 0), 0),
            carbohydrates: recognizedItems.reduce((sum: number, i: ItemType) => sum + (i.carbohydrates || 0), 0)
          };

          return {
            recognized_items: recognizedItems,
            total_calories: finalTotals.calories || 0,
            total_protein: finalTotals.protein || 0,
            total_fat: finalTotals.fat || 0,
            total_carbohydrates: finalTotals.carbohydrates || 0,
            meal_id: mealId,
            photo_url: isSuccessResult ? result.photo_url : undefined
          };
        }

        if (taskStatus.state === 'FAILURE') {
          const failError = new Error(taskStatus.error || 'Ошибка обработки фото');
          (failError as any).errorType = 'CELERY_FAILURE';
          throw failError;
        }

        // Task still processing (PENDING, STARTED, RETRY) - wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;

      } catch (err: any) {
        if (abortController.signal.aborted) return null;

        // Stop if we threw a specific error
        if (err.errorType) throw err;

        // Network error - retry a few times
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        const networkError = new Error('Ошибка сети при получении результата');
        (networkError as any).errorType = 'NETWORK_ERROR';
        throw networkError;
      }
    }

    return null; // Aborted
  };

  /**
   * Start processing a batch of files
   */
  const startBatch = async (filesWithComments: FileWithComment[]): Promise<void> => {
    setIsProcessing(true);
    setProgress({ current: 0, total: filesWithComments.length });
    setResults([]);
    setError(null);
    setCancelRequested(false);

    // Create abort controller for this batch
    const abortController = new AbortController();
    pollingAbortRef.current = abortController;

    const batchResults: BatchResult[] = [];

    try {
      // Process files sequentially
      for (let i = 0; i < filesWithComments.length; i++) {
        // Check if user requested cancellation
        if (cancelRequested || abortController.signal.aborted) {
          console.log('[Batch] User cancelled processing');
          break;
        }

        const { file, comment } = filesWithComments[i];
        setProgress({ current: i + 1, total: filesWithComments.length });

        try {
          // Convert HEIC/HEIF to JPEG before upload (iOS photos)
          const processedFile = await convertHeicToJpeg(file);

          // Recognize with INDIVIDUAL comment per photo, selected meal type, and date
          const dateStr = options.getDateString();
          const mealTypeValue = options.getMealType();
          const recognizeResult = await api.recognizeFood(processedFile, comment, mealTypeValue, dateStr);

          let result: AnalysisResult;

          // Check if async mode (HTTP 202)
          if ((recognizeResult as any).isAsync && (recognizeResult as any).task_id) {
            console.log(`[Batch] Async mode detected, polling task ${(recognizeResult as any).task_id}`);
            const polledResult = await pollTaskStatus((recognizeResult as any).task_id, abortController);

            if (!polledResult) {
              // Polling was cancelled
              break;
            }
            result = polledResult;
          } else {
            // Sync mode - result already contains recognized_items
            result = recognizeResult as AnalysisResult;
          }

          // UNIVERSAL FALLBACK: If items empty but meal_id exists
          // This handles BOTH Sync mode empty results AND Async results where pollTaskStatus fallback might have failed
          // We try multiple times with increasing delays to handle DB propagation
          if ((!result.recognized_items || result.recognized_items.length === 0) && result.meal_id) {
            console.log(`[Batch] Empty items but meal_id=${result.meal_id}, trying universal fallback with retries...`);

            // Try up to 3 times with increasing delays (1s, 2s, 3s)
            for (let fallbackAttempt = 1; fallbackAttempt <= 3; fallbackAttempt++) {
              const delayMs = fallbackAttempt * 1000;
              console.log(`[Batch] Fallback attempt ${fallbackAttempt}/3, waiting ${delayMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));

              try {
                const mealData = await api.getMealAnalysis(result.meal_id);
                if (mealData.recognized_items && mealData.recognized_items.length > 0) {
                  console.log(`[Batch] Fallback attempt ${fallbackAttempt} SUCCESS: found ${mealData.recognized_items.length} items`);
                  // Map from MealAnalysis format to AnalysisResult format
                  result.recognized_items = mealData.recognized_items.map(item => ({
                    id: String(item.id),
                    name: item.name,
                    grams: item.grams,
                    calories: item.calories,
                    protein: item.protein,
                    fat: item.fat,
                    carbohydrates: item.carbohydrates
                  }));

                  // Recalculate totals
                  result.total_calories = result.recognized_items.reduce((sum: number, i) => sum + (i.calories || 0), 0);
                  result.total_protein = result.recognized_items.reduce((sum: number, i) => sum + (i.protein || 0), 0);
                  result.total_fat = result.recognized_items.reduce((sum: number, i) => sum + (i.fat || 0), 0);
                  result.total_carbohydrates = result.recognized_items.reduce((sum: number, i) => sum + (i.carbohydrates || 0), 0);

                  // Success - break out of retry loop
                  break;
                } else {
                  console.log(`[Batch] Fallback attempt ${fallbackAttempt}: meal exists but 0 items yet`);
                }
              } catch (fallbackErr) {
                const errMsg = (fallbackErr as Error)?.message || '';
                console.warn(`[Batch] Fallback attempt ${fallbackAttempt} failed:`, fallbackErr);
                // If meal not found (404), stop retrying - it was deleted
                if (errMsg.includes('404') || errMsg.includes('not found')) {
                  console.warn(`[Batch] Meal ${result.meal_id} not found (deleted by backend), stopping retries`);
                  break;
                }
              }
            }
          }

          // UI HOTFIX: Если запрос завершился без явной ошибки - считаем успехом
          // Бэкенд создаёт meal и items, поэтому показываем нейтральный статус
          // даже если recognized_items пустой (пользователь увидит приём пищи в дневнике)
          if (result.meal_id || (result.recognized_items && result.recognized_items.length > 0)) {
            batchResults.push({
              file,
              status: 'success',
              data: {
                ...result,
                // Если items пустые, но есть meal_id - ставим нейтральное сообщение
                _neutralMessage: (!result.recognized_items || result.recognized_items.length === 0)
                  ? 'Анализ завершён, проверьте дневник'
                  : undefined
              }
            });
          } else {
            // Только если нет ни meal_id, ни items - это реальная ошибка
            console.warn(`[Batch] No meal_id and no items - treating as error`);
            batchResults.push({
              file,
              status: 'error',
              error: 'Ошибка обработки. Попробуйте ещё раз.'
            });
          }
        } catch (err: any) {
          console.error(`[Batch] Error processing file ${file.name}:`, err);
          console.log(`[Batch] Error details: errorType=${err.errorType}, error=${err.error}, code=${err.code}`);

          // Check for daily limit
          if (err.error === API_ERROR_CODES.DAILY_LIMIT_REACHED || err.code === API_ERROR_CODES.DAILY_LIMIT_REACHED) {
            options.onDailyLimitReached?.();
            batchResults.push({
              file,
              status: 'error',
              error: getErrorMessage(API_ERROR_CODES.DAILY_LIMIT_REACHED)
            });
            break;
          }

          // Determine error message using centralized localization
          let errorMessage: string;

          // Custom error types from pollTaskStatus
          if (err.errorType === 'AI_EMPTY_RESULT') {
            errorMessage = getErrorMessage('No food items recognized');
          } else if (err.errorType === 'TIMEOUT') {
            errorMessage = getErrorMessage(API_ERROR_CODES.TIMEOUT);
          } else if (err.errorType === 'NETWORK_ERROR') {
            errorMessage = getErrorMessage(API_ERROR_CODES.NETWORK_ERROR);
          } else if (err.errorType === 'CELERY_FAILURE') {
            errorMessage = getErrorMessage(API_ERROR_CODES.SERVER_ERROR);
          } else if (err.error) {
            // Use error code from backend
            errorMessage = getErrorMessage(err.error, err.message);
          } else if (err.message) {
            // Try to localize error message
            errorMessage = getErrorMessage(err.message);
          } else {
            errorMessage = getErrorMessage('default');
          }

          batchResults.push({
            file,
            status: 'error',
            error: errorMessage
          });
        }
      }

      setResults(batchResults);

    } catch (err: any) {
      console.error('[Batch] Global error:', err);
      setError('Произошла ошибка при обработке фотографий.');
    } finally {
      setIsProcessing(false);
      pollingAbortRef.current = null;
    }
  };

  /**
   * Cancel the current batch processing
   */
  const cancelBatch = (): void => {
    setCancelRequested(true);
    // Abort any ongoing polling
    if (pollingAbortRef.current) {
      pollingAbortRef.current.abort();
    }
    setIsProcessing(false);
  };

  return {
    isProcessing,
    progress,
    results,
    error,
    startBatch,
    cancelBatch
  };
};

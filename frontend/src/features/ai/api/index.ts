/**
 * AI API Module Exports
 */

// API functions
export { recognizeFood, getTaskStatus, cancelAiTask, mapToAnalysisResult } from './ai.api';

// Types and helpers
export type {
    // Request
    MealType,
    RecognizeRequest,
    // Response (API format)
    ApiRecognizedItem,
    RecognitionTotals,
    RecognizeResponse,
    TaskState,
    TaskStatus,
    TaskResult,
    TaskStatusResponse,
    // UI format (mapped)
    RecognizedItem,
    AnalysisResult,
    BatchResult,
    // Normalized status
    NormalizedTaskStatus,
} from './ai.types';

export { normalizeTaskStatus } from './ai.types';

/**
 * Image Preprocessing Module
 * 
 * Компрессия и ресайз изображений перед отправкой на backend.
 * Инварианты:
 * - Output: JPEG, quality=0.85, max side=1024px
 * - Preprocess выполняется ровно один раз на каждое фото
 * - Если preprocess не удался → ошибка, не отправляем оригинал
 */

import { isHeicFile, convertHeicToJpeg } from './image';

// ============================================================
// Configuration
// ============================================================

export const PREPROCESS_CONFIG = {
    /** Target JPEG quality (0-1) */
    TARGET_QUALITY: 0.85,
    /** Maximum dimension for longest side (px) */
    MAX_SIDE_PX: 1024,
    /** Show "Сжимаем..." indicator threshold (ms) */
    SHOW_INDICATOR_MS: 800,
    /** Abort preprocessing if exceeds (ms) */
    TIMEOUT_MS: 2500,
} as const;

// ============================================================
// Error Codes
// ============================================================

export const PREPROCESS_ERROR_CODES = {
    DECODE_FAILED: 'PREPROCESS_DECODE_FAILED',
    TIMEOUT: 'PREPROCESS_TIMEOUT',
    INVALID_IMAGE: 'PREPROCESS_INVALID_IMAGE',
} as const;

export type PreprocessErrorCode = typeof PREPROCESS_ERROR_CODES[keyof typeof PREPROCESS_ERROR_CODES];

// ============================================================
// Types
// ============================================================

export interface PreprocessMetrics {
    originalSize: number;
    outputSize: number;
    originalPx: { width: number; height: number };
    outputPx: { width: number; height: number };
    processingMs: number;
}

export interface PreprocessResult {
    file: File;
    metrics: PreprocessMetrics;
}

export class PreprocessError extends Error {
    constructor(
        message: string,
        public readonly code: PreprocessErrorCode,
        public readonly originalFile?: File
    ) {
        super(message);
        this.name = 'PreprocessError';
    }
}

// ============================================================
// Implementation
// ============================================================

/**
 * Check if createImageBitmap supports imageOrientation option
 */
const supportsImageOrientation = (): boolean => {
    try {
        // Check if the option exists (won't throw in modern browsers)
        return 'createImageBitmap' in window;
    } catch {
        return false;
    }
};

/**
 * Decode image using createImageBitmap (preferred) or HTMLImageElement (fallback)
 */
const decodeImage = async (
    file: File
): Promise<{ bitmap: ImageBitmap | HTMLImageElement; width: number; height: number }> => {
    // Try createImageBitmap first (faster, handles EXIF orientation)
    if ('createImageBitmap' in window) {
        try {
            const options: ImageBitmapOptions = supportsImageOrientation()
                ? { imageOrientation: 'from-image' as const }
                : {};
            
            const bitmap = await createImageBitmap(file, options);
            return { bitmap, width: bitmap.width, height: bitmap.height };
        } catch (e) {
            console.warn('[Preprocess] createImageBitmap failed, trying fallback:', e);
        }
    }

    // Fallback: HTMLImageElement
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ bitmap: img, width: img.naturalWidth, height: img.naturalHeight });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new PreprocessError(
                'Не удалось декодировать изображение',
                PREPROCESS_ERROR_CODES.DECODE_FAILED,
                file
            ));
        };

        img.src = url;
    });
};

/**
 * Calculate new dimensions keeping aspect ratio, longest side = maxSide
 */
const calculateTargetSize = (
    width: number,
    height: number,
    maxSide: number
): { width: number; height: number } => {
    if (width <= maxSide && height <= maxSide) {
        return { width, height };
    }

    const ratio = width / height;
    
    if (width > height) {
        return { width: maxSide, height: Math.round(maxSide / ratio) };
    } else {
        return { width: Math.round(maxSide * ratio), height: maxSide };
    }
};

/**
 * Resize and export image to JPEG blob
 */
const resizeAndExport = (
    source: ImageBitmap | HTMLImageElement,
    targetWidth: number,
    targetHeight: number,
    quality: number
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
        }

        // Draw image with high quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to export canvas to blob'));
                }
            },
            'image/jpeg',
            quality
        );
    });
};

/**
 * Generate output filename (original name without extension + .jpg)
 */
const generateOutputFilename = (originalName: string): string => {
    const lastDot = originalName.lastIndexOf('.');
    const baseName = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
    return `${baseName}.jpg`;
};

/**
 * Preprocess image for upload
 * 
 * Pipeline:
 * 1. Validate MIME type
 * 2. Convert HEIC if needed
 * 3. Decode image (createImageBitmap or HTMLImage)
 * 4. Resize to max 1024px longest side
 * 5. Export as JPEG quality=0.85
 * 
 * @throws PreprocessError if processing fails or times out
 */
export const preprocessImage = async (file: File): Promise<PreprocessResult> => {
    const startTime = performance.now();
    const originalSize = file.size;

    // 1. Validate MIME type
    if (!file.type.startsWith('image/') && !isHeicFile(file)) {
        throw new PreprocessError(
            'Выбранный файл не является изображением',
            PREPROCESS_ERROR_CODES.INVALID_IMAGE,
            file
        );
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new PreprocessError(
                'Фото слишком тяжёлое. Попробуйте другое или сделайте скриншот.',
                PREPROCESS_ERROR_CODES.TIMEOUT,
                file
            ));
        }, PREPROCESS_CONFIG.TIMEOUT_MS);
    });

    // Process with timeout
    const processPromise = (async (): Promise<PreprocessResult> => {
        // 2. Convert HEIC to JPEG if needed
        let processFile = file;
        if (isHeicFile(file)) {
            console.log('[Preprocess] Converting HEIC to JPEG...');
            processFile = await convertHeicToJpeg(file);
        }

        // 3. Decode image
        const { bitmap, width: originalWidth, height: originalHeight } = await decodeImage(processFile);

        // 4. Calculate target size
        const targetSize = calculateTargetSize(
            originalWidth,
            originalHeight,
            PREPROCESS_CONFIG.MAX_SIDE_PX
        );

        // 5. Resize and export
        const blob = await resizeAndExport(
            bitmap,
            targetSize.width,
            targetSize.height,
            PREPROCESS_CONFIG.TARGET_QUALITY
        );

        // Clean up ImageBitmap if used
        if ('close' in bitmap && typeof bitmap.close === 'function') {
            bitmap.close();
        }

        // 6. Create File object
        const outputFilename = generateOutputFilename(file.name);
        const outputFile = new File([blob], outputFilename, { type: 'image/jpeg' });

        const processingMs = Math.round(performance.now() - startTime);

        const metrics: PreprocessMetrics = {
            originalSize,
            outputSize: outputFile.size,
            originalPx: { width: originalWidth, height: originalHeight },
            outputPx: { width: targetSize.width, height: targetSize.height },
            processingMs,
        };

        console.log('[Preprocess] Complete:', {
            original: `${(originalSize / 1024 / 1024).toFixed(2)}MB`,
            output: `${(outputFile.size / 1024).toFixed(0)}KB`,
            px: `${originalWidth}x${originalHeight} → ${targetSize.width}x${targetSize.height}`,
            time: `${processingMs}ms`,
        });

        return { file: outputFile, metrics };
    })();

    return Promise.race([processPromise, timeoutPromise]);
};

/**
 * Process multiple files for upload
 * Returns array of results (success or error for each file)
 */
export const preprocessFiles = async (
    files: File[],
    onProgress?: (current: number, total: number, isCompressing: boolean) => void
): Promise<Array<{ file: File; success: true; result: PreprocessResult } | { file: File; success: false; error: PreprocessError }>> => {
    const results: Array<{ file: File; success: true; result: PreprocessResult } | { file: File; success: false; error: PreprocessError }> = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onProgress?.(i + 1, files.length, true);

        try {
            const result = await preprocessImage(file);
            results.push({ file, success: true, result });
        } catch (error) {
            if (error instanceof PreprocessError) {
                results.push({ file, success: false, error });
            } else {
                results.push({
                    file,
                    success: false,
                    error: new PreprocessError(
                        'Не удалось обработать фото',
                        PREPROCESS_ERROR_CODES.DECODE_FAILED,
                        file
                    ),
                });
            }
        }
    }

    return results;
};

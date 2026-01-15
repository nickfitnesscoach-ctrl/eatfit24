/**
 * Debug Photo Controls - Browser Debug Mode UI
 *
 * Provides full photo upload/preview/analyze UX in browser debug mode (?debug=1).
 * Only renders when IS_DEBUG is true.
 *
 * Features:
 * - File picker + drag & drop
 * - Photo preview with replace/remove
 * - Analyze/Cancel/Retry buttons
 * - Status display for each stage
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Trash2, X, Play, Image as ImageIcon } from 'lucide-react';
import { IS_DEBUG } from '../../../../shared/config/debug';
import type { FileWithComment } from '../../model';
import { isHeicFile, convertHeicToJpeg } from '../../lib';

interface DebugPhotoControlsProps {
    /** Currently selected files (before batch start) */
    selectedFiles: FileWithComment[];
    /** Callback when files are selected/replaced */
    onFilesSelected: (files: File[]) => void;
    /** Callback to clear all selected files */
    onClearFiles: () => void;
    /** Callback to start analysis */
    onAnalyze: () => void;
    /** Callback to cancel processing */
    onCancel: () => void;
    /** Whether processing is currently active */
    isProcessing: boolean;
    /** Whether there are any photos in queue */
    hasActiveQueue: boolean;
    /** Whether daily limit is reached */
    isLimitReached: boolean;
}

/**
 * Debug Photo Controls Component
 *
 * Renders only in debug mode. Provides browser-native file selection
 * with drag & drop support for testing the photo flow.
 */
export const DebugPhotoControls: React.FC<DebugPhotoControlsProps> = ({
    selectedFiles,
    onFilesSelected,
    onClearFiles,
    onAnalyze,
    onCancel,
    isProcessing,
    hasActiveQueue,
    isLimitReached,
}) => {
    // Don't render in production
    if (!IS_DEBUG) return null;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Create preview URL for first selected file
    useEffect(() => {
        if (selectedFiles.length > 0 && selectedFiles[0].previewUrl) {
            setPreviewUrl(selectedFiles[0].previewUrl);
        } else if (selectedFiles.length > 0) {
            const url = URL.createObjectURL(selectedFiles[0].file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [selectedFiles]);

    const handleFileSelect = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const imageFiles = fileArray.filter(f =>
            f.type.startsWith('image/') ||
            isHeicFile(f)
        );

        if (imageFiles.length === 0) return;

        // Convert HEIC if needed
        const processedFiles = await Promise.all(
            imageFiles.map(async (file) => {
                if (isHeicFile(file)) {
                    try {
                        return await convertHeicToJpeg(file);
                    } catch {
                        return file;
                    }
                }
                return file;
            })
        );

        onFilesSelected(processedFiles);
    }, [onFilesSelected]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files);
        }
        // Reset input to allow selecting same file again
        e.target.value = '';
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    }, [handleFileSelect]);

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // Determine current state for UI
    const hasPhoto = selectedFiles.length > 0;
    const canAnalyze = hasPhoto && !isProcessing && !isLimitReached;
    const canReplace = !isProcessing;
    const canRemove = hasPhoto && !isProcessing;
    const canCancel = isProcessing || hasActiveQueue;

    return (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 space-y-4">
            {/* Debug Mode Header */}
            <div className="flex items-center gap-2 text-yellow-800">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">
                    Debug Mode — Photo Controls
                </span>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={handleInputChange}
                className="hidden"
            />

            {/* Drop Zone / Preview */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative border-2 border-dashed rounded-lg p-4 transition-all
                    ${isDragging
                        ? 'border-yellow-500 bg-yellow-100'
                        : 'border-yellow-300 bg-white/50'
                    }
                    ${!canReplace ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
                `}
                onClick={canReplace ? openFilePicker : undefined}
            >
                {previewUrl ? (
                    <div className="flex items-center gap-4">
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {selectedFiles[0]?.file.name || 'Выбранное фото'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {selectedFiles.length > 1
                                    ? `+${selectedFiles.length - 1} ещё`
                                    : `${(selectedFiles[0]?.file.size / 1024).toFixed(1)} KB`
                                }
                            </p>
                            <p className="text-xs text-green-600 font-medium mt-1">
                                ✓ Фото выбрано
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-yellow-700">
                        <Upload className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">
                            {isDragging ? 'Отпустите файл' : 'Выберите или перетащите фото'}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                            Нажмите или drag & drop
                        </p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
                {/* Replace Button */}
                <button
                    onClick={openFilePicker}
                    disabled={!canReplace}
                    className={`
                        flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors
                        ${canReplace
                            ? 'bg-white border border-yellow-300 text-yellow-800 hover:bg-yellow-50'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                    `}
                >
                    <ImageIcon size={16} />
                    {hasPhoto ? 'Заменить' : 'Выбрать'}
                </button>

                {/* Remove Button */}
                <button
                    onClick={onClearFiles}
                    disabled={!canRemove}
                    className={`
                        flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors
                        ${canRemove
                            ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                    `}
                >
                    <Trash2 size={16} />
                    Удалить
                </button>
            </div>

            {/* Main Action Button */}
            <div className="space-y-2">
                {canCancel ? (
                    <button
                        onClick={onCancel}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                        <X size={18} />
                        Отменить обработку
                    </button>
                ) : (
                    <button
                        onClick={onAnalyze}
                        disabled={!canAnalyze}
                        className={`
                            w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-colors
                            ${canAnalyze
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }
                        `}
                    >
                        <Play size={18} />
                        Анализировать
                    </button>
                )}

                {/* Status hint */}
                <p className="text-xs text-center text-yellow-700">
                    {isLimitReached
                        ? '⚠️ Лимит исчерпан'
                        : isProcessing
                            ? '🔄 Идёт обработка...'
                            : hasPhoto
                                ? '✅ Готово к анализу'
                                : '📷 Фото не выбрано'
                    }
                </p>
            </div>
        </div>
    );
};

export default DebugPhotoControls;

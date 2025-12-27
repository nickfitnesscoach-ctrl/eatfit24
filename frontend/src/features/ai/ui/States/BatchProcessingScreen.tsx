import React from 'react';
import { RefreshCw, Check, X, Loader2 } from 'lucide-react';
import type { PhotoQueueItem } from '../../model';
import { PHOTO_STATUS_LABELS } from '../../model';

interface BatchProcessingScreenProps {
    photoQueue: PhotoQueueItem[];
    onRetry: (id: string) => void;
    onCancel: () => void;
}

/**
 * Processing screen showing individual photo statuses
 */
export const BatchProcessingScreen: React.FC<BatchProcessingScreenProps> = ({
    photoQueue,
    onRetry,
    onCancel
}) => {
    const completedCount = photoQueue.filter(p => p.status === 'success').length;
    const errorCount = photoQueue.filter(p => p.status === 'error').length;
    const processingCount = photoQueue.filter(p =>
        !['success', 'error', 'pending'].includes(p.status)
    ).length;
    const isAllDone = completedCount + errorCount === photoQueue.length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                        Обработка фотографий
                    </h3>
                    <span className="text-sm text-gray-500">
                        {completedCount}/{photoQueue.length}
                    </span>
                </div>
                <div className="flex gap-2 text-xs text-gray-500">
                    {processingCount > 0 && (
                        <span className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            В процессе: {processingCount}
                        </span>
                    )}
                    {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                            <X className="w-3 h-3" />
                            Ошибок: {errorCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Photo List */}
            <div className="space-y-2">
                {photoQueue.map((photo) => (
                    <PhotoStatusCard
                        key={photo.id}
                        photo={photo}
                        onRetry={onRetry}
                    />
                ))}
            </div>

            {/* Cancel Button */}
            {!isAllDone && (
                <button
                    onClick={onCancel}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-medium transition-colors"
                >
                    Прекратить анализ
                </button>
            )}
        </div>
    );
};

// ============================================================
// Photo Status Card Component
// ============================================================

interface PhotoStatusCardProps {
    photo: PhotoQueueItem;
    onRetry: (id: string) => void;
}

const PhotoStatusCard: React.FC<PhotoStatusCardProps> = ({ photo, onRetry }) => {
    const isActive = ['compressing', 'uploading', 'processing'].includes(photo.status);
    const isSuccess = photo.status === 'success';
    const isError = photo.status === 'error';
    const isPending = photo.status === 'pending';

    return (
        <div className={`
            bg-white rounded-xl p-3 shadow-sm flex items-center gap-3
            ${isActive ? 'ring-2 ring-blue-400' : ''}
            ${isSuccess ? 'bg-green-50' : ''}
            ${isError ? 'bg-red-50' : ''}
        `}>
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {photo.previewUrl ? (
                    <img
                        src={photo.previewUrl}
                        alt="Фото еды"
                        className="w-full h-full object-cover"
                    />
                ) : isActive ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        📷
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                    {photo.file.name}
                </p>
                <p className={`text-xs ${isError ? 'text-red-600' :
                    isSuccess ? 'text-green-600' :
                        'text-gray-500'
                    }`}>
                    {isError && photo.error ? photo.error : PHOTO_STATUS_LABELS[photo.status]}
                </p>
            </div>

            {/* Status Icon / Action */}
            <div className="flex-shrink-0">
                {isActive && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                {isPending && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
                {isSuccess && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                )}
                {isError && (
                    <button
                        onClick={() => onRetry(photo.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Повторить
                    </button>
                )}
            </div>
        </div>
    );
};

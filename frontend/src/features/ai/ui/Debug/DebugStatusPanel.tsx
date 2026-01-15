/**
 * Debug Status Panel - Processing Pipeline Visualization
 *
 * Shows real-time status of AI processing pipeline stages for QA testing.
 * Displays: preprocess → upload → polling stages with taskId.
 *
 * Only renders in debug mode.
 */

import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { IS_DEBUG } from '../../../../shared/config/debug';
import type { PhotoQueueItem } from '../../model';
import { PHOTO_STATUS_LABELS, AI_ERROR_CODES } from '../../model';

interface DebugStatusPanelProps {
    /** Current photo queue from context */
    photoQueue: PhotoQueueItem[];
    /** Whether processing is active */
    isProcessing: boolean;
}

type StageStatus = 'idle' | 'running' | 'done' | 'error';

interface StageInfo {
    name: string;
    label: string;
    status: StageStatus;
}

/**
 * Derive stage statuses from photo queue item status
 */
function deriveStages(photo: PhotoQueueItem | null): StageInfo[] {
    if (!photo) {
        return [
            { name: 'preprocess', label: 'Preprocess', status: 'idle' },
            { name: 'upload', label: 'Upload/Recognize', status: 'idle' },
            { name: 'polling', label: 'Polling', status: 'idle' },
        ];
    }

    const status = photo.status;
    const isError = status === 'error';
    const isSuccess = status === 'success';
    const isCancelled = status === 'cancelled';

    // Preprocess stage: pending → compressing
    let preprocessStatus: StageStatus = 'idle';
    if (status === 'pending') preprocessStatus = 'idle';
    else if (status === 'compressing') preprocessStatus = 'running';
    else if (['uploading', 'processing', 'success', 'error', 'cancelled'].includes(status)) {
        // Cancelled shows where we got to (done if we passed this stage)
        preprocessStatus = isError && !photo.taskId ? 'error' : 'done';
    }

    // Upload stage: uploading
    let uploadStatus: StageStatus = 'idle';
    if (['pending', 'compressing'].includes(status)) uploadStatus = 'idle';
    else if (status === 'uploading') uploadStatus = isCancelled ? 'idle' : 'running';
    else if (['processing', 'success', 'error', 'cancelled'].includes(status)) {
        // If cancelled during upload, show as done if we have taskId
        uploadStatus = (isError && !photo.taskId) ? 'error' : (isCancelled && !photo.taskId ? 'idle' : 'done');
    }

    // Polling stage: processing → success/error/cancelled
    let pollingStatus: StageStatus = 'idle';
    if (['pending', 'compressing', 'uploading'].includes(status)) pollingStatus = 'idle';
    else if (status === 'processing') pollingStatus = 'running';
    else if (isSuccess) pollingStatus = 'done';
    else if (isError && photo.taskId) pollingStatus = 'error';
    // P1: Show cancelled status for polling if we had a taskId (was in polling phase)
    else if (isCancelled && photo.taskId) pollingStatus = 'error';

    return [
        { name: 'preprocess', label: 'Preprocess', status: preprocessStatus },
        { name: 'upload', label: 'Upload/Recognize', status: uploadStatus },
        { name: 'polling', label: 'Polling', status: pollingStatus },
    ];
}

/**
 * Get overall status label
 */
function getOverallStatus(photo: PhotoQueueItem | null): { label: string; color: string } {
    if (!photo) {
        return { label: 'Нет фото в очереди', color: 'text-gray-500' };
    }

    switch (photo.status) {
        case 'pending':
            return { label: 'Ожидание', color: 'text-gray-500' };
        case 'compressing':
            return { label: 'Сжатие изображения', color: 'text-blue-600' };
        case 'uploading':
            return { label: 'Загрузка на сервер', color: 'text-blue-600' };
        case 'processing':
            return { label: 'AI обработка', color: 'text-purple-600' };
        case 'success':
            return { label: 'Успешно завершено', color: 'text-green-600' };
        case 'cancelled':
            return { label: 'Отменено пользователем', color: 'text-yellow-500' };
        case 'error':
            if (photo.errorCode === AI_ERROR_CODES.CANCELLED) {
                return { label: 'Отменено пользователем', color: 'text-yellow-500' };
            }
            if (photo.errorCode === AI_ERROR_CODES.TASK_TIMEOUT) {
                return { label: 'Таймаут (120s)', color: 'text-orange-600' };
            }
            return { label: 'Ошибка', color: 'text-red-600' };
        default:
            return { label: photo.status, color: 'text-gray-500' };
    }
}

/**
 * Stage icon based on status
 */
const StageIcon: React.FC<{ status: StageStatus }> = ({ status }) => {
    switch (status) {
        case 'idle':
            return <Circle className="w-4 h-4 text-gray-300" />;
        case 'running':
            return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
        case 'done':
            return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'error':
            return <XCircle className="w-4 h-4 text-red-500" />;
    }
};

/**
 * Debug Status Panel Component
 */
export const DebugStatusPanel: React.FC<DebugStatusPanelProps> = ({
    photoQueue,
    isProcessing,
}) => {
    // Don't render in production
    if (!IS_DEBUG) return null;

    // Get active/latest photo for status display
    const activePhoto = photoQueue.find(p =>
        ['compressing', 'uploading', 'processing'].includes(p.status)
    ) || photoQueue[photoQueue.length - 1] || null;

    const stages = deriveStages(activePhoto);
    const overall = getOverallStatus(activePhoto);

    return (
        <div className="bg-slate-800 text-white rounded-xl p-4 space-y-4 font-mono text-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-xs text-slate-400 uppercase tracking-wider">
                        Debug Status Panel
                    </span>
                </div>
                <span className="text-xs text-slate-500">
                    Queue: {photoQueue.length}
                </span>
            </div>

            {/* Overall Status */}
            <div className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                <span className="text-slate-400 text-xs">Status:</span>
                <span className={`font-medium ${overall.color}`}>
                    {overall.label}
                </span>
            </div>

            {/* Pipeline Stages */}
            <div className="space-y-2">
                <span className="text-xs text-slate-400">Pipeline:</span>
                <div className="grid grid-cols-3 gap-2">
                    {stages.map((stage) => (
                        <div
                            key={stage.name}
                            className={`
                                flex flex-col items-center gap-1 p-2 rounded-lg
                                ${stage.status === 'running' ? 'bg-blue-900/30' : 'bg-slate-700/30'}
                            `}
                        >
                            <StageIcon status={stage.status} />
                            <span className="text-[10px] text-slate-400">{stage.label}</span>
                            <span className={`text-[10px] ${stage.status === 'running' ? 'text-blue-400' :
                                stage.status === 'done' ? 'text-green-400' :
                                    stage.status === 'error' ? 'text-red-400' :
                                        'text-slate-500'
                                }`}>
                                {stage.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Task ID */}
            {activePhoto?.taskId && (
                <div className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400 text-xs">Task ID:</span>
                    <code className="text-xs text-cyan-400 font-medium">
                        {activePhoto.taskId.slice(0, 8)}...
                    </code>
                </div>
            )}

            {/* Error Details */}
            {activePhoto?.status === 'error' && activePhoto.error && (
                <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Error Details</span>
                    </div>
                    <p className="text-xs text-red-300">{activePhoto.error}</p>
                    {activePhoto.errorCode && (
                        <code className="text-[10px] text-red-400/70">
                            Code: {activePhoto.errorCode}
                        </code>
                    )}
                </div>
            )}

            {/* Success Details */}
            {activePhoto?.status === 'success' && activePhoto.result && (
                <div className="bg-green-900/30 border border-green-800/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-medium">Success</span>
                    </div>
                    <p className="text-xs text-green-300">
                        {activePhoto.result.recognized_items?.[0]?.name || 'Meal recognized'}
                        {activePhoto.result.recognized_items?.length > 1 && (
                            <span className="text-green-400/70"> +{activePhoto.result.recognized_items.length - 1}</span>
                        )}
                    </p>
                    {activePhoto.result.total_calories > 0 && (
                        <p className="text-[10px] text-green-400/70">
                            {activePhoto.result.total_calories} kcal
                        </p>
                    )}
                </div>
            )}

            {/* Photo Queue Summary */}
            {photoQueue.length > 0 && (
                <div className="space-y-2 border-t border-slate-700 pt-3">
                    <span className="text-xs text-slate-400">Queue Details:</span>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {photoQueue.map((photo, idx) => (
                            <div
                                key={photo.id}
                                className="flex items-center justify-between bg-slate-700/30 rounded px-2 py-1"
                            >
                                <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                                    #{idx + 1} {photo.file.name}
                                </span>
                                <span className={`text-[10px] ${photo.status === 'success' ? 'text-green-400' :
                                        photo.status === 'error' ? 'text-red-400' :
                                            photo.status === 'cancelled' ? 'text-yellow-400' :
                                                ['compressing', 'uploading', 'processing'].includes(photo.status) ? 'text-blue-400' :
                                                    'text-slate-500'
                                    }`}>
                                    {PHOTO_STATUS_LABELS[photo.status]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugStatusPanel;

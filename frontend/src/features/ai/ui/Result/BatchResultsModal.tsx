import React, { useState } from 'react';
import { Check, AlertCircle, X, ChevronLeft, Flame, Drumstick, Droplets, Wheat, RefreshCcw } from 'lucide-react';
import type { RecognizedItem } from '../../api';
import type { PhotoQueueItem } from '../../model';

interface BatchResultsModalProps {
    photoQueue: PhotoQueueItem[];
    onRetry: (id: string) => void;
    onRetryAll?: () => void;
    onClose: () => void;
    onOpenDiary?: () => void;
}

/**
 * Modal showing batch recognition results
 * Supports list view and detail view for each result
 */
export const BatchResultsModal: React.FC<BatchResultsModalProps> = ({
    photoQueue,
    onRetry,
    onRetryAll,
    onClose,
    onOpenDiary
}) => {
    const totalCount = photoQueue.length;
    const successCount = photoQueue.filter(p => p.status === 'success').length;
    const retryableErrorCount = photoQueue.filter(p => p.status === 'error' && p.error !== 'Отменено').length;

    // Detail view state
    const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);

    const handleBackToList = () => {
        setSelectedResultIndex(null);
    };

    const handleViewDetails = (index: number) => {
        setSelectedResultIndex(index);
    };

    // Render item card
    const renderItemCard = (item: RecognizedItem, idx: number) => (
        <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="font-bold text-gray-900 text-lg leading-tight">
                        {item.name}
                    </h4>
                    <p className="text-gray-500 text-sm mt-1">
                        {item.grams} г
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-xl">
                    <Flame size={16} className="text-orange-500" />
                    <span className="font-bold text-orange-700">
                        {Math.round(item.calories)}
                    </span>
                </div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                        <Drumstick size={12} />
                        <span>Белки</span>
                    </div>
                    <span className="font-bold text-gray-900">{Math.round(item.protein)}г</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                        <Droplets size={12} />
                        <span>Жиры</span>
                    </div>
                    <span className="font-bold text-gray-900">{Math.round(item.fat)}г</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                        <Wheat size={12} />
                        <span>Угл.</span>
                    </div>
                    <span className="font-bold text-gray-900">{Math.round(item.carbohydrates)}г</span>
                </div>
            </div>
        </div>
    );

    // If viewing details of a specific result
    if (selectedResultIndex !== null) {
        const item = photoQueue[selectedResultIndex];

        return (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl h-[98vh] sm:h-auto sm:max-h-[95vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">

                    {/* Detail View Header */}
                    <div className="p-6 border-b border-gray-100 flex items-center gap-3 shrink-0">
                        <button
                            onClick={handleBackToList}
                            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <ChevronLeft size={20} className="text-gray-600" />
                        </button>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-900">Детали блюда</h2>
                            <p className="text-sm text-gray-500">
                                Фото {selectedResultIndex + 1} из {totalCount}
                            </p>
                        </div>
                    </div>

                    {/* Detail View Content */}
                    <div className="overflow-y-auto flex-1">
                        {/* Large Photo */}
                        <div className="w-full h-64 bg-gray-200 relative">
                            {item.previewUrl && (
                                <img
                                    src={item.previewUrl}
                                    alt="Detail"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>

                        {item.status === 'success' && item.result ? (
                            <div className="p-6 pb-24 space-y-4">
                                {/* Neutral message for empty items but successful processing */}
                                {item.result._neutralMessage ? (
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                                        <Check className="text-blue-500 mx-auto mb-3" size={48} />
                                        <h3 className="text-xl font-bold text-blue-600 mb-2">Анализ завершён</h3>
                                        <p className="text-blue-500">
                                            {item.result._neutralMessage}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Summary */}
                                        <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-gray-50 rounded-2xl">
                                            <div className="text-center border-r border-gray-200 last:border-0">
                                                <div className="text-xs text-gray-500 font-medium">Ккал</div>
                                                <div className="text-sm font-bold text-gray-900">{Math.round(item.result.total_calories)}</div>
                                            </div>
                                            <div className="text-center border-r border-gray-200 last:border-0">
                                                <div className="text-xs text-gray-500 font-medium">Белки</div>
                                                <div className="text-sm font-bold text-gray-900">{Math.round(item.result.total_protein)}</div>
                                            </div>
                                            <div className="text-center border-r border-gray-200 last:border-0">
                                                <div className="text-xs text-gray-500 font-medium">Жиры</div>
                                                <div className="text-sm font-bold text-gray-900">{Math.round(item.result.total_fat)}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xs text-gray-500 font-medium">Угл.</div>
                                                <div className="text-sm font-bold text-gray-900">{Math.round(item.result.total_carbohydrates)}</div>
                                            </div>
                                        </div>

                                        {/* Recognized Items */}
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-3">
                                                Распознанные блюда ({item.result.recognized_items.length})
                                            </h3>
                                            <div className="space-y-3">
                                                {item.result.recognized_items.map((r, idx) => renderItemCard(r, idx))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="p-6 pb-24">
                                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                                    <AlertCircle className={`mx-auto mb-3 ${item.error === 'Отменено' ? 'text-gray-400' : 'text-red-500'}`} size={48} />
                                    <h3 className={`text-xl font-bold mb-2 ${item.error === 'Отменено' ? 'text-gray-600' : 'text-red-600'}`}>
                                        {item.error === 'Отменено' ? 'Отменено' : 'Ошибка загрузки'}
                                    </h3>
                                    <p className="text-gray-500 mb-6">
                                        {item.error || 'Попробуйте ещё раз'}
                                    </p>

                                    {item.status === 'error' && item.error !== 'Отменено' && (
                                        <button
                                            onClick={() => onRetry(item.id)}
                                            className="flex items-center gap-2 mx-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            <RefreshCcw size={18} />
                                            Повторить
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Default: List View
    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl h-[98vh] sm:h-auto sm:max-h-[95vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Итоги загрузки</h2>
                        <p className="text-sm text-gray-500">
                            Распознано {successCount} из {totalCount} фото
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <X size={20} className="text-gray-600" />
                    </button>
                </div>

                {/* List */}
                <div className="overflow-y-auto p-4 space-y-4">
                    {photoQueue.map((item, index) => (
                        <div key={item.id} className="flex gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                            {/* Thumbnail */}
                            <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-200 relative aspect-square">
                                {item.previewUrl && (
                                    <img
                                        src={item.previewUrl}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                                <div className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center ${item.status === 'success'
                                    ? (item.result?._neutralMessage ? 'bg-blue-500' : 'bg-green-500')
                                    : item.error === 'Отменено' ? 'bg-gray-400' : 'bg-red-500'
                                    }`}>
                                    {item.status === 'success' ? (
                                        <Check size={14} className="text-white" />
                                    ) : (
                                        <AlertCircle size={14} className="text-white" />
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                {item.status === 'success' && item.result ? (
                                    item.result._neutralMessage ? (
                                        <>
                                            <h3 className="font-bold text-blue-600">Анализ завершён</h3>
                                            <p className="text-sm text-blue-500 mt-1">
                                                {item.result._neutralMessage}
                                            </p>
                                            <button
                                                onClick={() => handleViewDetails(index)}
                                                className="mt-2 text-sm text-blue-600 font-medium hover:underline text-left"
                                            >
                                                Подробнее
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="font-bold text-gray-900 truncate pr-2">
                                                {item.result.recognized_items.map(i => i.name).join(', ') || 'Еда'}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                                                <span className="font-medium text-orange-600">
                                                    {Math.round(item.result.total_calories)} ккал
                                                </span>
                                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                                                    Б {Math.round(item.result.total_protein)}
                                                </span>
                                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                                                    Ж {Math.round(item.result.total_fat)}
                                                </span>
                                                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    У {Math.round(item.result.total_carbohydrates)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleViewDetails(index)}
                                                className="mt-2 text-sm text-blue-600 font-medium hover:underline text-left"
                                            >
                                                Подробнее
                                            </button>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <h3 className={`font-bold ${item.error === 'Отменено' ? 'text-gray-500' : 'text-red-600'}`}>
                                            {item.error === 'Отменено' ? 'Отменено' : 'Ошибка загрузки'}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1 truncate">
                                            {item.error || 'Ошибка распознавания'}
                                        </p>
                                        <div className="flex gap-3 mt-2">
                                            {item.error !== 'Отменено' && (
                                                <button
                                                    onClick={() => onRetry(item.id)}
                                                    className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <RefreshCcw size={14} />
                                                    Повторить
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleViewDetails(index)}
                                                className="text-sm text-gray-500 font-medium hover:underline"
                                            >
                                                Подробнее
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer with Safe Area */}
                <div className="p-4 border-t border-gray-100 shrink-0 bg-white sm:rounded-b-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-4 space-y-3">
                    {retryableErrorCount > 1 && onRetryAll && (
                        <button
                            onClick={onRetryAll}
                            className="w-full bg-blue-50 text-blue-600 py-4 rounded-2xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCcw size={18} />
                            Повторить все ошибки ({retryableErrorCount})
                        </button>
                    )}

                    {successCount > 0 ? (
                        <button
                            onClick={onOpenDiary || onClose}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-2xl font-bold hover:shadow-xl transition-all min-h-[48px] flex items-center justify-center"
                        >
                            Готово
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                        >
                            Закрыть
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

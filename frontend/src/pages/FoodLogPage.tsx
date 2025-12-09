import React, { useState, useEffect } from 'react';
import { Camera, CreditCard, AlertCircle, Check, X, Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBilling } from '../contexts/BillingContext';
import { useAuth } from '../contexts/AuthContext';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { BatchResultsModal } from '../components/BatchResultsModal';
import { useFoodBatchAnalysis } from '../hooks/useFoodBatchAnalysis';
import { FileWithComment } from '../types/food';
import { SelectedPhotosList } from '../components/food/SelectedPhotosList';
import { BatchProcessingScreen } from '../components/food/BatchProcessingScreen';
// F-007 FIX: HEIC/HEIF support for iOS photos
import { convertHeicToJpeg, isHeicFile } from '../utils/imageUtils';

const FoodLogPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const billing = useBilling();
    const { isBrowserDebug } = useAuth();
    const { isReady, isTelegramWebApp: webAppDetected, isBrowserDebug: webAppBrowserDebug, isDesktop } = useTelegramWebApp();

    // Get initial date from location state or use today
    const getInitialDate = () => {
        const dateFromState = (location.state as any)?.selectedDate;
        if (dateFromState) {
            return new Date(dateFromState);
        }
        return new Date();
    };
    const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
    const [mealType, setMealType] = useState<string>('BREAKFAST');
    const [selectedFiles, setSelectedFiles] = useState<FileWithComment[]>([]);
    const [showBatchResults, setShowBatchResults] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showLimitModal, setShowLimitModal] = useState(false);

    // Batch analysis hook
    const {
        isProcessing,
        progress,
        results,
        startBatch,
        cancelBatch,
    } = useFoodBatchAnalysis({
        onDailyLimitReached: () => setShowLimitModal(true),
        getDateString: () => selectedDate.toISOString().split('T')[0],
        getMealType: () => mealType,
    });

    // Cleanup preview URLs on unmount or when files change
    useEffect(() => {
        return () => {
            selectedFiles.forEach(f => {
                if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
            });
        };
    }, [selectedFiles]);

    // Show results modal when batch completes
    useEffect(() => {
        if (results.length > 0 && !isProcessing) {
            setShowBatchResults(true);
            setSelectedFiles([]);
            // Refresh billing info
            billing.refresh();
        }
    }, [results, isProcessing, billing]);

    const mealTypeOptions = [
        { value: 'BREAKFAST', label: 'Завтрак' },
        { value: 'LUNCH', label: 'Обед' },
        { value: 'DINNER', label: 'Ужин' },
        { value: 'SNACK', label: 'Перекус' },
    ];

    // F-007: Made async for HEIC conversion
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            let fileList = Array.from(files);

            // Limit to 5 files
            if (fileList.length > 5) {
                alert('За один раз можно загрузить не более 5 фото. Лишние фото будут проигнорированы.');
                fileList = fileList.slice(0, 5);
            }

            // Validate file sizes
            const validFiles = fileList.filter(file => {
                if (file.size > 10 * 1024 * 1024) {
                    console.warn(`File ${file.name} is too large (skipped)`);
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) {
                setError('Все выбранные файлы слишком большие (максимум 10MB).');
                return;
            }

            // Convert to FileWithComment objects with empty comments
            // F-007: Create preview URLs (handles HEIC conversion for preview)
            const filesWithComments: FileWithComment[] = await Promise.all(
                validFiles.map(async (file) => {
                    let previewUrl: string;
                    if (isHeicFile(file)) {
                        // Convert HEIC to JPEG for preview
                        try {
                            const converted = await convertHeicToJpeg(file);
                            previewUrl = URL.createObjectURL(converted);
                        } catch {
                            previewUrl = ''; // Will show placeholder
                        }
                    } else {
                        previewUrl = URL.createObjectURL(file);
                    }
                    return { file, comment: '', previewUrl };
                })
            );
            setSelectedFiles(filesWithComments);
            setError(null);
        }
    };

    const handleAddFiles = async (newFiles: File[]) => {
        // F-007: Create preview URLs (handles HEIC conversion for preview)
        const filesWithComments: FileWithComment[] = await Promise.all(
            newFiles.map(async (file) => {
                let previewUrl: string;
                if (isHeicFile(file)) {
                    try {
                        const converted = await convertHeicToJpeg(file);
                        previewUrl = URL.createObjectURL(converted);
                    } catch {
                        previewUrl = '';
                    }
                } else {
                    previewUrl = URL.createObjectURL(file);
                }
                return { file, comment: '', previewUrl };
            })
        );
        setSelectedFiles([...selectedFiles, ...filesWithComments]);
    };

    const handleRemoveFile = (index: number) => {
        const newFiles = [...selectedFiles];
        newFiles.splice(index, 1);
        setSelectedFiles(newFiles);
    };

    const handleCommentChange = (index: number, comment: string) => {
        const newFiles = [...selectedFiles];
        newFiles[index] = { ...newFiles[index], comment };
        setSelectedFiles(newFiles);
    };

    const handleAnalyze = () => {
        if (selectedFiles.length === 0) return;
        startBatch(selectedFiles);
    };

    const handleCloseResults = () => {
        setShowBatchResults(false);
        // Navigate back to dashboard with the selected date
        const dateStr = selectedDate.toISOString().split('T')[0];
        navigate(`/?date=${dateStr}`);
    };

    // While WebApp is initializing
    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // WebApp is ready but we're not in Telegram
    // Allow Browser Debug Mode to continue
    if (!webAppDetected && !isBrowserDebug && !webAppBrowserDebug) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center max-w-md">
                    <h2 className="text-xl font-bold text-orange-900 mb-2">
                        Откройте через Telegram
                    </h2>
                    <p className="text-orange-700">
                        Это приложение работает только внутри Telegram.
                        Пожалуйста, откройте бота и нажмите кнопку "Открыть приложение".
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 pt-6 pb-24 safe-area-bottom">
            <div className="max-w-lg mx-auto">
                {/* Date and Meal Type Selector */}
                <div className="bg-white rounded-3xl shadow-sm p-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Дата</h3>
                            <input
                                type="date"
                                value={selectedDate.toISOString().split('T')[0]}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="w-full p-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white"
                            />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Приём пищи</h3>
                            <div className="relative">
                                <select
                                    value={mealType}
                                    onChange={(e) => setMealType(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white appearance-none"
                                >
                                    {mealTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {isProcessing ? (
                    /* Batch Processing State */
                    <BatchProcessingScreen
                        current={progress.current}
                        total={progress.total}
                        onCancel={() => {
                            setSelectedFiles([]);
                            cancelBatch();
                        }}
                    />
                ) : selectedFiles.length > 0 ? (
                    /* Preview State with Individual Comments */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Выбранные фото ({selectedFiles.length})</h2>
                                <button
                                    onClick={() => setSelectedFiles([])}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <SelectedPhotosList
                                files={selectedFiles}
                                onChangeComment={handleCommentChange}
                                onRemove={handleRemoveFile}
                                onAddFiles={handleAddFiles}
                            />

                            {/* Hint */}
                            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-blue-800 text-sm">
                                    💡 <strong>Совет:</strong> Укажите комментарий для каждого фото отдельно — так ИИ точнее распознает блюда и калории
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setSelectedFiles([])}
                                    className="py-3 px-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    className="py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Send size={18} />
                                    Отправить
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Initial Upload State */
                    <div className="space-y-6">

                        {/* Desktop Warning */}
                        {isDesktop && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <p className="text-yellow-800 font-medium text-sm">
                                            Вы используете десктоп-версию
                                        </p>
                                        <p className="text-yellow-700 text-sm mt-1">
                                            Для съёмки еды рекомендуем открыть приложение на телефоне.
                                            На десктопе можно загрузить готовые фото.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <label className="block">
                            <div className="aspect-video bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex flex-col items-center justify-center text-white shadow-xl active:scale-95 transition-transform cursor-pointer">
                                <Camera size={64} className="mb-4" />
                                <span className="text-xl font-bold mb-2">
                                    {isDesktop ? 'Загрузить фото' : 'Сфотографировать'}
                                </span>
                                <span className="text-sm text-white/80">Можно выбрать до 5 фото</span>
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </label>

                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                            <p className="text-blue-800 text-sm text-center">
                                {isDesktop
                                    ? '💡 Загрузите фото еды с хорошим освещением для точного распознавания'
                                    : '💡 Для лучшего результата сфотографируйте еду сверху при хорошем освещении'
                                }
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4">
                                <p className="text-red-600 text-center font-medium">{error}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Limit Reached Modal */}
                {showLimitModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="text-center mb-4">
                                <AlertCircle className="text-red-500 mx-auto mb-3" size={48} />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    Лимит исчерпан
                                </h3>
                                <p className="text-gray-600">
                                    Вы использовали свои {billing.data?.daily_photo_limit} бесплатных анализа.
                                    Некоторые фото не были обработаны.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => navigate('/subscription')}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-bold hover:from-blue-600 hover:to-purple-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <CreditCard size={20} />
                                    Оформить PRO
                                </button>
                                <button
                                    onClick={() => {
                                        setShowLimitModal(false);
                                        navigate('/');
                                    }}
                                    className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-colors"
                                >
                                    Понятно
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Batch Results Modal */}
                {showBatchResults && (
                    <BatchResultsModal
                        results={results}
                        onClose={handleCloseResults}
                        onOpenDiary={() => {
                            setShowBatchResults(false);
                            navigate('/');
                        }}
                    />
                )}

                {/* Compact Billing Info Footer */}
                {billing.data && !billing.loading && (
                    <div className={`mt-8 rounded-xl p-3 text-sm ${billing.isPro
                        ? 'bg-purple-50 border border-purple-100'
                        : billing.isLimitReached
                            ? 'bg-red-50 border border-red-100'
                            : 'bg-blue-50 border border-blue-100'
                        }`}>
                        {billing.isPro ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Check className="text-purple-600" size={16} />
                                    <span className="font-medium text-purple-900">
                                        PRO активен
                                    </span>
                                </div>
                                {billing.data.expires_at && (
                                    <span className="text-purple-600 text-xs">
                                        до {new Date(billing.data.expires_at).toLocaleDateString('ru-RU')}
                                    </span>
                                )}
                            </div>
                        ) : billing.isLimitReached ? (
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="text-red-600" size={16} />
                                    <span className="font-medium text-red-900">
                                        Лимит исчерпан
                                    </span>
                                </div>
                                <button
                                    onClick={() => navigate('/subscription')}
                                    className="text-red-600 font-medium text-xs hover:underline whitespace-nowrap"
                                >
                                    Купить PRO
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <span className="text-blue-900">
                                    {billing.data.used_today} / {billing.data.daily_photo_limit} фото
                                </span>
                                <button
                                    onClick={() => navigate('/subscription')}
                                    className="text-blue-600 font-medium text-xs hover:underline"
                                >
                                    Увеличить лимит
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FoodLogPage;

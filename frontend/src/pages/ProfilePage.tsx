import React, { useState, useEffect, useRef } from 'react';
import { User, Settings, Edit2, X, Camera, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { api, UnauthorizedError, ForbiddenError } from '../services/api';
import { Profile } from '../types/profile';
import ProfileEditModal from '../components/ProfileEditModal';
import { calculateMifflinTargets, hasRequiredProfileData, getMissingProfileFields } from '../utils/mifflin';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { useWeeklyKbjuStats } from '../hooks/useWeeklyKbjuStats';
import GoalsSection from '../components/profile/GoalsSection';
import WeeklyStatsCard from '../components/profile/WeeklyStatsCard';
interface UserGoals {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
}

const ProfilePage: React.FC = () => {
    const { user, isBrowserDebug } = useAuth();
    // Use shared data from AppDataContext - loads instantly if already cached
    const { profile: contextProfile, goals: contextGoals, refreshProfile, refreshGoals, isLoading: contextLoading } = useAppData();
    const navigate = useNavigate();
    const { isReady, isTelegramWebApp: webAppDetected, isBrowserDebug: webAppBrowserDebug } = useTelegramWebApp();
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [isWeeklyStatsOpen, setIsWeeklyStatsOpen] = useState(false);

    // Local goals state for editing (can differ from context until saved)
    const [goals, setGoals] = useState<UserGoals | null>(null);
    const [editedGoals, setEditedGoals] = useState<UserGoals | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Local profile state (for editing/avatar)
    const [profile, setProfile] = useState<Profile | null>(null);

    // Load weekly stats using custom hook
    const { avgCalories, avgProtein, avgFat, avgCarbs } = useWeeklyKbjuStats();

    // Initialize from context when available (instant, no API call)
    useEffect(() => {
        if (contextProfile) {
            setProfile(contextProfile);
            if (contextProfile.avatar_url) {
                setAvatarPreview(contextProfile.avatar_url);
            }
        }
    }, [contextProfile]);

    // Initialize goals from context
    useEffect(() => {
        if (contextGoals) {
            setGoals(contextGoals);
        }
    }, [contextGoals]);

    const handleEditGoals = () => {
        setEditedGoals(goals || { calories: 2000, protein: 150, fat: 70, carbohydrates: 250 });
        setIsEditingGoals(true);
        setError(null);
    };

    // Auto-calculate calories from BJU: Protein*4 + Fat*9 + Carbs*4
    const calculateCaloriesFromBJU = (protein: number, fat: number, carbs: number) => {
        return Math.round(protein * 4 + fat * 9 + carbs * 4);
    };

    const handleBJUChange = (field: 'protein' | 'fat' | 'carbohydrates', value: number) => {
        if (!editedGoals) return;
        const newGoals = { ...editedGoals, [field]: value };
        newGoals.calories = calculateCaloriesFromBJU(newGoals.protein, newGoals.fat, newGoals.carbohydrates);
        setEditedGoals(newGoals);
    };

    const handleCancelEdit = () => {
        setEditedGoals(null);
        setIsEditingGoals(false);
        setError(null);
    };

    const handleSaveGoals = async () => {
        if (!editedGoals) return;

        setError(null);

        console.log('[ProfilePage] Saving goals:', editedGoals);

        try {
            const result = await api.updateGoals(editedGoals);
            console.log('[ProfilePage] Goals saved successfully:', result);

            setGoals(editedGoals);
            setIsEditingGoals(false);
            setEditedGoals(null);

            // Refresh context so other pages get updated goals
            await refreshGoals();
        } catch (err: any) {
            console.error('[ProfilePage] Failed to save goals:', err);
            const errorMsg = err.message || 'Ошибка при сохранении целей';
            setError(errorMsg);
        }
    };

    const handleAutoCalculate = () => {
        setError(null);

        // Check if profile has required data
        if (!hasRequiredProfileData(profile)) {
            const missingFields = getMissingProfileFields(profile);
            setError(
                `Для расчёта необходимо заполнить следующие поля в профиле: ${missingFields.join(', ')}. ` +
                'Пожалуйста, откройте редактирование профиля и заполните недостающие данные.'
            );
            return;
        }

        try {
            // Calculate targets using Mifflin-St Jeor formula on frontend
            const targets = calculateMifflinTargets(profile!);

            // Update the edited goals state with calculated values
            setEditedGoals({
                calories: targets.calories,
                protein: targets.protein,
                fat: targets.fat,
                carbohydrates: targets.carbohydrates,
            });
        } catch (err: any) {
            setError(err.message || 'Не удалось рассчитать цели. Проверьте данные профиля.');
        }
    };

    const handleProfileUpdate = (updatedProfile: Profile) => {
        setProfile(updatedProfile);
        // Refresh context so other pages get updated profile
        refreshProfile();
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log('[ProfilePage] Selected file:', {
            name: file.name,
            type: file.type,
            size: file.size,
            sizeKB: (file.size / 1024).toFixed(1)
        });

        // Limit size to 5MB
        if (file.size > 5 * 1024 * 1024) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            setError(`Размер файла ${sizeMB} МБ превышает лимит 5 МБ. Пожалуйста, выберите файл меньшего размера.`);
            return;
        }

        // iOS-specific: Check for HEIC format and inform user
        if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            console.log('[ProfilePage] HEIC/HEIF image detected, uploading directly (backend supports HEIC)');
        }

        // Show local preview immediately (works for most formats except HEIC)
        try {
            const objectUrl = URL.createObjectURL(file);
            setAvatarPreview(objectUrl);
        } catch (err) {
            console.warn('[ProfilePage] Failed to create preview:', err);
            // Continue with upload anyway
        }

        // Upload to backend
        setUploadingAvatar(true);
        setError(null);

        try {
            const updatedProfile = await api.uploadAvatar(file);
            setProfile(updatedProfile);
            // Update preview from server URL (with cache busting version parameter)
            setAvatarPreview(updatedProfile.avatar_url || null);
            console.log('[ProfilePage] Avatar uploaded successfully:', updatedProfile.avatar_url);
        } catch (err: any) {
            console.error('[ProfilePage] Failed to upload avatar:', err);

            // Parse error message
            let errorMessage = 'Не удалось загрузить фото. Попробуй ещё раз.';

            // Handle authentication errors specifically
            if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
                errorMessage = 'Сессия истекла. Пожалуйста, откройте приложение заново из Telegram.';
            } else if (err.message) {
                // Use backend error message if available
                errorMessage = err.message;

                // Add helpful context for common errors
                if (errorMessage.includes('формат') || errorMessage.includes('format')) {
                    errorMessage += ' На iOS фотографии могут быть в формате HEIC. Попробуйте сохранить фото как JPEG.';
                }
            }

            setError(errorMessage);

            // Revert to old avatar on any error
            setAvatarPreview(profile?.avatar_url || null);
        } finally {
            setUploadingAvatar(false);
            // Clear file input to allow re-selecting the same file
            if (event.target) {
                event.target.value = '';
            }
        }
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 pb-1">
            <div className="max-w-2xl mx-auto">


                {/* Profile Card */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
                    <div className="h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                    <div className="relative px-6 pb-6">
                        <div className="absolute -top-16 left-6">
                            <div
                                className="w-28 h-28 bg-white rounded-full p-2 shadow-xl cursor-pointer group relative"
                                onClick={handleAvatarClick}
                            >
                                <div className="w-full h-full rounded-full overflow-hidden relative">
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                            <User size={48} className="text-white" />
                                        </div>
                                    )}

                                    {/* Upload Spinner */}
                                    {uploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
                                        </div>
                                    )}

                                    {/* Hover Overlay */}
                                    {!uploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Camera size={32} className="text-white drop-shadow-lg" />
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingAvatar}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                            >
                                {isEditing ? (
                                    <>
                                        <X size={18} />
                                        <span className="text-sm font-medium">Отменить</span>
                                    </>
                                ) : (
                                    <>
                                        <Edit2 size={18} />
                                        <span className="text-sm font-medium">Редактировать</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="mt-4">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {user?.first_name} {user?.last_name || ''}
                            </h1>
                            <p className="text-gray-500 mt-1">@{user?.username || 'user'}</p>
                            <p className="text-sm text-gray-400 mt-2">Telegram ID: {user?.telegram_id}</p>
                        </div>
                    </div>
                </div>

                {/* Goals Section */}
                <GoalsSection
                    goals={goals}
                    editedGoals={editedGoals}
                    isEditingGoals={isEditingGoals}
                    isLoading={contextLoading}
                    error={error}
                    onEdit={handleEditGoals}
                    onChangeBju={handleBJUChange}
                    onAutoCalculate={handleAutoCalculate}
                    onSave={handleSaveGoals}
                    onCancel={handleCancelEdit}
                />

                {/* Statistics - Average Weekly KBJU */}
                <WeeklyStatsCard
                    isOpen={isWeeklyStatsOpen}
                    onToggle={() => setIsWeeklyStatsOpen(!isWeeklyStatsOpen)}
                    avgCalories={avgCalories}
                    avgProtein={avgProtein}
                    avgFat={avgFat}
                    avgCarbs={avgCarbs}
                />

                {/* Settings */}
                <div
                    className="bg-white rounded-3xl shadow-lg py-3 px-4 cursor-pointer active:scale-[0.98] transition-all"
                    onClick={() => navigate('/settings')}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-600 rounded-xl flex items-center justify-center mt-1">
                                <Settings size={24} className="text-white" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h2 className="text-lg font-bold text-gray-900 leading-tight">Настройки</h2>
                                <p className="text-xs text-gray-500 leading-tight">Управление аккаунтом</p>
                            </div>
                        </div>
                        <ChevronRight size={24} className="text-gray-400" />
                    </div>
                </div>
            </div>

            <ProfileEditModal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                profile={profile}
                onProfileUpdated={handleProfileUpdate}
            />
        </div>
    );
};

export default ProfilePage;

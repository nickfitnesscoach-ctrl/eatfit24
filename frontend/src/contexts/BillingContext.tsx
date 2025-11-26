/**
 * BillingContext - Глобальное состояние подписки и лимитов
 *
 * Предоставляет:
 * - Информацию о текущем тарифе (FREE/MONTHLY/YEARLY)
 * - Дневные лимиты фото и использование
 * - Методы обновления состояния
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { BillingState, BillingMe, BillingPlanCode } from '../types/billing';
import { useAuth } from './AuthContext';

interface BillingContextType extends BillingState {
    refresh: () => Promise<void>;
    isLimitReached: boolean;
    isPro: boolean;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const useBilling = () => {
    const context = useContext(BillingContext);
    if (!context) {
        throw new Error('useBilling must be used within BillingProvider');
    }
    return context;
};

interface BillingProviderProps {
    children: React.ReactNode;
}

export const BillingProvider: React.FC<BillingProviderProps> = ({ children }) => {
    console.log('[BillingProvider] Mounting...');
    const auth = useAuth();
    console.log('[BillingProvider] auth.isInitialized:', auth.isInitialized);

    const [state, setState] = useState<BillingState>({
        data: null,
        loading: true,
        error: null,
    });

    /**
     * Обновить данные подписки с сервера
     */
    const refresh = useCallback(async () => {
        // Не загружаем, пока не авторизовались
        if (!auth.isInitialized) {
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true, error: null }));
            const data = await api.getBillingMe();
            setState({
                data,
                loading: false,
                error: null,
            });
        } catch (error) {
            console.error('Failed to fetch billing data:', error);

            // Fallback: устанавливаем FREE план с лимитом 3 при ошибке
            setState({
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to load billing data',
                data: {
                    plan_code: 'FREE',
                    plan_name: 'Бесплатный',
                    expires_at: null,
                    is_active: true,
                    daily_photo_limit: 3,
                    used_today: 0,
                    remaining_today: 3,
                },
            });
        }
    }, [auth.isInitialized]);

    // Загрузка при инициализации авторизации
    useEffect(() => {
        if (auth.isInitialized) {
            refresh();
        }
    }, [auth.isInitialized, refresh]); // Запускаем когда авторизация готова

    // Вычисляемые значения
    const isLimitReached = state.data
        ? state.data.daily_photo_limit !== null && state.data.used_today >= state.data.daily_photo_limit
        : false;

    const isPro = state.data ? ['MONTHLY', 'YEARLY'].includes(state.data.plan_code) : false;

    const value: BillingContextType = {
        ...state,
        refresh,
        isLimitReached,
        isPro,
    };

    return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

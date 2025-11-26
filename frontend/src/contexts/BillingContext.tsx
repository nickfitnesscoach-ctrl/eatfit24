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
    const [state, setState] = useState<BillingState>({
        data: null,
        loading: true,
        error: null,
    });

    /**
     * Обновить данные подписки с сервера
     */
    const refresh = useCallback(async () => {
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
            setState(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to load billing data',
            }));

            // Fallback: устанавливаем FREE план с лимитом 3 при ошибке
            if (!state.data) {
                setState(prev => ({
                    ...prev,
                    data: {
                        plan_code: 'FREE',
                        plan_name: 'Бесплатный',
                        expires_at: null,
                        is_active: true,
                        daily_photo_limit: 3,
                        used_today: 0,
                        remaining_today: 3,
                    },
                }));
            }
        }
    }, [state.data]);

    // Загрузка при монтировании
    useEffect(() => {
        refresh();
    }, []); // Запускаем только один раз

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

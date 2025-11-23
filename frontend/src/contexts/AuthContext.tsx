import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { getTelegramInitData } from '../lib/telegram';

interface User {
    id: number;
    username: string;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    completed_ai_test: boolean;
    is_client?: boolean; // Флаг из бэкенда
    role?: 'trainer' | 'client'; // Вычисляемое поле
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    authenticate: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const authenticate = async () => {
        try {
            setLoading(true);
            setError(null);

            // Получаем initData из Telegram WebApp через централизованный модуль
            const initData = getTelegramInitData(true); // true = разрешить dev mode

            if (!initData) {
                console.warn('Telegram WebApp not initialized or running outside Telegram');
                setLoading(false);
                return;
            }

            const response = await api.authenticate(initData);
            console.log('Auth response:', response);
            (window as any).lastAuthResponse = response;

            // Set access token for future requests
            if (response.access) {
                api.setAccessToken(response.access);
            } else {
                console.error('No access token in response!', response);
            }

            // Определяем роль
            const userData = response.user;
            const role = userData.is_client ? 'client' : 'trainer';

            setUser({ ...userData, role });
        } catch (err) {
            console.error('Authentication error:', err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        // Можно добавить вызов API для логаута если нужно
    };

    useEffect(() => {
        authenticate();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, error, authenticate, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};


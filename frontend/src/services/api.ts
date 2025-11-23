// Используем относительный путь - nginx проксирует на Django backend
const API_URL = '/api/v1/telegram';

const debugLogs: string[] = [];

const isSkipTelegramAuth = import.meta.env.VITE_SKIP_TG_AUTH === 'true';
const devInitData = import.meta.env.VITE_DEV_TG_INIT_DATA || '';

// Telegram user data for auth
let telegramId: string | null = null;
let telegramFirstName: string | null = null;
let telegramUsername: string | null = null;
let telegramInitData: string | null = null;
let isInitialized = false;

const log = (msg: string) => {
    debugLogs.push(`${new Date().toISOString().split('T')[1]}: ${msg}`);
    if (debugLogs.length > 20) debugLogs.shift();
    console.log('[API]', msg);
};

// Init from Telegram WebApp
const initTelegramData = () => {
    const tg = window.Telegram?.WebApp;
    log(`initTelegramData called, Telegram WebApp exists: ${!!tg}`);
    log(`initData: ${tg?.initData || 'empty'}`);
    log(`initDataUnsafe: ${JSON.stringify(tg?.initDataUnsafe || {})}`);

    if (tg?.initData) {
        telegramInitData = tg.initData;
        log(`Received initData length: ${telegramInitData.length}`);
    } else if (isSkipTelegramAuth) {
        telegramInitData = devInitData || 'DEV_TELEGRAM_INIT_DATA';
        log('Using dev initData stub (VITE_SKIP_TG_AUTH)');
    } else {
        telegramInitData = '';
        log('No initData available (likely opened outside Telegram)');
    }

    if (tg?.initDataUnsafe?.user) {
        telegramId = String(tg.initDataUnsafe.user.id);
        telegramFirstName = tg.initDataUnsafe.user.first_name || 'User';
        telegramUsername = tg.initDataUnsafe.user.username || '';
        isInitialized = true;
        log(`Telegram user: ${telegramId} (${telegramFirstName})`);
    } else if (isSkipTelegramAuth) {
        telegramId = 'dev-user-id';
        telegramFirstName = 'DevUser';
        telegramUsername = 'devuser';
        isInitialized = true;
        log('Using dev telegram user stub (VITE_SKIP_TG_AUTH)');
    } else {
        telegramId = null;
        telegramFirstName = null;
        telegramUsername = null;
        log('Telegram user data missing');
    }
};

// Delayed init - wait for Telegram WebApp to be ready
const initWithDelay = () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        // WebApp exists, try to init
        initTelegramData();
        if (!isInitialized && tg.initData) {
            // If initDataUnsafe is empty but initData exists, wait a bit
            setTimeout(initTelegramData, 100);
        }
    } else if (isSkipTelegramAuth) {
        // Dev mode with skip auth
        telegramId = 'dev-user-id';
        telegramFirstName = 'DevUser';
        telegramUsername = 'devuser';
        telegramInitData = devInitData || 'DEV_TELEGRAM_INIT_DATA';
        isInitialized = true;
        log('DEV MODE: No Telegram WebApp, using dev ID (VITE_SKIP_TG_AUTH)');
    }
};

// Call on load with small delay to allow Telegram SDK to initialize
initWithDelay();

const getHeaders = () => {
    // Re-init if not set (component might load before Telegram)
    if (telegramInitData === null || telegramId === null) {
        initTelegramData();
    }

    // Log warning if still no Telegram ID
    if (!telegramId) {
        log('WARNING: getHeaders called but telegramId is still null!');
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Telegram-ID': telegramId || '',
        'X-Telegram-First-Name': encodeURIComponent(telegramFirstName || ''),
        'X-Telegram-Username': encodeURIComponent(telegramUsername || ''),
        'X-TG-INIT-DATA': telegramInitData || '',
    };
    return headers;
};

export const api = {
    getLogs() { return debugLogs; },

    // Get current telegram ID (for debugging)
    getTelegramId() {
        return telegramId;
    },

    // Debug info
    getDebugInfo() {
        return {
            telegramId,
            telegramFirstName,
            telegramUsername,
            telegramInitData,
            skipTelegramAuth: isSkipTelegramAuth,
            isInitialized,
            webAppExists: !!window.Telegram?.WebApp,
            initDataUnsafe: window.Telegram?.WebApp?.initDataUnsafe || null,
            logs: debugLogs
        };
    },

    // Legacy methods for compatibility
    setAccessToken(_token: string) {
        log('setAccessToken called (now using Telegram ID auth)');
    },

    getAccessToken() {
        return telegramId;
    },

    clearToken() {
        // No-op with Telegram auth
    },

    // Re-init telegram data (call after WebApp ready)
    reinitTelegram() {
        initTelegramData();
    },

    // Функция, чтобы взять заявки
    async getApplications() {
        try {
            // Стучимся в розетку
            const response = await fetch(`${API_URL}/applications/`, {
                headers: getHeaders()
            });

            if (!response.ok) {
                throw new Error('Ошибка сети');
            }

            // Превращаем ответ в понятные данные
            return await response.json();
        } catch (error) {
            console.error('Не удалось получить заявки:', error);
            return []; // Если ошибка, вернем пустой список
        }
    },

    // Получить список клиентов
    async getClients() {
        try {
            const response = await fetch(`${API_URL}/clients/`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Ошибка сети');
            return await response.json();
        } catch (error) {
            console.error('Не удалось получить клиентов:', error);
            return [];
        }
    },

    // Добавить клиента (из заявки)
    async addClient(clientId: number) {
        try {
            const response = await fetch(`${API_URL}/clients/${clientId}/add/`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Не удалось добавить клиента');
            return await response.json();
        } catch (error) {
            console.error('Ошибка при добавлении клиента:', error);
            throw error;
        }
    },

    // Удалить клиента
    async removeClient(clientId: number) {
        try {
            const response = await fetch(`${API_URL}/clients/${clientId}/`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Не удалось удалить клиента');
            return true;
        } catch (error) {
            console.error('Ошибка при удалении клиента:', error);
            throw error;
        }
    },

    // Удалить заявку (пользователя из базы)
    async deleteApplication(applicationId: number) {
        try {
            const response = await fetch(`${API_URL}/applications/${applicationId}/`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Не удалось удалить заявку');
            return true;
        } catch (error) {
            console.error('Ошибка при удалении заявки:', error);
            throw error;
        }
    },

    // Обновить статус заявки
    async updateApplicationStatus(applicationId: number, status: 'new' | 'viewed' | 'contacted') {
        try {
            const response = await fetch(`${API_URL}/applications/${applicationId}/status/`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ status })
            });
            if (!response.ok) throw new Error('Не удалось обновить статус');
            return await response.json();
        } catch (error) {
            console.error('Ошибка при обновлении статуса:', error);
            throw error;
        }
    },

    // Получить ссылку-приглашение
    async getInviteLink() {
        try {
            const response = await fetch(`${API_URL}/invite-link/`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Ошибка сети');
            const data = await response.json();
            return data.link;
        } catch (error) {
            console.error('Не удалось получить ссылку-приглашение:', error);
            return 'https://t.me/Fit_Coach_bot?start=default'; // Fallback
        }
    },

    // Аутентификация
    async authenticate(initData: string) {
        const payloadInitData = initData || telegramInitData || '';
        try {
            const response = await fetch(`${API_URL}/auth/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-TG-INIT-DATA': payloadInitData
                },
                body: JSON.stringify({ initData: payloadInitData })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Authentication failed (${response.status} ${response.statusText})`);
            }

            return await response.json();
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    },

    // --- Питание (Meals) ---

    async getMeals(date: string) {
        try {
            const response = await fetch(`/api/v1/meals/?date=${date}`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch meals');
            return await response.json();
        } catch (error) {
            console.error('Error fetching meals:', error);
            return [];
        }
    },

    async createMeal(data: any) {
        try {
            const response = await fetch(`/api/v1/meals/`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.error || `Failed to create meal (${response.status} ${response.statusText})`;
                throw new Error(errorMessage);
            }
            return await response.json();
        } catch (error) {
            console.error('Error creating meal:', error);
            throw error;
        }
    },

    async addFoodItem(mealId: number, data: any) {
        try {
            const response = await fetch(`/api/v1/meals/${mealId}/items/`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to add food item');
            return await response.json();
        } catch (error) {
            console.error('Error adding food item:', error);
            throw error;
        }
    },

    // --- Биллинг ---

    async getSubscriptionPlan() {
        try {
            const response = await fetch(`/api/v1/billing/plan`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch plan');
            return await response.json();
        } catch (error) {
            console.error('Error fetching plan:', error);
            return null;
        }
    },

    // Получить всех подписчиков (для админ панели)
    async getSubscribers() {
        try {
            const response = await fetch(`${API_URL}/subscribers/`, {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Ошибка при загрузке подписчиков');
            return await response.json();
        } catch (error) {
            console.error('Не удалось получить подписчиков:', error);
            return { subscribers: [], stats: { total: 0, free: 0, monthly: 0, yearly: 0, revenue: 0 } };
        }
    },

    // --- Профиль ---

    async getProfile() {
        try {
            const response = await fetch('/api/v1/users/profile/', {
                headers: getHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch profile');
            return await response.json();
        } catch (error) {
            console.error('Error fetching profile:', error);
            throw error;
        }
    },

    async updateProfile(data: any) {
        try {
            const response = await fetch('/api/v1/users/profile/', {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to update profile');
            return await response.json();
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    },

    // --- Цели КБЖУ ---

    async getDailyGoals() {
        try {
            const response = await fetch('/api/v1/nutrition/goals/', {
                headers: getHeaders()
            });
            if (!response.ok) {
                if (response.status === 404) return null; // No goals set yet
                throw new Error('Failed to fetch goals');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching goals:', error);
            return null;
        }
    },

    async updateGoals(data: any) {
        // Re-init telegram data before important requests
        if (telegramInitData === null) {
            initTelegramData();
        }

        const headers = getHeaders();
        log('Updating goals: ' + JSON.stringify(data));
        log('Using headers: X-Telegram-ID=' + headers['X-Telegram-ID']);

        try {
            const response = await fetch('/api/v1/nutrition/goals/', {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    calories: data.calories,
                    protein: data.protein,
                    fat: data.fat,
                    carbohydrates: data.carbohydrates,
                    source: 'MANUAL',
                    is_active: true
                })
            });

            log('Response status: ' + response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                log('Update goals error: ' + JSON.stringify(errorData));
                throw new Error(errorData.error || errorData.detail || 'Failed to update goals');
            }
            const result = await response.json();
            log('Goals updated successfully');
            return result;
        } catch (error) {
            console.error('Error updating goals:', error);
            throw error;
        }
    },

    async calculateGoals() {
        try {
            const response = await fetch('/api/v1/nutrition/goals/calculate/', {
                method: 'POST',
                headers: getHeaders()
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to calculate goals');
            }
            return await response.json();
        } catch (error) {
            console.error('Error calculating goals:', error);
            throw error;
        }
    },

    async setAutoGoals() {
        try {
            const response = await fetch('/api/v1/nutrition/goals/set-auto/', {
                method: 'POST',
                headers: getHeaders()
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to set auto goals');
            }
            return await response.json();
        } catch (error) {
            console.error('Error setting auto goals:', error);
            throw error;
        }
    },

    // --- AI распознавание еды ---

    async recognizeFood(imageBase64: string, description?: string) {
        log('Calling AI recognize endpoint');
        try {
            const response = await fetch('/api/v1/ai/recognize/', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    image: imageBase64,
                    description: description || ''
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.detail || `AI recognition failed (${response.status})`;
                log(`AI recognition error: ${errorMessage}`);
                throw new Error(errorMessage);
            }

            const result = await response.json();
            log(`AI recognized ${result.recognized_items?.length || 0} items`);
            return result;
        } catch (error) {
            console.error('AI recognition error:', error);
            throw error;
        }
    }
};

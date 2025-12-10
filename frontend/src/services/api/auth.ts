/**
 * Auth API Module
 * 
 * Handles Telegram authentication.
 */

import {
    fetchWithRetry,
    fetchWithTimeout,
    getHeaders,
    log
} from './client';
import { URLS } from './urls';
import type { TrainerPanelAuthResponse, AuthResponse } from './types';
import { TELEGRAM_BOT_NAME } from '../../config/env';

// ============================================================
// Authentication
// ============================================================

export const authenticate = async (initData: string): Promise<AuthResponse> => {
    log('Authenticating with Telegram initData');
    try {
        const response = await fetchWithRetry(URLS.auth, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData,
            },
            body: JSON.stringify({ initData }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Authentication failed (${response.status})`);
        }

        const data = await response.json();
        log(`Authenticated user: ${data.user?.telegram_id}`);
        return data;
    } catch (error) {
        console.error('Authentication error:', error);
        throw error;
    }
};

export const trainerPanelAuth = async (initData: string): Promise<TrainerPanelAuthResponse> => {
    log('Authorizing trainer panel via Telegram WebApp');

    const response = await fetchWithRetry(URLS.trainerPanelAuth, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ init_data: initData }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = (errorData as { detail?: string }).detail;
        throw new Error(detail || `Trainer panel auth failed (${response.status})`);
    }

    return response.json() as Promise<TrainerPanelAuthResponse>;
};

// ============================================================
// Telegram Admin Endpoints
// ============================================================

export const getApplications = async () => {
    try {
        const response = await fetchWithTimeout(URLS.applications, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch applications');
        return await response.json();
    } catch (error) {
        console.error('Error fetching applications:', error);
        return [];
    }
};

export const deleteApplication = async (applicationId: number) => {
    try {
        const response = await fetchWithTimeout(`${URLS.applications}${applicationId}/`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete application');
        return true;
    } catch (error) {
        console.error('Error deleting application:', error);
        throw error;
    }
};

export const updateApplicationStatus = async (applicationId: number, status: 'new' | 'viewed' | 'contacted') => {
    try {
        const response = await fetchWithTimeout(`${URLS.applications}${applicationId}/status/`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error('Failed to update status');
        return await response.json();
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
};

export const getClients = async () => {
    try {
        const response = await fetchWithTimeout(URLS.clients, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch clients');
        return await response.json();
    } catch (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
};

export const addClient = async (clientId: number) => {
    try {
        const response = await fetchWithTimeout(`${URLS.clients}${clientId}/add/`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to add client');
        return await response.json();
    } catch (error) {
        console.error('Error adding client:', error);
        throw error;
    }
};

export const removeClient = async (clientId: number) => {
    try {
        const response = await fetchWithTimeout(`${URLS.clients}${clientId}/`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to remove client');
        return true;
    } catch (error) {
        console.error('Error removing client:', error);
        throw error;
    }
};

export const getInviteLink = async () => {
    try {
        const response = await fetchWithTimeout(URLS.inviteLink, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch invite link');
        const data = await response.json();
        return data.link;
    } catch (error) {
        console.error('Error fetching invite link:', error);
        return `https://t.me/${TELEGRAM_BOT_NAME}?start=default`;
    }
};

export const getSubscribers = async () => {
    try {
        const response = await fetchWithTimeout(URLS.subscribers, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch subscribers');
        return await response.json();
    } catch (error) {
        console.error('Error fetching subscribers:', error);
        return { subscribers: [], stats: { total: 0, free: 0, monthly: 0, yearly: 0, revenue: 0 } };
    }
};

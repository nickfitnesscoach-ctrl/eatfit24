/**
 * API URL Configuration
 */

import { API_BASE } from './client';

const TRAINER_PANEL_AUTH_URL = import.meta.env.VITE_TRAINER_PANEL_AUTH_URL || '/api/v1/trainer-panel/auth/';

export const URLS = {
    // Telegram endpoints
    auth: `${API_BASE}/telegram/auth/`,
    trainerPanelAuth: TRAINER_PANEL_AUTH_URL,
    applications: `${API_BASE}/telegram/applications/`,
    clients: `${API_BASE}/telegram/clients/`,
    inviteLink: `${API_BASE}/telegram/invite-link/`,
    subscribers: `${API_BASE}/telegram/subscribers/`,
    
    // Nutrition endpoints
    meals: `${API_BASE}/meals/`,
    goals: `${API_BASE}/goals/`,
    calculateGoals: `${API_BASE}/goals/calculate/`,
    setAutoGoals: `${API_BASE}/goals/set-auto/`,
    weeklyStats: `${API_BASE}/stats/weekly/`,
    
    // User endpoints
    profile: `${API_BASE}/users/profile/`,
    uploadAvatar: `${API_BASE}/users/profile/avatar/`,
    
    // Billing endpoints
    plan: `${API_BASE}/billing/plan`,
    billingMe: `${API_BASE}/billing/me/`,
    createPayment: `${API_BASE}/billing/create-payment/`,
    cancelSubscription: `${API_BASE}/billing/cancel/`,
    resumeSubscription: `${API_BASE}/billing/resume/`,
    paymentMethods: `${API_BASE}/billing/payment-methods/`,
    subscriptionDetails: `${API_BASE}/billing/subscription/`,
    subscriptionAutoRenew: `${API_BASE}/billing/subscription/autorenew/`,
    paymentMethodDetails: `${API_BASE}/billing/payment-method/`,
    paymentsHistory: `${API_BASE}/billing/payments/`,
    bindCardStart: `${API_BASE}/billing/bind-card/start/`,
    plans: `${API_BASE}/billing/plans/`,
    
    // AI endpoints
    recognize: `${API_BASE}/ai/recognize/`,
    taskStatus: (taskId: string) => `${API_BASE}/ai/task/${taskId}/`,
};

/**
 * Centralized Environment Variables Configuration
 *
 * This module provides a single source of truth for all environment variables.
 * All code should import from this module instead of using import.meta.env directly.
 *
 * @module config/env
 */

// ============================================================
// Built-in Vite Variables (always available)
// ============================================================

/**
 * Development mode flag (true in development, false in production)
 * @constant
 */
export const IS_DEV = import.meta.env.DEV;

/**
 * Production mode flag (true in production, false in development)
 * @constant
 */
export const IS_PROD = import.meta.env.PROD;

/**
 * Current mode: 'development' | 'production'
 * @constant
 */
export const MODE = import.meta.env.MODE;

/**
 * Base URL for the application (from vite.config.js)
 * @constant
 */
export const BASE_URL = import.meta.env.BASE_URL;

// ============================================================
// API Configuration
// ============================================================

/**
 * Base URL for backend API
 * Default: /api/v1 (works with both Vite proxy in dev and nginx in prod)
 * @constant
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Trainer panel authentication URL
 * Default: /api/v1/trainer-panel/auth/
 * @constant
 */
export const TRAINER_PANEL_AUTH_URL =
  import.meta.env.VITE_TRAINER_PANEL_AUTH_URL || '/api/v1/trainer-panel/auth/';

// ============================================================
// Telegram Configuration
// ============================================================

/**
 * Telegram bot name (used for generating Telegram links)
 * First tries to get from Telegram WebApp SDK, then from env, finally defaults to EatFit24_bot
 * @constant
 */
const tgBotUsername =
  (window as any)?.Telegram?.WebApp?.initDataUnsafe?.bot?.username;

export const TELEGRAM_BOT_NAME =
  tgBotUsername ||
  import.meta.env.VITE_TELEGRAM_BOT_NAME ||
  'EatFit24_bot';

/**
 * Trainer invite link (shown on invite client page)
 * Default: Generated from TELEGRAM_BOT_NAME
 * @constant
 */
export const TRAINER_INVITE_LINK =
  import.meta.env.VITE_TRAINER_INVITE_LINK ||
  `https://t.me/${TELEGRAM_BOT_NAME}`;

// ============================================================
// Development Flags (only active in development mode)
// ============================================================

/**
 * Mock Telegram WebApp API (for browser testing without Telegram)
 * Only works in development mode
 * Set VITE_MOCK_TELEGRAM=1 to enable
 * @constant
 */
export const MOCK_TELEGRAM = IS_DEV && import.meta.env.VITE_MOCK_TELEGRAM === '1';

/**
 * Skip Telegram authentication check
 * Only works in development mode
 * Set VITE_SKIP_TG_AUTH=true to enable
 * @constant
 */
export const SKIP_TG_AUTH = IS_DEV && import.meta.env.VITE_SKIP_TG_AUTH === 'true';

// ============================================================
// Runtime Validation
// ============================================================

/**
 * Validate critical environment variables in production
 * Logs warnings if required variables are missing
 */
function validateEnv(): void {
  if (IS_PROD) {
    const criticalVars = {
      API_BASE_URL,
      TELEGRAM_BOT_NAME,
      TRAINER_INVITE_LINK,
    };

    Object.entries(criticalVars).forEach(([name, value]) => {
      if (!value || value === 'undefined') {
        console.warn(`⚠️ [ENV] Critical variable ${name} is not set in production!`);
      }
    });
  }
}

// Run validation on module load
validateEnv();

// ============================================================
// Debug Helper (development only)
// ============================================================

/**
 * Print all environment variables to console (development only)
 * Useful for debugging environment configuration
 */
export function debugEnv(): void {
  if (IS_DEV) {
    console.group('🔧 Environment Configuration');
    console.log('Mode:', MODE);
    console.log('IS_DEV:', IS_DEV);
    console.log('IS_PROD:', IS_PROD);
    console.log('BASE_URL:', BASE_URL);
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('TRAINER_PANEL_AUTH_URL:', TRAINER_PANEL_AUTH_URL);
    console.log('TELEGRAM_BOT_NAME:', TELEGRAM_BOT_NAME);
    console.log('TRAINER_INVITE_LINK:', TRAINER_INVITE_LINK);
    console.log('MOCK_TELEGRAM:', MOCK_TELEGRAM);
    console.log('SKIP_TG_AUTH:', SKIP_TG_AUTH);
    console.groupEnd();
  }
}

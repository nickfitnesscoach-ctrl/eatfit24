/**
 * Centralized Debug Configuration for EatFit24
 *
 * This module provides a single source of truth for debug mode detection.
 *
 * Debug mode behavior:
 * - DEV build (localhost): Always enabled, mock Telegram API active
 * - PROD build with ?debug=1: Enabled for service owner testing
 * - PROD build without ?debug=1: Completely disabled, no mock, no banner
 *
 * Security:
 * - In production, debug mode requires explicit ?debug=1 URL parameter
 * - Mock Telegram API only initializes when debug is active
 * - Debug banner only renders when debug is active
 */

// Check URL parameters for debug flag
const searchParams = new URLSearchParams(window.location.search);

/**
 * Initialize debug mode with sessionStorage persistence
 * This allows debug mode to survive URL redirects/changes
 */
function initDebugMode(): boolean {
  // Always enable in DEV
  if (import.meta.env.DEV) {
    sessionStorage.setItem('eatfit24_debug', 'true');
    return true;
  }

  // Check URL parameter first (explicit debug activation)
  if (searchParams.has("debug")) {
    sessionStorage.setItem('eatfit24_debug', 'true');
    return true;
  }

  // Check if debug was enabled in this session (survives redirects)
  const sessionDebug = sessionStorage.getItem('eatfit24_debug');
  if (sessionDebug === 'true') {
    return true;
  }

  return false;
}

/**
 * Main debug flag - determines if debug mode is active
 *
 * TRUE when:
 * - Running in DEV environment (import.meta.env.DEV)
 * - OR URL contains ?debug=1 parameter (production debug access)
 * - OR debug was activated in this browser session (survives redirects)
 *
 * FALSE when:
 * - Production build without ?debug=1 parameter
 * - AND no active debug session
 */
export const IS_DEBUG = initDebugMode();

/**
 * Debug user configuration for mock Telegram API
 * Used when IS_DEBUG is true
 */
export const DEBUG_USER = {
  id: 999999999,
  first_name: 'Debug',
  last_name: 'User',
  username: 'eatfit24_debug',
  language_code: 'ru',
  is_premium: false,
} as const;

/**
 * Debug token for backend authentication
 * Backend recognizes this via X-Debug-Mode header
 */
export const DEBUG_TOKEN = 'DEBUG_LOCAL_TOKEN';

/**
 * Check if mock Telegram API should be initialized
 */
export function shouldInitMockTelegram(): boolean {
  // Only init mock if debug is enabled AND no real Telegram WebApp exists
  return IS_DEBUG && !window.Telegram?.WebApp;
}

/**
 * Check if debug banner should be displayed
 */
export function shouldShowDebugBanner(): boolean {
  return IS_DEBUG;
}

/**
 * Get debug info for logging
 */
export function getDebugInfo() {
  return {
    isDebug: IS_DEBUG,
    isDev: import.meta.env.DEV,
    hasDebugParam: searchParams.has("debug"),
    hasTelegram: Boolean(window.Telegram?.WebApp),
    shouldMock: shouldInitMockTelegram(),
  };
}

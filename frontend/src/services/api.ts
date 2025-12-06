/**
 * API клиент для FoodMind WebApp
 * 
 * REFACTORED: Теперь используется модульная структура в ./api/
 * Этот файл обеспечивает обратную совместимость.
 * 
 * Новый способ импорта (рекомендуется):
 *   import { nutrition, billing, ai } from '../services/api';
 *   await nutrition.getMeals(date);
 * 
 * Старый способ (поддерживается):
 *   import { api } from '../services/api';
 *   await api.getMeals(date);
 */

// Re-export everything from modular API
export * from './api/index';

// Also export the default api object
export { api as default } from './api/index';

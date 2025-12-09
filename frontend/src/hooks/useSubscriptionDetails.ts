import { useState, useMemo } from 'react';
import { useBilling } from '../contexts/BillingContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { formatShortDate } from '../utils/date';
import { SubscriptionDetails } from '../types/billing';

interface UseSubscriptionDetailsResult {
  subscription: SubscriptionDetails | null;
  isPro: boolean;
  expiresAtFormatted: string;
  autoRenewEnabled: boolean;
  autoRenewAvailable: boolean;
  hasCard: boolean;
  cardInfoLabel: string;

  isAdmin: boolean;
  testLivePaymentAvailable: boolean;
  togglingAutoRenew: boolean;
  creatingTestPayment: boolean;

  handleToggleAutoRenew: () => Promise<void>;
  handlePaymentMethodClick: () => Promise<void>;
  handleCreateTestPayment: () => Promise<void>;
}

/**
 * Custom hook for managing subscription details page logic
 * Encapsulates all business logic for subscription management
 */
export const useSubscriptionDetails = (): UseSubscriptionDetailsResult => {
  const billing = useBilling();
  const auth = useAuth();

  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [creatingTestPayment, setCreatingTestPayment] = useState(false);

  const subscription = billing.subscription;

  // Computed values
  const isPro = subscription?.plan === 'pro';
  const expiresAt = subscription?.expires_at ?? null;
  const expiresAtFormatted = formatShortDate(expiresAt);
  const autoRenewEnabled = subscription?.autorenew_enabled ?? false;
  const autoRenewAvailable = subscription?.autorenew_available ?? false;
  const paymentMethod = subscription?.payment_method;
  const hasCard = paymentMethod?.is_attached ?? false;

  const isAdmin = auth.isAdmin ?? false;
  const testLivePaymentAvailable = billing.billingMe?.test_live_payment_available ?? false;

  /**
   * Show alert using Telegram WebApp or fallback to browser alert
   */
  const showToast = (message: string): void => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(message);
    } else {
      alert(message);
    }
  };

  /**
   * Format card info label for display
   */
  const cardInfoLabel = useMemo(() => {
    if (!hasCard || !paymentMethod) {
      return 'Карта не привязана';
    }

    const mask = paymentMethod.card_mask || '••••';
    const brand = paymentMethod.card_brand || 'Card';
    return `${mask} · ${brand}`;
  }, [hasCard, paymentMethod]);

  /**
   * Toggle auto-renew subscription
   */
  const handleToggleAutoRenew = async (): Promise<void> => {
    if (togglingAutoRenew) return;

    if (!autoRenewAvailable) {
      showToast("Привяжите карту для включения автопродления");
      return;
    }

    try {
      setTogglingAutoRenew(true);
      await billing.setAutoRenew(!autoRenewEnabled);
      showToast(autoRenewEnabled ? "Автопродление отключено" : "Автопродление включено");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Не удалось изменить настройки";
      showToast(message);
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  /**
   * Handle payment method click - bind card or show message
   */
  const handlePaymentMethodClick = async (): Promise<void> => {
    if (!hasCard) {
      try {
        await billing.addPaymentMethod();
      } catch (error) {
        // Try to parse structured error response
        let errorMessage = "Ошибка при запуске привязки карты";
        try {
          const errorData = JSON.parse((error as Error).message);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If not JSON, use message as is
          errorMessage = (error as Error).message || errorMessage;
        }
        showToast(errorMessage);
      }
    } else {
      showToast("Смена карты будет доступна позже");
    }
  };

  /**
   * Create test payment (admin only)
   */
  const handleCreateTestPayment = async (): Promise<void> => {
    if (creatingTestPayment) return;

    try {
      setCreatingTestPayment(true);
      await api.createTestLivePayment();
      // Redirect handled by api method
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка при создании тестового платежа';
      showToast(message);
    } finally {
      setCreatingTestPayment(false);
    }
  };

  return {
    subscription,
    isPro,
    expiresAtFormatted,
    autoRenewEnabled,
    autoRenewAvailable,
    hasCard,
    cardInfoLabel,
    isAdmin,
    testLivePaymentAvailable,
    togglingAutoRenew,
    creatingTestPayment,
    handleToggleAutoRenew,
    handlePaymentMethodClick,
    handleCreateTestPayment,
  };
};

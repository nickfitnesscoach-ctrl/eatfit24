# ERROR HANDLING — Billing Feature Module

> Стратегия обработки ошибок в модуле биллинга.

---

## Коды ошибок API

| Код | Сообщение (RU) | Обработка |
|-----|----------------|-----------|
| `DAILY_LIMIT_REACHED` | Дневной лимит фото исчерпан | Показать модалку с предложением PRO |
| `NO_SUBSCRIPTION` | Подписка не найдена | Показать toast, redirect на /subscription |
| `INVALID_PLAN` | Выбранный тариф недоступен | Показать toast, обновить список планов |
| `PAYMENT_ERROR` | Ошибка при создании платежа | Показать toast с деталями |
| `NO_PAYMENT_METHOD` | Привяжите карту для автопродления | Предложить привязать карту |
| `NOT_AVAILABLE_FOR_FREE` | Функция доступна только в PRO | Upsell на PRO |
| `ACTIVE_SUBSCRIPTION` | У вас уже есть активная подписка | Показать toast |

---

## Где показываются уведомления

### showToast() — Telegram / Browser

Все уведомления унифицированы через `utils/notify.ts`:

```typescript
import { showToast } from '../utils/notify';

// Использование
showToast("Автопродление включено");
showToast("Ошибка при создании платежа");
```

**Реализация:**
- Telegram WebApp: `Telegram.WebApp.showAlert(message)`
- Desktop/fallback: `window.alert(message)`

### Где вызывается

| Файл | Сценарии |
|------|----------|
| `useSubscriptionActions.ts` | Ошибки оплаты, toggle autorenew, добавление карты |
| `useSubscriptionDetails.ts` | Ошибки toggle, карты, тестового платежа |

---

## Политика unknown plan_code

### Проблема

API может вернуть неизвестный `plan_code` при рассинхронизации фронт/бэк.

### Решение

`validatePlanCode()` в `utils/validation.ts`:

```typescript
export function validatePlanCode(planCode: unknown): BillingPlanCode {
    if (assertBillingPlanCode(planCode)) {
        return planCode;
    }
    
    const message = `Unknown plan_code received from API: ${planCode}`;
    
    if (IS_DEV) {
        console.error(`[Billing] ${message}`);
        alert(`DEV Warning: ${message}`);  // Явное уведомление разработчику
    } else {
        console.warn(`[Billing] ${message}, falling back to FREE`);
    }
    
    return 'FREE';  // Безопасный fallback
}
```

### Поведение

| Режим | Действие |
|-------|----------|
| **DEV** | `console.error` + `alert()` — разработчик сразу видит проблему |
| **PROD** | `console.warn` + fallback на `FREE` — пользователь не видит ошибку |

---

## Обработка сетевых ошибок

### В API-модуле

```typescript
// api/billing.ts
try {
    const response = await fetchWithRetry(url, options);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to fetch');
    }
    return response.json();
} catch (error) {
    console.error('Error:', error);
    throw error;
}
```

### В хуках

```typescript
try {
    await api.createPayment({ plan_code });
} catch (error) {
    const errorMessage = error instanceof Error 
        ? error.message 
        : "Ошибка при оформлении подписки";
    showToast(errorMessage);
}
```

---

## Обработка DAILY_LIMIT_REACHED

### В FoodLogPage (вне модуля billing)

```typescript
// useFoodBatchAnalysis.ts
if (error.code === 'DAILY_LIMIT_REACHED') {
    onDailyLimitReached?.();  // callback
}

// FoodLogPage.tsx
const [showLimitModal, setShowLimitModal] = useState(false);

// Modal с кнопкой "Оформить PRO"
<button onClick={() => navigate('/subscription')}>
    Оформить PRO
</button>
```

---

## Graceful Degradation

1. **API недоступен** → показать cached данные (если есть) + toast
2. **Telegram WebApp недоступен** → использовать `window.alert()`
3. **Неизвестный plan_code** → fallback на FREE
4. **Ошибка платежа** → показать сообщение, не ломать UI

# 📜 EatFit24 API Contracts

> **Тип:** Приложение к AUDIT.md  
> **Дата:** 2025-12-24  
> **Scope:** AI / Nutrition / Telegram / Billing touchpoints

---

## 1. AI Recognition Contract

### POST /api/v1/ai/recognize/

**Request:**
```
Content-Type: multipart/form-data OR application/json

# Option 1: File upload
image: <binary file>
meal_type?: BREAKFAST | LUNCH | DINNER | SNACK (default: SNACK)
date?: YYYY-MM-DD (default: today)
user_comment?: string (max 500 chars)

# Option 2: Data URL
data_url: data:image/jpeg;base64,...
meal_type?: ...
date?: ...
user_comment?: ...
```

**Response 202 (Accepted — async mode):**
```json
{
  "task_id": "abc123-uuid",
  "meal_id": 42,
  "status": "processing"
}
```

**Response Header:**
```
X-Request-ID: <uuid>
```

**⚠️ РАСХОЖДЕНИЕ:** `meal_type` принимается в UPPERCASE, но некоторые клиенты могут отправлять lowercase.

---

### GET /api/v1/ai/task/{task_id}/

**Response 200 (Processing):**
```json
{
  "task_id": "abc123-uuid",
  "status": "processing",
  "state": "PENDING" | "STARTED" | "RETRY"
}
```

**Response 200 (Success):**
```json
{
  "task_id": "abc123-uuid",
  "status": "success",
  "state": "SUCCESS",
  "result": {
    "meal_id": 42,
    "items": [
      {
        "name": "Куриная грудка",
        "amount_grams": 150,     // ⚠️ API contract field
        "calories": 165.0,
        "protein": 31.0,
        "fat": 3.6,
        "carbohydrates": 0.0,
        "confidence": 0.95
      }
    ],
    "total_calories": 165.0,
    "totals": {
      "calories": 165.0,
      "protein": 31.0,
      "fat": 3.6,
      "carbohydrates": 0.0
    },
    "meta": {
      "request_id": "...",
      "model_notes": null
    }
  }
}
```

**Response 200 (Failed):**
```json
{
  "task_id": "abc123-uuid",
  "status": "failed",
  "state": "FAILURE",
  "error": "AI processing failed"
}
```

**⚠️ РАСХОЖДЕНИЕ:** 
- `items[].amount_grams` в response, но БД хранит `grams`
- Ошибка не содержит машиночитаемый код (только `error` string)

---

## 2. Billing Contract

### GET /api/v1/billing/me/

**Response 200:**
```json
{
  "plan_code": "FREE" | "PRO_MONTHLY" | "PRO_YEARLY",
  "plan_name": "Бесплатный",
  "is_active": true,
  "end_date": null | "2025-01-18",
  "daily_photo_limit": 3 | null,
  "used_today": 2,
  "remaining_today": 1 | null
}
```

**⚠️ РАСХОЖДЕНИЕ:** Документация говорит про `remaining_today`, но реализация может отличаться — **UNKNOWN**, нужна проверка `BillingMeView`.

---

### GET /api/v1/billing/plans/

**Response 200:**
```json
[
  {
    "code": "FREE",
    "name": "FREE",
    "display_name": "Бесплатный",
    "price": 0,
    "duration_days": 0,
    "daily_photo_limit": 3,
    "features": {...}
  },
  {
    "code": "PRO_MONTHLY",
    "name": "PRO Месяц",
    "display_name": "PRO на месяц",
    "price": 299.00,
    "duration_days": 30,
    "daily_photo_limit": null,
    "features": {...}
  }
]
```

---

### POST /api/v1/billing/payments/

**Request:**
```json
{
  "plan_code": "PRO_MONTHLY",
  "return_url": "https://app.eatfit24.ru/billing/success"  // optional
}
```

**Response 201:**
```json
{
  "payment_id": 123,
  "yookassa_payment_id": "2c...",
  "confirmation_url": "https://yoomoney.ru/checkout/...",
  "status": "PENDING"
}
```

**⚠️ Security:** `amount` НЕ принимается от клиента — берётся из `SubscriptionPlan.price`.

---

### POST /api/v1/billing/yookassa/webhook/

**Request (from YooKassa):**
```json
{
  "type": "notification",
  "event": "payment.succeeded" | "payment.canceled" | "refund.succeeded",
  "object": {
    "id": "2c...",
    "status": "succeeded",
    "amount": {"value": "299.00", "currency": "RUB"},
    "payment_method": {
      "id": "pm_...",
      "card": {"last4": "4242", "card_type": "Visa"}
    }
  }
}
```

**Response:**
- `200 OK` — всегда (даже при ошибках обработки)
- `400 Bad Request` — невалидный JSON
- `403 Forbidden` — IP не в allowlist

---

## 3. Nutrition Contract

### GET /api/v1/meals/?date=YYYY-MM-DD

**Response 200:**
```json
{
  "date": "2025-12-24",
  "daily_goal": {
    "calories": 2000,
    "protein": 150.0,
    "fat": 60.0,
    "carbohydrates": 200.0
  },
  "total_consumed": {
    "calories": 1500.0,
    "protein": 120.0,
    "fat": 45.0,
    "carbohydrates": 150.0
  },
  "progress": {
    "calories": 75.0,
    "protein": 80.0,
    "fat": 75.0,
    "carbohydrates": 75.0
  },
  "meals": [
    {
      "id": 42,
      "meal_type": "BREAKFAST",
      "date": "2025-12-24",
      "photo": "/media/meals/...",
      "items": [
        {
          "id": 1,
          "name": "Омлет",
          "grams": 200,        // ⚠️ "grams" not "amount_grams"
          "calories": 220.0,
          "protein": 18.0,
          "fat": 16.0,
          "carbohydrates": 2.0
        }
      ],
      "total_calories": 220.0
    }
  ]
}
```

**⚠️ РАСХОЖДЕНИЕ:** 
- AI возвращает `amount_grams`, Nutrition API возвращает `grams`
- Frontend должен mapper'ить оба варианта

---

## 4. Telegram Auth Contract

### Header: X-Telegram-Init-Data

**Format:** URL-encoded string from Telegram WebApp

```
auth_date=1703424000&hash=...&query_id=...&user=%7B%22id%22%3A123456789%2C...%7D
```

**Validation:**
1. Parse URL params
2. Compute HMAC-SHA256 with bot token
3. Compare with `hash`
4. Check `auth_date` freshness (< 24h by default)

**⚠️ Security:** `DEBUG_MODE_ENABLED` bypass существует — см. P1-5 в Risk Register.

---

## 5. Error Response Contract

### Machine-Readable Errors

**Expected format (per INVARIANTS):**
```json
{
  "error": "LIMIT_EXCEEDED",
  "code": "DAILY_PHOTO_LIMIT",
  "message": "Вы исчерпали дневной лимит",
  "details": {
    "limit": 3,
    "used": 3,
    "remaining": 0
  }
}
```

**Actual format (current):**
```json
{
  "detail": "Throttled. Expected available in 86400 seconds."
}
```

**⚠️ РАСХОЖДЕНИЕ:** Ошибки лимитов не машиночитаемы. Frontend не может показать user-friendly сообщение.

---

## 6. AI Proxy Contract (Internal)

### POST /api/v1/ai/recognize-food

**Request:**
```
Content-Type: multipart/form-data
Headers:
  X-API-Key: <AI_PROXY_SECRET>
  X-Request-ID: <uuid>

Body:
  image: <binary>
  locale: "ru" | "en"
  user_comment?: string
```

**Response 200:**
```json
{
  "items": [
    {
      "food_name_ru": "Куриная грудка",
      "food_name_en": "Chicken breast",
      "portion_weight_g": 150,
      "calories": 165,
      "protein_g": 31.0,
      "fat_g": 3.6,
      "carbs_g": 0.0,
      "confidence": 0.95
    }
  ],
  "total": {
    "calories": 165,
    "protein_g": 31.0,
    "fat_g": 3.6,
    "carbs_g": 0.0
  },
  "model_notes": null
}
```

**Error Responses:**
- `400/422/429` — Validation error (no retry)
- `401/403` — Auth error (no retry)
- `5xx` — Server error (retry with backoff)
- `Timeout` — Retry with backoff

---

## Summary: Расхождения

| Area | Expected (Docs) | Actual (Code) | Impact |
|------|-----------------|---------------|--------|
| AI items | `grams` | `amount_grams` | Frontend mapping |
| Nutrition items | `grams` | `grams` | ✅ OK |
| Error codes | Machine-readable | Text strings | UX degraded |
| Limit check | Before Meal creation | After Meal creation | Orphan Meals |
| meal_type | Case-insensitive | UPPERCASE only | Potential 400 |

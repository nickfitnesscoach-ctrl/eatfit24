# Trainer API — Эндпоинты и контракты

> **Frozen state:** 2025-12-15  
> Документация отражает текущую реализацию `services/api/trainer.ts`.

---

## Источник истины

**Файл:** `services/api/trainer.ts`

```typescript
// ✅ Канон импорта
import { api } from '../services/api';
```

---

## Эндпоинты

### Applications (Заявки)

| Метод | Функция | Endpoint |
|-------|---------|----------|
| GET | `api.getApplications()` | `/api/v1/trainer/applications/` |
| PATCH | `api.updateApplicationStatus(id, status)` | `/api/v1/trainer/applications/{id}/` |
| DELETE | `api.deleteApplication(id)` | `/api/v1/trainer/applications/{id}/` |

### Clients (Клиенты)

| Метод | Функция | Endpoint |
|-------|---------|----------|
| GET | `api.getClients()` | `/api/v1/trainer/clients/` |
| POST | `api.addClient(applicationId)` | `/api/v1/trainer/clients/` |
| DELETE | `api.removeClient(clientId)` | `/api/v1/trainer/clients/{id}/` |

### Invite Links

| Метод | Функция | Endpoint |
|-------|---------|----------|
| GET | `api.getInviteLink()` | `/api/v1/trainer/invite/` |

### Subscribers

| Метод | Функция | Endpoint |
|-------|---------|----------|
| GET | `api.getSubscribers()` | `/api/v1/trainer/subscribers/` |

---

## Типы статусов

### Backend статусы

```typescript
type ApplicationStatusApi = 'new' | 'viewed' | 'contacted';
```

**Backend возвращает только эти три статуса.**

### UI статусы

```typescript
type ApplicationStatusUi = ApplicationStatusApi | 'client';
```

> **Важно:** Статус `'client'` — **только UI**. Backend его никогда не возвращает и не принимает.

---

## Типы ответов

### ApplicationResponse

```typescript
interface ApplicationResponse {
    id: number;
    telegram_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    status: ApplicationStatusApi;  // 'new' | 'viewed' | 'contacted'
    created_at: string;
    details: ClientDetailsApi;
}
```

### ClientDetailsApi

```typescript
interface ClientDetailsApi {
    age?: number;
    gender?: 'male' | 'female';
    height?: number;
    weight?: number;
    target_weight?: number;
    activity_level?: string;
    training_level?: string;
    goals?: string[];
    health_restrictions?: string[];
    current_body_type?: number;
    ideal_body_type?: number;
    timezone?: string;
    diet_type?: string;
    meals_per_day?: number;
    allergies?: string[] | string;
    disliked_food?: string;
    supplements?: string;
}
```

---

## Примеры использования

### Загрузка заявок

```typescript
import { api } from '../services/api';
import type { ApplicationResponse } from '../features/trainer-panel/types';

const data = await api.getApplications() as ApplicationResponse[];
```

### Обновление статуса

```typescript
await api.updateApplicationStatus(applicationId, 'contacted');
```

### Добавление клиента

```typescript
await api.addClient(applicationId);
```

---

## Deprecated

> ⚠️ **Будет удалено в v2.0**

В `services/api/auth.ts` есть re-export trainer методов для обратной совместимости:

```typescript
// ❌ Deprecated — не использовать
export {
    getApplications,
    deleteApplication,
    updateApplicationStatus,
    // ...
} from './trainer';
```

**Канон:** импортировать через `api` объект, не из `auth.ts`.

---

## Аутентификация

Все trainer-эндпоинты требуют заголовок:

```
X-Telegram-Init-Data: <initData>
```

Аутентификация тренера:

```typescript
await api.trainerPanelAuth(initData);
// POST /api/v1/auth/trainer/
// Body: { init_data: initData }
```

# Trainer Panel — Архитектурный канон

> **Frozen state:** 2025-12-15  
> Документация отражает текущий код после рефакторинга.

---

## Архитектура данных

```
Backend API
     ↓
services/api/* (fetch, raw response)
     ↓
hooks / contexts (data transformation)
     ↓
UI components (consume UI-ready data)
```

### Ключевой принцип

**Backend API возвращает сырые данные → хуки/контексты трансформируют → UI компоненты получают готовые данные.**

| Слой | Типы | Ответственность |
|------|------|-----------------|
| API | `ApplicationResponse`, `ClientDetailsApi` | Fetch + передача сырых данных |
| Transform | `mapDetailsApiToUi()`, `mapApplicationFromApi()` | Преобразование API → UI |
| UI | `Application`, `ClientDetailsUi` | Отображение готовых данных |

---

## Типы (SSOT)

**Источник истины:** `features/trainer-panel/types/`

### Status Types

```typescript
// Backend возвращает ТОЛЬКО эти статусы
type ApplicationStatusApi = 'new' | 'viewed' | 'contacted';

// UI добавляет 'client' (никогда не отправляется на backend)
type ApplicationStatusUi = ApplicationStatusApi | 'client';
```

> **Важно:** Backend **НИКОГДА** не возвращает `'client'`. Этот статус устанавливается локально в `ClientsContext` когда заявка конвертируется в клиента.

### Details Types

```typescript
// Сырые данные с backend
interface ClientDetailsApi {
    gender?: 'male' | 'female';
    health_restrictions?: string[];
    current_body_type?: number;
    // ...
}

// После трансформации для UI
interface ClientDetailsUi {
    gender?: string;        // "Мужской" / "Женский"
    limitations: string[];  // Локализованные ограничения
    body_type?: BodyTypeInfo;  // { id, description, image_url }
    // ...
}
```

### Application Types

```typescript
// API response (строгий статус)
interface ApplicationResponse {
    status: ApplicationStatusApi;
    details: ClientDetailsApi;
    // ...
}

// UI model (расширенный статус)
interface Application {
    status?: ApplicationStatusUi;
    details: ClientDetailsUi;
    date?: string;  // UI-formatted
    // ...
}
```

---

## Import Policy

### Типы

```typescript
// ✅ Канон — из features/trainer-panel/types
import type { Application, ClientDetailsUi } from '../features/trainer-panel/types';

// ✅ Внутри feature — относительный путь
import type { Application } from '../types';
```

### API

```typescript
// ✅ Канон — через api объект
import { api } from '../services/api';
await api.getApplications();

// ❌ Запрещено — импорт из auth.ts
import { getApplications } from '../services/api/auth';
```

---

## Трансформация данных

### Где происходит

| Файл | Что делает |
|------|------------|
| `hooks/useApplications.ts` | `mapApplicationFromApi()` — API → UI для заявок |
| `contexts/ClientsContext.tsx` | Трансформация клиентов при загрузке |

### Что трансформируется

| API поле | UI поле | Пример |
|----------|---------|--------|
| `gender: 'male'` | `gender: 'Мужской'` | Локализация |
| `health_restrictions[]` | `limitations[]` | Переименование + локализация |
| `current_body_type: 3` | `body_type: { id, description, image_url }` | Обогащение данных |
| `created_at` | `date` | Форматирование даты |

---

## Структура feature

```
features/trainer-panel/
├── components/
│   ├── applications/     # Карточки и детали заявок
│   └── clients/          # Карточки и детали клиентов
├── constants/            # Маппинги (ACTIVITY_MAP, GOALS_MAP, etc.)
├── docs/                 # Эта документация
├── hooks/                # useApplications, useClientsList
├── pages/                # ApplicationsPage, ClientsPage
└── types/                # SSOT для типов
    ├── application.ts    # Все интерфейсы
    └── index.ts          # Re-export
```

---

## Правила для разработчиков

1. **Типы** — импортировать только из `features/trainer-panel/types`
2. **API** — использовать `api.method()`, не прямые импорты из `auth.ts`
3. **Трансформация** — происходит в хуках/контекстах, не в компонентах
4. **Статус `client`** — существует только в UI, backend его не знает
5. **UI компоненты** — получают только `Application` с `ClientDetailsUi`

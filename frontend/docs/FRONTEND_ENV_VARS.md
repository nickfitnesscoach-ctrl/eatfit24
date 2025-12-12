# Frontend Environment Variables Audit

## Executive Summary

Текущее состояние: беспорядок в env-файлах. Есть устаревшие переменные, захардкоженные значения, и переменные, которые не используются.

**Проблемы:**
1. Захардкоженная ссылка `TRAINER_INVITE_LINK` в коде вместо env-переменной
2. `process.env.NODE_ENV` используется в компоненте (несовместимо с Vite)
3. Неиспользуемые переменные в env-файлах
4. Отсутствие централизованного модуля для работы с env

## Current Environment Variables Usage

### Активно используемые переменные

| Переменная | Где используется | Назначение | Dev | Prod | Статус |
|------------|------------------|------------|-----|------|--------|
| `VITE_API_URL` | `services/api/client.ts:17`<br>`services/api/urls.ts:5` | Базовый URL для API | `/api/v1` | `/api/v1` | ✅ Используется |
| `import.meta.env.DEV` | `shared/config/debug.ts:25,61`<br>`hooks/useSubscriptionPlans.ts:22`<br>`components/BatchResultsModal.tsx:58` | Определение dev-режима (Vite встроенная) | `true` | `false` | ✅ Используется |
| `import.meta.env.PROD` | `shared/config/debug.ts` (косвенно) | Определение prod-режима (Vite встроенная) | `false` | `true` | ✅ Используется |
| `VITE_TRAINER_PANEL_AUTH_URL` | `services/api/urls.ts:7` | URL для авторизации тренерской панели | `/api/v1/trainer-panel/auth/` | `/api/v1/trainer-panel/auth/` | ⚠️ Используется с fallback |

### Переменные в env-файлах, но НЕ используемые в коде

| Переменная | В каких env | Назначение (по комментариям) | Статус |
|------------|-------------|------------------------------|--------|
| `VITE_TELEGRAM_BOT_NAME` | `.env.development`<br>`.env.production`<br>`.env.example` | Имя Telegram бота | ❌ Не используется |
| `VITE_WEBAPP_URL` | `.env.development`<br>`.env.production`<br>`.env.example` | URL Telegram WebApp | ❌ Не используется |
| `VITE_SKIP_TG_AUTH` | `.env.development`<br>`.env.example` | Пропуск Telegram аутентификации | ❌ Не используется |
| `VITE_DEV_TG_INIT_DATA` | `.env.development`<br>`.env.example` | Фейковые данные для разработки | ❌ Не используется |
| `VITE_ENV` | `.env.development`<br>`.env.production`<br>`.env.example` | Окружение | ❌ Не используется (дубль `import.meta.env.MODE`) |
| `VITE_WEB_DEBUG_ENABLED` | `.env.development`<br>`.env.example` | Режим отладки в браузере | ❌ Не используется |

### Проблемы в коде

| Проблема | Файл | Строка | Решение |
|----------|------|--------|---------|
| Использование `process.env.NODE_ENV` | `components/billing/AdminTestPaymentCard.tsx` | 48 | Заменить на `import.meta.env.MODE` |
| Захардкоженная ссылка | `constants/invite.ts` | 5 | Вынести в env как `VITE_TRAINER_INVITE_LINK` |

## Recommended Environment Variables Structure

### Минимальный набор переменных

#### 1. API Configuration
```bash
# Базовый URL для backend API
# Dev: используется относительный путь для Vite proxy
# Prod: используется относительный путь (nginx reverse proxy)
VITE_API_URL=/api/v1
```

#### 2. Telegram Configuration (если нужно в будущем)
```bash
# Имя Telegram бота (для формирования ссылок)
VITE_TELEGRAM_BOT_NAME=EatFit24_bot

# URL приглашения тренера (для страницы приглашения клиентов)
VITE_TRAINER_INVITE_LINK=https://t.me/EatFit24_bot
```

#### 3. Debug/Development Flags (только для dev)
```bash
# Включить моки Telegram WebApp (только dev)
VITE_MOCK_TELEGRAM=1

# Пропустить Telegram аутентификацию (только dev)
VITE_SKIP_TG_AUTH=true
```

## Migration Plan

### Phase 1: Cleanup (Immediate)
1. ✅ Создать `src/config/env.ts` - централизованный модуль для работы с env
2. ✅ Удалить неиспользуемые переменные из env-файлов
3. ✅ Заменить `process.env.NODE_ENV` на `import.meta.env.MODE`
4. ✅ Вынести `TRAINER_INVITE_LINK` в env

### Phase 2: Refactoring (Next)
1. Заменить все прямые обращения к `import.meta.env.*` на импорты из `src/config/env.ts`
2. Добавить TypeScript типизацию для env
3. Добавить валидацию обязательных переменных при старте приложения

### Phase 3: Documentation (Final)
1. Обновить `.env.example` с актуальными переменными и комментариями
2. Обновить `.env.development` и `.env.production`
3. Проверить `.gitignore`

## Environment Files Strategy

### `.env.development` (для локальной разработки)
- Относительные пути для API (для работы с Vite proxy)
- Debug-флаги включены
- Моки Telegram включены
- **Не коммитится в git**

### `.env.production` (для production сборки)
- Относительные пути для API (nginx reverse proxy)
- Без debug-флагов
- Без моков
- **Не коммитится в git**

### `.env.example` (шаблон)
- Только ключи переменных с комментариями
- Без реальных значений/секретов
- **Коммитится в git**

## Built-in Vite Environment Variables

Vite предоставляет встроенные переменные, которые НЕ нужно определять в env-файлах:

| Переменная | Значение | Когда |
|------------|----------|-------|
| `import.meta.env.MODE` | `'development'` \| `'production'` | Режим сборки |
| `import.meta.env.DEV` | `boolean` | `true` в dev-режиме |
| `import.meta.env.PROD` | `boolean` | `true` в prod-режиме |
| `import.meta.env.BASE_URL` | `string` | Базовый URL приложения (из `vite.config.js`) |

## Notes

- Все переменные для Vite **ДОЛЖНЫ** начинаться с `VITE_`
- Переменные без префикса `VITE_` НЕ будут доступны в клиентском коде
- `process.env.*` **НЕ работает** в Vite (только в Node.js окружении)
- Используйте `import.meta.env.*` для доступа к переменным окружения

## Changelog

- **2025-12-10**: Initial audit and documentation

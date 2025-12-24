# EatFit24 Bot Audit Report

> **Дата аудита**: 2025-12-24  
> **Статус**: ✅ **SQLAlchemy/Alembic удалены** (см. CHANGELOG_BOT_CLEANUP.md)

---

## Executive Summary

### Как бот работает сейчас

Бот EatFit24 — Telegram-бот на aiogram 3.14, реализующий функцию **Personal Plan**: опрос пользователя и генерация AI-плана питания/тренировок. Бот работает в режиме **polling**, хранит FSM-состояние в памяти (MemoryStorage), и **все данные сохраняет исключительно через Django API** (`http://backend:8000/api/v1`).

### Где бот пишет в БД

**НИГДЕ напрямую.** ~~Несмотря на наличие SQLAlchemy моделей~~ SQLAlchemy/Alembic код был удалён 2025-12-24. Все операции с данными происходят через HTTP API Django backend.

### Где бот ходит в Django API

| Endpoint | Назначение |
|----------|-----------|
| `GET /telegram/users/get-or-create/` | Создать/получить пользователя |
| `POST /telegram/personal-plan/survey/` | Сохранить ответы опроса |
| `POST /telegram/personal-plan/plan/` | Сохранить сгенерированный план |
| `GET /telegram/personal-plan/count-today/` | Проверить лимит планов |

### 3 главные риска при удалении SQLAlchemy

| Риск | Уровень | Описание |
|------|---------|----------|
| **Удаление рабочего кода** | 🟢 LOW | SQLAlchemy код не используется — удаление безопасно |
| **Alembic entrypoint** | 🟡 MEDIUM | `bot/entrypoint.sh` может запускать миграции — проверить |
| **Зависимости requirements** | 🟢 LOW | После удаления SQLAlchemy нужно обновить `requirements.txt` |

---

## Runtime / Entry Point

### Точка входа

```
main.py → app/__main__.py → main()
```

- `Dispatcher` с `MemoryStorage`
- Polling через `dp.start_polling()`
- Регистрация хендлеров через `register_all_handlers(dp)`

### Регистрация роутеров

```python
# app/handlers/__init__.py
if settings.is_personal_plan_enabled:
    from .survey import router as personal_plan_router
    dp.include_router(personal_plan_router)
```

### Обязательные ENV

| Переменная | Описание | Статус |
|------------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Токен бота | ✅ Критичный |
| `TELEGRAM_BOT_API_SECRET` | Секрет для X-Bot-Secret header | ✅ Критичный |
| `OPENROUTER_API_KEY` | Ключ AI API | ✅ Критичный |
| `DJANGO_API_URL` | URL Django API | ✅ Критичный |
| `BOT_ADMIN_ID` / `ADMIN_IDS` | ID админов | ⚠️ Опционально |
| `TRAINER_PANEL_BASE_URL` | URL панели тренера | ⚠️ Опционально |
| `WEB_APP_URL` | URL Mini App | ⚠️ Опционально |

---

## Handlers Map

### Структура хендлеров

```
app/handlers/
└── survey/
    ├── __init__.py       # Main router
    ├── commands.py       # /start, /app, /personal_plan
    ├── gender.py         # Выбор пола
    ├── metrics.py        # Возраст, рост, вес
    ├── activity.py       # Уровень активности
    ├── training_goals.py # Цели тренировок
    ├── health.py         # Ограничения по здоровью
    ├── body_types.py     # Выбор типа фигуры
    ├── timezone.py       # Часовой пояс
    ├── confirmation.py   # Подтверждение и генерация плана
    ├── navigation.py     # Отмена, возврат
    └── helpers.py        # Вспомогательные функции
```

### Таблица хендлеров

| Команда/Ивент | Файл | Функция | Что делает | Сервисы |
|---------------|------|---------|------------|---------|
| `/start` | `commands.py` | `cmd_start` | Приветствие, начало | — |
| `/app` | `commands.py` | `cmd_app` | Открыть Mini App | — |
| `/personal_plan` | `commands.py` | `cmd_personal_plan` | Начать опрос | — |
| `callback:survey:start` | `commands.py` | `start_survey` | Первый вопрос | `log_survey_started` |
| `callback:gender:*` | `gender.py` | `process_gender` | Выбор пола | — |
| `callback:age/height/weight` | `metrics.py` | `process_*` | Ввод метрик | — |
| `callback:activity:*` | `activity.py` | `process_activity` | Выбор активности | — |
| `callback:body_now/ideal:*` | `body_types.py` | `process_body_*` | Выбор фигуры | `image_sender` |
| `callback:timezone:*` | `timezone.py` | `process_timezone` | Часовой пояс | — |
| `callback:confirm:yes` | `confirmation.py` | `confirm_and_generate` | **ГЛАВНЫЙ** | `openrouter_client`, `get_backend_api()` |
| `callback:confirm:edit` | `confirmation.py` | `confirm_edit` | Начать заново | — |
| `callback:cancel` | `navigation.py` | `cancel_survey` | Отмена опроса | — |

---

## Data Flow Diagrams

### 1. /start (Регистрация/Профиль)

```
User → /start
  ↓
cmd_start()
  ↓
Проверка is_admin()
  ↓
Формирование клавиатуры (WebApp для админа, контакт тренера для остальных)
  ↓
Отправка приветственного сообщения
```

**Сервисы**: Нет API/DB вызовов  
**Данные**: Только локальная проверка admin_ids из settings

### 2. Логирование еды (фото/текст)

> ⚠️ **Функция НЕ реализована в текущем боте**. Бот только генерирует Personal Plan.

### 3. Генерация плана (confirm:yes)

```
User → "Подтвердить"
  ↓
confirm_and_generate()
  ↓
[1] get_backend_api().count_plans_today() ──→ Django API
  ↓ (проверка лимита)
[2] openrouter_client.generate_plan() ──→ OpenRouter AI
  ↓ (получение текста плана)
[3] get_backend_api().get_or_create_user() ──→ Django API
  ↓
[4] get_backend_api().create_survey() ──→ Django API
  ↓
[5] get_backend_api().create_plan() ──→ Django API
  ↓
Отправка плана пользователю
```

**Сервисы**: `BackendAPIClient`, `OpenRouterClient`  
**API вызовов**: 4  
**DB напрямую**: 0

### 4. Получение статуса подписки/лимитов

```
User → "Подтвердить"
  ↓
confirm_and_generate()
  ↓
get_backend_api().count_plans_today(telegram_id)
  ↓
GET /telegram/personal-plan/count-today/?telegram_id=123
  ↓
Django возвращает: {"count": 1, "limit": 3, "can_create": true}
```

**Тип**: Rate limiting  
**Fail-open**: Если API недоступен, генерация продолжается

### 5. Admin/Weekly Report

> ⚠️ **Функции НЕ реализованы в текущем боте**.

---

## DB Usage Map (SQLAlchemy)

### Статус: ✅ УДАЛЕНО (2025-12-24)

Все SQLAlchemy компоненты удалены:

| Компонент | Статус |
|-----------|--------|
| `app/models/` | ❌ Удалено |
| `app/services/database/` | ❌ Удалено |
| `alembic/` | ❌ Удалено |
| `alembic.ini` | ❌ Удалено |
| `django_integration.py` | ❌ Удалено |
| `schemas/django_api.py` | ❌ Удалено |

См. [CHANGELOG_BOT_CLEANUP.md](CHANGELOG_BOT_CLEANUP.md) для деталей.

---

## API Usage Map (Django API)

### Клиент: `BackendAPIClient`

**Файл**: `app/services/backend_api.py`  
**Базовый URL**: `settings.DJANGO_API_URL` (default: `http://backend:8000/api/v1`)  
**HTTP библиотека**: `httpx`  
**Retry**: `tenacity` (3 попытки, exponential backoff)

### Список эндпоинтов

| Метод | Endpoint | Файл:Строка | Назначение |
|-------|----------|-------------|-----------|
| `GET` | `/telegram/users/get-or-create/` | `backend_api.py:173` | Создать/получить пользователя |
| `POST` | `/telegram/personal-plan/survey/` | `backend_api.py:251` | Сохранить ответы опроса |
| `POST` | `/telegram/personal-plan/plan/` | `backend_api.py:289` | Сохранить план |
| `GET` | `/telegram/personal-plan/count-today/` | `backend_api.py:306` | Проверить лимит |

### Авторизация

**Тип**: Shared secret (X-Bot-Secret header)  
**Header**: `X-Bot-Secret: <TELEGRAM_BOT_API_SECRET>`  
**Валидация**: Backend проверяет в `_require_bot_secret()` (`apps/telegram/bot/views.py`)

### Таймауты и Retry

| Параметр | Значение | Настройка |
|----------|----------|-----------|
| Timeout | 30 сек | `settings.DJANGO_API_TIMEOUT` |
| Retry attempts | 3 | `settings.DJANGO_RETRY_ATTEMPTS` |
| Min wait | 1 сек | `settings.DJANGO_RETRY_MIN_WAIT` |
| Max wait | 8 сек | `settings.DJANGO_RETRY_MAX_WAIT` |
| Multiplier | 2 | `settings.DJANGO_RETRY_MULTIPLIER` |



---

## Dependency Graph

### requirements.txt (после cleanup)

| Пакет | Статус |
|-------|--------|
| `aiogram` 3.14.0 | ✅ Core |
| `httpx` 0.27.2 | ✅ Core |
| `tenacity` 9.0.0 | ✅ Core |
| `pydantic` 2.x | ✅ Core |
| `pydantic-settings` 2.6.1 | ✅ Core |
| `redis` 5.2.0 | ⚠️ Optional (FSM) |
| `loguru` 0.7.3 | ✅ Logging |
| `Pillow` 11.0.0 | ✅ Images |
| `pytz` 2024.2 | ✅ Timezone |
| `aiofiles` 23.2.1 | ✅ Async IO |

**Удалены**: `sqlalchemy`, `asyncpg`, `alembic`

---

## Decision Section: Why SQLAlchemy Exists

### Историческая причина

SQLAlchemy был добавлен на этапе проектирования бота (ноябрь 2025) как стандартный способ работы с БД. Изначально предполагалось, что бот будет напрямую писать в PostgreSQL.

### Почему не используется

В процессе разработки архитектура была изменена на **"Bot → Django API only"** для:
1. **Единой точки истины** — все данные в Django моделях
2. **Изоляции** — бот не имеет прямого доступа к production БД
3. **Простоты** — один код для работы с данными в backend

### Комментарий в коде

```python
# app/__main__.py:45
# Database connection is no longer used - bot communicates via Backend API
```

### Нужна ли SQLAlchemy сейчас?

**SQLAlchemy удалена.** См. [CHANGELOG_BOT_CLEANUP.md](CHANGELOG_BOT_CLEANUP.md).

---

## Итоговый статус

### ✅ Выполнено (2025-12-24)

| Задача | Статус |
|--------|--------|
| Удалить SQLAlchemy models | ✅ Done |
| Удалить Alembic migrations | ✅ Done |
| Удалить database services | ✅ Done |
| Удалить legacy django_integration.py | ✅ Done |
| Обновить requirements.txt | ✅ Done |
| Обновить config.py | ✅ Done |
| Обновить docker-compose.yml | ✅ Done |
| Обновить .env.example | ✅ Done |
| Обновить entrypoint.sh | ✅ Done |
| Добавить X-Bot-Secret авторизацию | ✅ Done |

### Архитектура

```
┌─────────────┐    X-Bot-Secret    ┌─────────────┐    ┌──────────┐
│  Telegram   │ ──────────────────▶│   Django    │───▶│ Postgres │
│    Bot      │   HTTP (httpx)     │  Backend    │    │          │
└─────────────┘                    └─────────────┘    └──────────┘
     │
     ▼
┌─────────────┐
│  OpenRouter │
│     AI      │
└─────────────┘
```

Бот — **только UI**. Все данные — через Django API.


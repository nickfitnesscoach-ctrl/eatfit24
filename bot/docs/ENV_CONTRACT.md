# Bot — Environment Variables Contract

**Последнее обновление**: 2026-01-11
**Статус**: ✅ SSOT (Single Source of Truth)

---

## Цель документа

Этот документ определяет:
- **Обязательные** переменные окружения для bot
- **Опциональные** переменные с дефолтами
- **Запрещённые** переменные (security / architecture separation)

---

## Принципы архитектуры бота

1. **Bot НЕ имеет прямого доступа к БД**
   - Вся работа с данными через Django REST API
   - Обязательна переменная `DJANGO_API_URL`

2. **Bot генерирует персональные планы питания через OpenRouter**
   - Обязательна переменная `OPENROUTER_API_KEY`
   - Это отдельный ключ, может совпадать с ключом ai-proxy

3. **Bot не занимается биллингом**
   - Нет доступа к YooKassa
   - Биллинг полностью в backend

---

## Обязательные переменные

### TELEGRAM_BOT_TOKEN

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

**Получение**: @BotFather в Telegram

**Где используется**: [app/config.py:17](../app/config.py)

---

### TELEGRAM_BOT_API_SECRET

```bash
TELEGRAM_BOT_API_SECRET=<64-символа-hex>
```

**Генерация**: `openssl rand -hex 32`

**Назначение**: X-Bot-Secret header для запросов bot -> Django API

**Где используется**: [app/config.py:18](../app/config.py)

---

### TELEGRAM_ADMINS

```bash
TELEGRAM_ADMINS=310151740,987654321
```

**Формат**: Telegram user IDs через запятую

**Важно**: Это единственная переменная для admin IDs
- ❌ Не используйте `BOT_ADMIN_ID` (deprecated, но поддерживается для обратной совместимости)
- ❌ Не используйте `ADMIN_IDS` (deprecated, но поддерживается для обратной совместимости)

**Где используется**: [app/config.py:90-116](../app/config.py) (свойство `admin_ids`)

---

### OPENROUTER_API_KEY

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

**Назначение**: Генерация персональных планов питания через OpenRouter

**Важно**:
- Это отдельный ключ для bot
- Может совпадать с ключом в ai-proxy (общий бюджет OpenRouter)
- Или быть отдельным (раздельный учёт)

**Где используется**: [app/config.py:32](../app/config.py)

---

### DJANGO_API_URL

```bash
# Docker dev
DJANGO_API_URL=http://backend:8000/api/v1

# Production
DJANGO_API_URL=https://eatfit24.ru/api/v1
```

**Назначение**: Bot вызывает Django REST API для всех операций с данными

**Важно**: Bot НЕ имеет прямого доступа к PostgreSQL

**Где используется**: [app/config.py:63](../app/config.py)

---

## Опциональные переменные (с дефолтами)

### OpenRouter Settings

```bash
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct  # дефолт
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1   # дефолт
OPENROUTER_TIMEOUT=30                                # дефолт
AI_PROMPT_VERSION=v1.0                               # дефолт
```

**Где используется**: [app/config.py:31-35](../app/config.py)

---

### OpenRouter Retry Configuration

```bash
OPENROUTER_RETRY_ATTEMPTS=3        # дефолт
OPENROUTER_RETRY_MIN_WAIT=2        # дефолт (сек)
OPENROUTER_RETRY_MAX_WAIT=10       # дефолт (сек)
OPENROUTER_RETRY_MULTIPLIER=2      # дефолт
```

**Где используется**: [app/config.py:38-41](../app/config.py)

---

### Django API Settings

```bash
DJANGO_API_TIMEOUT=30              # дефолт (сек)
DJANGO_RETRY_ATTEMPTS=3            # дефолт
DJANGO_RETRY_MIN_WAIT=1            # дефолт (сек)
DJANGO_RETRY_MAX_WAIT=8            # дефолт (сек)
DJANGO_RETRY_MULTIPLIER=2          # дефолт
```

**Где используется**: [app/config.py:66-70](../app/config.py)

---

### Telegram WebApp

```bash
WEB_APP_URL=https://eatfit24.ru/app             # опционально
TRAINER_PANEL_BASE_URL=https://eatfit24.ru/app  # опционально
```

**Где используется**: [app/config.py:73-74](../app/config.py)

---

### Redis (FSM Storage)

```bash
FSM_STORAGE_TYPE=memory  # дефолт (для dev), "redis" для prod
REDIS_HOST=redis         # дефолт
REDIS_PORT=6379          # дефолт
REDIS_DB=0               # дефолт
REDIS_PASSWORD=          # опционально
```

**Где используется**: [app/config.py:24-28](../app/config.py)

---

### Application Settings

```bash
ENVIRONMENT=production           # дефолт: development
DEBUG_MODE=false                 # дефолт: false
DEFAULT_TIMEZONE=Europe/Moscow   # дефолт
FSM_STATE_TTL=30                 # минуты, дефолт
IMAGE_CACHE_TTL=30               # дни, дефолт
RATE_LIMIT_PER_MINUTE=20         # дефолт
MAX_PLANS_PER_DAY=3              # дефолт
TRAINER_USERNAME=NicolasBatalin  # дефолт
PROJECT_URL=https://github.com/... # дефолт
```

**Где используется**: [app/config.py:44-60](../app/config.py)

---

### Feature Flags

```bash
FEATURE_PERSONAL_PLAN=on  # дефолт: on
```

**Где используется**: [app/config.py:44](../app/config.py)

---

### Logging

```bash
LOG_LEVEL=INFO              # дефолт
LOG_FILE=logs/bot.log       # дефолт
LOG_MAX_BYTES=10485760      # дефолт (10 MB)
LOG_BACKUP_COUNT=5          # дефолт
```

**Где используется**: [app/config.py:48-51](../app/config.py)

---

## Запрещённые переменные для Bot

Bot **НЕ ДОЛЖЕН** содержать:

### ❌ POSTGRES_* (все переменные БД)
**Причина**: Bot НЕ имеет прямого доступа к БД
- Вся работа через Django REST API (`DJANGO_API_URL`)
- Упрощает security / deployment

### ❌ YOOKASSA_* (все переменные биллинга)
**Причина**: Биллинг обрабатывается только в backend
- Bot не должен знать о платёжных секретах
- Все операции через Django API

### ❌ BOT_ADMIN_ID / ADMIN_IDS (deprecated)
**Статус**: Поддерживаются для обратной совместимости, но НЕ рекомендуются
**Используйте**: `TELEGRAM_ADMINS` (единственный SSOT)

**Обработка в коде**: [app/config.py:90-116](../app/config.py)
- Свойство `admin_ids` объединяет все три источника
- Приоритет: `TELEGRAM_ADMINS` > `ADMIN_IDS` > `BOT_ADMIN_ID`

---

## Валидация

### Обязательные проверки при старте

Bot **должен fail-fast**, если:
1. `TELEGRAM_BOT_TOKEN` пустой
2. `OPENROUTER_API_KEY` пустой
3. `DJANGO_API_URL` пустой (если бот работает через API)

**Где**: [app/config.py:11-14](../app/config.py) (Pydantic validation)

---

## Примеры конфигурации

### Production (.env на сервере)

```bash
# === ОБЯЗАТЕЛЬНО ===

# Telegram Bot
TELEGRAM_BOT_TOKEN=<from-botfather>
TELEGRAM_BOT_API_SECRET=<generated-with-openssl-rand-hex-32>
TELEGRAM_ADMINS=310151740

# OpenRouter AI (для генерации планов питания)
OPENROUTER_API_KEY=sk-or-v1-...

# Django API Integration
DJANGO_API_URL=https://eatfit24.ru/api/v1

# === ОПЦИОНАЛЬНО (с дефолтами) ===

# Telegram WebApp
WEB_APP_URL=https://eatfit24.ru/app
TRAINER_PANEL_BASE_URL=https://eatfit24.ru/app

# FSM Storage (memory для dev, redis для prod)
FSM_STORAGE_TYPE=memory

# Application
ENVIRONMENT=production
DEBUG_MODE=false
```

### Development (локальная разработка)

```bash
# === ОБЯЗАТЕЛЬНО ===
TELEGRAM_BOT_TOKEN=<dev-bot-token>
TELEGRAM_BOT_API_SECRET=dev-secret-key
TELEGRAM_ADMINS=310151740

OPENROUTER_API_KEY=sk-or-v1-...

# Docker dev
DJANGO_API_URL=http://backend:8000/api/v1

# === ОПЦИОНАЛЬНО ===
WEB_APP_URL=http://localhost:3000
FSM_STORAGE_TYPE=memory
ENVIRONMENT=development
DEBUG_MODE=true
LOG_LEVEL=DEBUG
```

---

## Deprecated переменные (обратная совместимость)

### BOT_ADMIN_ID / ADMIN_IDS

**Статус**: Deprecated, но поддерживаются для обратной совместимости

**Рекомендация**: Используйте **только** `TELEGRAM_ADMINS`

**Как работает** (config.py:90-116):
```python
@property
def admin_ids(self) -> list[int]:
    ids: list[int] = []

    # Приоритет 1: TELEGRAM_ADMINS
    if self.TELEGRAM_ADMINS:
        for raw_id in self.TELEGRAM_ADMINS.split(","):
            ids.append(int(raw_id.strip()))

    # Приоритет 2: ADMIN_IDS (deprecated)
    if self.ADMIN_IDS:
        for raw_id in self.ADMIN_IDS.split(","):
            ids.append(int(raw_id.strip()))

    # Приоритет 3: BOT_ADMIN_ID (deprecated)
    if self.BOT_ADMIN_ID:
        ids.append(int(self.BOT_ADMIN_ID))

    return list(dict.fromkeys(ids))  # deduplicate
```

---

## См. также

- [bot/.env.example](../.env.example) — шаблон переменных окружения
- [app/config.py](../app/config.py) — загрузка и валидация
- [../../docs/ENV.md](../../docs/ENV.md) — общая документация по окружению

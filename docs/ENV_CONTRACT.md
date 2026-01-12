# Environment Configuration Contract

**Version:** 2.0  
**Last Updated:** 2026-01-12  
**Status:** ✅ Production Ready

---

## 📋 Оглавление

1. [Быстрый старт](#быстрый-старт)
2. [Архитектура окружений](#архитектура-окружений)
3. [Файловая структура](#файловая-структура)
4. [Environment Guards (Safeguards)](#environment-guards)
5. [Переменные окружения](#переменные-окружения)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Быстрый старт

### Локальная разработка

```bash
# 1. Скопируйте .env.local (уже готов)
# Файл .env.local содержит все DEV переменные

# 2. Создайте .env файл
cp .env.local .env

# 3. Запустите docker compose
docker compose -f compose.yml -f compose.dev.yml up -d

# 4. Проверьте что все работает
docker compose logs backend | grep "STARTUP"
# Должны увидеть:
# [STARTUP] APP_ENV=dev
# [STARTUP] POSTGRES_DB=eatfit24_dev
```

### Production (на сервере)

```bash
# 1. Убедитесь что .env содержит PROD переменные
cat .env | head -20

# 2. Проверьте ключевые переменные
grep -E "APP_ENV|POSTGRES_DB|YOOKASSA_MODE" .env
# Должно быть:
# APP_ENV=prod
# POSTGRES_DB=eatfit24
# YOOKASSA_MODE=prod

# 3. Запустите
docker compose up -d --build

# 4. Проверьте health
curl -H "Host: eatfit24.ru" http://localhost:8000/health/
```

---

## Архитектура окружений

### Принципы изоляции

EatFit24 использует **двухуровневую изоляцию** DEV и PROD окружений:

```
┌─────────────────────────────────────────────────────────────┐
│                   ФИЗИЧЕСКАЯ ИЗОЛЯЦИЯ                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DEV (Локальная машина)          PROD (Сервер)              │
│  ┌──────────────────────┐         ┌──────────────────────┐  │
│  │ Docker Desktop       │         │ Production Server    │  │
│  │                      │         │                      │  │
│  │ • PostgreSQL (dev)   │         │ • PostgreSQL (prod) │  │
│  │ • Redis (dev)        │         │ • Redis (prod)      │  │
│  │ • Backend (dev)      │         │ • Backend (prod)    │  │
│  └──────────────────────┘         └──────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   ЛОГИЧЕСКАЯ ИЗОЛЯЦИЯ                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  APP_ENV=dev                     APP_ENV=prod               │
│  POSTGRES_DB=eatfit24_dev        POSTGRES_DB=eatfit24       │
│  YOOKASSA_MODE=test              YOOKASSA_MODE=prod         │
│  DEBUG=true                      DEBUG=false                │
│                                                              │
│  🛡️ Guards блокируют cross-connection                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Как это работает

1. **Физическая изоляция:**
   - DEV: Docker на вашей машине (`localhost`)
   - PROD: Docker на production сервере (`eatfit24.ru`)
   - Невозможно случайно подключиться к чужой БД - разные сети

2. **Логическая изоляция:**
   - Разные имена БД: `eatfit24_dev` vs `eatfit24`
   - Разные Redis DB: `0/1` (dev) vs `1/2` (prod)
   - Разные Docker volumes: `eatfit24_dev_*` vs `eatfit24_*`

3. **Runtime Guards:**
   - Проверяют переменные при старте контейнера
   - Блокируют несовместимые комбинации
   - Fail-fast подход (падают сразу при ошибке)

---

## Файловая структура

```
eatfit24/
├── .env.local          # DEV переменные (уже готов, в git)
├── .env.example        # Шаблон (в git)
├── .env                # Текущее окружение (НЕ в git)
│                       # Локально: копия .env.local
│                       # Production: файл с PROD переменными
│
├── compose.yml         # Базовая конфигурация (читает .env)
├── compose.dev.yml     # DEV overrides
├── compose.prod.yml    # PROD overrides (НЕ используется, все в .env)
│
├── backend/
│   └── entrypoint.sh   # 🛡️ Environment Guards здесь
│
└── bot/
    └── entrypoint.sh   # 🛡️ Environment Logging здесь
```

### Важные правила

| Файл          | Локально         | Production      | В Git | Назначение |
|---------------|------------------|-----------------|-------|------------|
| `.env`        | Копия .env.local | Prod переменные | ❌ Нет | Активные переменные |
| `.env.local`  | Используется     | Не используется | ✅ Да  | DEV шаблон |
| `.env.example`| Не используется  | Не используется | ✅ Да  | Документация |

**Gitignore:**
```gitignore
.env           # Никогда не коммитить!
*.env          # Никакие .env* файлы кроме явно разрешенных
!.env.local    # Разрешить .env.local
!.env.example  # Разрешить .env.example
```

---

## Environment Guards

### Что это такое?

**Environment Guards** - это runtime проверки в `backend/entrypoint.sh`, которые **блокируют запуск** если обнаружена опасная конфигурация.

### Расположение

**Файл:** [`backend/entrypoint.sh`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/entrypoint.sh) (строки 34-78)

### Список Guards

#### Guard 1: DEV → PROD Database Prevention

**Что проверяет:**
```bash
if [ "${APP_ENV}" = "dev" ]; then
    if [ "${POSTGRES_DB}" = "eatfit24_prod" ] || [ "${POSTGRES_DB}" = "eatfit24" ]; then
        echo "[FATAL] DEV environment cannot connect to PROD database"
        exit 1
    fi
fi
```

**Защита:** DEV не может подключиться к production базе данных

**Пример срабатывания:**
```
APP_ENV=dev
POSTGRES_DB=eatfit24  ← PROD база

Результат:
[FATAL] DEV environment cannot connect to PROD database (eatfit24)
[FATAL] Expected: eatfit24_dev
[FATAL] Got: eatfit24
Container exits with code 1
```

#### Guard 2: PROD → DEV Database Prevention

**Что проверяет:**
```bash
if [ "${APP_ENV}" = "prod" ]; then
    if [ "${POSTGRES_DB}" = "eatfit24_dev" ] || [ "${POSTGRES_DB}" = "test" ]; then
        echo "[FATAL] PROD environment cannot connect to DEV/TEST database"
        exit 1
    fi
fi
```

**Защита:** PROD не может подключиться к dev/test базе

#### Guard 3: PROD Test Keys Prevention

**Что проверяет:**
```bash
if [ "${APP_ENV}" = "prod" ]; then
    if echo "${YOOKASSA_SECRET_KEY}" | grep -q "test_"; then
        echo "[FATAL] PROD cannot use test YooKassa key"
        exit 1
    fi
fi
```

**Защита:** PROD не может использовать тестовые ключи оплаты

### Startup Logging

При каждом запуске контейнера логируются ключевые переменные:

```bash
echo "[STARTUP] APP_ENV=${APP_ENV}"
echo "[STARTUP] POSTGRES_DB=${POSTGRES_DB:-unset}"
echo "[STARTUP] YOOKASSA_MODE=${YOOKASSA_MODE:-unset}"
```

**Пример логов:**

DEV:
```
[STARTUP] APP_ENV=dev
[STARTUP] POSTGRES_DB=eatfit24_dev
[STARTUP] YOOKASSA_MODE=test
Environment guards: PASSED ✓
```

PROD:
```
[STARTUP] APP_ENV=prod
[STARTUP] POSTGRES_DB=eatfit24
[STARTUP] YOOKASSA_MODE=prod
Environment guards: PASSED ✓
```

### Проверка Guards

**Локально - тест что guard работает:**

```bash
# В .env временно поставьте:
APP_ENV=dev
POSTGRES_DB=eatfit24  # ← PROD база

docker compose up backend

# Expected:
# [FATAL] DEV environment cannot connect to PROD database
# Container exits
```

**ВАЖНО:** После теста верните правильные значения!

---

## Переменные окружения

### Критические переменные (обязательны)

#### APP_ENV

**Что делает:** Определяет логическое окружение для environment guards

| Значение | Использование | Guards |
|----------|---------------|--------|
| `dev`    | Локальная разработка | Блокирует подключение к `eatfit24` или `eatfit24_prod` |
| `prod`   | Production сервер | Блокирует подключение к `eatfit24_dev` или `test` |

**Default (из кода `entrypoint.sh:29`):**
```bash
APP_ENV="${APP_ENV:-prod}"  # По умолчанию prod!
```

**Влияет на:**
- Environment guards в entrypoint.sh (строки 46-77)
- Django settings guard (`production.py:17-19`, `local.py:56-58`)
- Health check (отображается в `/health/`)

> [!WARNING]
> **APP_ENV ≠ ENV!** Это **разные** переменные:
> - `APP_ENV` — для guards (dev/prod)
> - `ENV` — для DEBUG validation (local/production)

#### ENV

**Что делает:** Определяет режим отладки (ENV/DEBUG validation)

| Значение | DEBUG | Результат |
|----------|-------|----------|
| `local` | `true` | ✅ Разрешено |
| `local` | `false` | ❌ Ошибка: "ENV=local but DEBUG=false" |
| `production` | `false` | ✅ Разрешено |
| `production` | `true` | ❌ Ошибка: "ENV=production but DEBUG=true" |

**Default (из кода `entrypoint.sh:87`):**
```bash
ENV_VALUE="${ENV:-production}"  # По умолчанию production!
```

**Где используется:**
- `backend/entrypoint.sh` - ENV/DEBUG conflict guard (строки 82-107)

#### POSTGRES_DB

**Что делает:** Имя базы данных PostgreSQL

| Окружение | Значение | Guards |
|-----------|----------|---------|
| DEV       | `eatfit24_dev` | ✅ Разрешено если APP_ENV=dev |
| PROD      | `eatfit24` | ✅ Разрешено если APP_ENV=prod |

**Связанные переменные:**
```env
POSTGRES_USER=eatfit24_dev      # DEV
POSTGRES_PASSWORD=***           # Разные для DEV/PROD
POSTGRES_HOST=db                # Одинаково (имя контейнера)
POSTGRES_PORT=5432              # Одинаково
```

#### SECRET_KEY / DJANGO_SECRET_KEY

**Что делает:** Django secret key для криптографии

**Как работает (из кода `base.py:36`):**
```python
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("DJANGO_SECRET_KEY") or ""
```

**Приоритет:**
1. `SECRET_KEY` — основной (рекомендуется)
2. `DJANGO_SECRET_KEY` — fallback для совместимости

**Требования:**
- Минимум 50 символов
- Случайная строка
- **РАЗНЫЕ** для DEV и PROD

**Генерация:**
```python
import secrets
print(secrets.token_hex(32))
```

**DEV (.env.local):**
```env
# Оба варианта работают, используйте один:
SECRET_KEY=local-dev-secret-key
# или
DJANGO_SECRET_KEY=local-dev-secret-key
```

**PROD:**
```env
SECRET_KEY=6d85f4831fa17f217a4a1d47b074c89de1f54ab7831efff1da5500ea224afa3b
```

#### YOOKASSA_MODE

**Что делает:** Режим работы платежной системы

| Значение | Использование | Guards |
|----------|---------------|---------|
| `test`   | Локальная разработка, тестовые платежи | ✅ Разрешено для DEV |
| `prod`   | Реальные платежи | 🛡️ PROD проверяет `test_` в YOOKASSA_SECRET_KEY |

**Связанные переменные:**
```env
YOOKASSA_SHOP_ID=***
YOOKASSA_SECRET_KEY=test_***    # DEV: начинается с test_
YOOKASSA_SECRET_KEY=live_***    # PROD: начинается с live_
```

### Полный список переменных

#### Environment & Django Core

```env
# Окружение
APP_ENV=dev|prod                           # Environment guards (CRITICAL)
ENV=local|production                       # ENV/DEBUG validation (отдельная переменная!)
DEBUG=true|false                           # Django DEBUG mode
COMPOSE_PROJECT_NAME=eatfit24_dev          # Префикс Docker volumes

# Django
DJANGO_SETTINGS_MODULE=config.settings.local|production
SECRET_KEY=***                             # Django secret (CRITICAL)
ALLOWED_HOSTS=localhost,eatfit24.ru        # Разрешенные хосты
DOMAIN_NAME=localhost|eatfit24.ru
```

#### Database

```env
POSTGRES_DB=eatfit24_dev|eatfit24          # Имя БД (CRITICAL)
POSTGRES_USER=eatfit24_dev|eatfit24        # Пользователь БД
POSTGRES_PASSWORD=***                      # Пароль БД (CRITICAL)
POSTGRES_HOST=db                           # Имя контейнера
POSTGRES_PORT=5432                         # Порт PostgreSQL
```

#### Redis & Celery

```env
REDIS_URL=redis://redis:6379/0             # DEV: DB 0, PROD: DB 1
CELERY_BROKER_URL=redis://redis:6379/0     # DEV: DB 0, PROD: DB 1
CELERY_RESULT_BACKEND=redis://redis:6379/1 # DEV: DB 1, PROD: DB 2
CELERY_TIMEZONE=UTC|Europe/Moscow
```

**Изоляция Redis:**
- DEV использует Redis DB `0` и `1`
- PROD использует Redis DB `1` и `2`
- Физически разные серверы (локально vs production)

#### Telegram

```env
TELEGRAM_BOT_TOKEN=***                     # Токен бота (CRITICAL)
TELEGRAM_ADMINS=310151740                  # ID админов (через запятую)
WEB_APP_URL=https://eatfit24.ru/app        # URL WebApp
DJANGO_API_URL=http://backend:8000/api/v1  # URL Django API
```

#### Billing (YooKassa)

```env
YOOKASSA_SHOP_ID=***                       # ID магазина
YOOKASSA_SECRET_KEY=test_***|live_***      # Ключ (CRITICAL, guards проверяют)
YOOKASSA_MODE=test|prod                    # Режим работы
YOOKASSA_RETURN_URL=***                    # URL возврата после оплаты
YOOKASSA_WEBHOOK_URL=***                   # URL webhook
BILLING_STRICT_MODE=false|true             # Строгий режим
```

#### AI / LLM

```env
OPENROUTER_API_KEY=***                     # OpenRouter API key
AI_PROXY_URL=http://185.171.80.128:8001    # URL AI Proxy
AI_PROXY_SECRET=***                        # AI Proxy auth
AI_ASYNC_ENABLED=true                      # Async обработка
```

#### Security

```env
# DEV (relaxed)
SECURE_SSL_REDIRECT=false
SESSION_COOKIE_SECURE=false
CSRF_COOKIE_SECURE=false
SECURE_HSTS_SECONDS=0

# PROD (strict)
SECURE_SSL_REDIRECT=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=true
SECURE_HSTS_PRELOAD=true
```

#### Entrypoint Flags

```env
RUN_MIGRATIONS=1                           # Запускать миграции (1=да, 0=нет)
RUN_COLLECTSTATIC=0|1                      # DEV=0, PROD=1
MIGRATIONS_STRICT=1                        # Падать при ошибке миграций
```

---

## Troubleshooting

### Backend не запускается

#### Проблема: "POSTGRES_DB is required"

**Симптомы:**
```
error while interpolating services.db.environment.POSTGRES_DB: 
required variable POSTGRES_DB is missing a value
```

**Причина:** Файл `.env` не существует или пустой

**Решение:**
```bash
# Локально
cp .env.local .env

# Production
cat .env | head -20  # Проверьте что файл есть и заполнен
```

#### Проблема: "[FATAL] DEV environment cannot connect to PROD database"

**Симптомы:**
```
[STARTUP] APP_ENV=dev
[STARTUP] POSTGRES_DB=eatfit24
[FATAL] DEV environment cannot connect to PROD database (eatfit24)
Container exits with code 1
```

**Причина:** Environment guards сработали - APP_ENV=dev пытается подключиться к PROD базе

**Решение:**
```bash
# В .env исправьте:
APP_ENV=dev
POSTGRES_DB=eatfit24_dev  # ← Должна быть DEV база

# Перезапустите
docker compose restart backend
```

#### Проблема: "[FATAL] PROD cannot use test YooKassa key"

**Симптомы:**
```
[STARTUP] APP_ENV=prod
[FATAL] PROD cannot use test YooKassa key
```

**Причина:** Production пытается использовать тестовый ключ `test_***`

**Решение:**
```bash
# В .env замените:
YOOKASSA_SECRET_KEY=live_***  # Используйте live_ ключ
YOOKASSA_MODE=prod
```

#### Проблема: "SECRET_KEY must be set"

**Симптомы:**
```
RuntimeError: [SAFETY] SECRET_KEY must be set before loading production settings
```

**Причина:** Отсутствует SECRET_KEY в .env

**Решение:**
```bash
# В .env добавьте:
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
```

### Docker не видит изменения в .env

**Проблема:** Вы изменили `.env`, но контейнер использует старые переменные

**Причина:** Docker кеширует переменные окружения

**Решение:**
```bash
# Полный рестарт с пересозданием контейнеров
docker compose down
docker compose up -d --force-recreate

# Проверьте
docker compose logs backend | grep "STARTUP"
```

### Симлинки не работают на Windows

**Проблема:** Создали симлинк `.env -> .env.local`, но Docker не видит файл

**Причина:** Docker Desktop на Windows плохо работает с symlinks

**Решение:**
```powershell
# Не используйте симлинки на Windows
# Вместо этого копируйте файл:
Remove-Item .env -Force -ErrorAction SilentlyContinue
Copy-Item .env.local .env
```

---

## Best Practices

### ✅ DO (Делайте так)

1. **Всегда проверяйте APP_ENV при старте**
   ```bash
   docker compose logs backend | grep "STARTUP"
   # [STARTUP] APP_ENV=dev  ← Убедитесь что правильное окружение
   ```

2. **Разные пароли для DEV и PROD**
   ```env
   # DEV
   POSTGRES_PASSWORD=dev_password_change_me
   
   # PROD
   POSTGRES_PASSWORD=secure_random_prod_password_42chars_min
   ```

3. **Храните .env.local в Git**
   - Это шаблон для команды
   - Содержит `REPLACE_ME` плейсхолдеры
   - Помогает новым разрабам быстро настроить окружение

4. **Используйте разные Redis DB**
   ```env
   # DEV
   CELERY_BROKER_URL=redis://redis:6379/0
   
   # PROD
   CELERY_BROKER_URL=redis://redis:6379/1
   ```

5. **Проверяйте health check после deploy**
   ```bash
   curl https://eatfit24.ru/health/ | jq
   # Проверьте: app_env: "prod"
   ```

### ❌ DON'T (Не делайте так)

1. **НЕ коммитьте .env в Git**
   ```bash
   # ПЛОХО
   git add .env
   
   # ХОРОШО
   # .env уже в .gitignore
   ```

2. **НЕ используйте одинаковые БД для DEV и PROD**
   ```env
   # ОЧЕНЬ ПЛОХО
   POSTGRES_DB=eatfit24  # И для DEV и для PROD
   
   # ХОРОШО
   # DEV: POSTGRES_DB=eatfit24_dev
   # PROD: POSTGRES_DB=eatfit24
   ```

3. **НЕ игнорируйте environment guards**
   ```bash
   # ПЛОХО - видите FATAL, но игнорируете
   [FATAL] DEV environment cannot connect to PROD database
   # "Ладно, потом разберусь"
   
   # ХОРОШО - сразу исправляйте
   ```

4. **НЕ используйте production ключи в DEV**
   ```env
   # ПЛОХО
   # .env.local содержит:
   YOOKASSA_SECRET_KEY=live_***  # ← Production ключ!
   
   # ХОРОШО
   YOOKASSA_SECRET_KEY=REPLACE_ME  # Плейсхолдер
   ```

5. **НЕ запускайте production без health check**
   ```bash
   # ПЛОХО
   docker compose up -d
   # И сразу ушли
   
   # ХОРОШО
   docker compose up -d
   curl http://localhost:8000/health/
   # Проверили что все OK
   ```

### 🔒 Security Checklist

**Перед deploy в production проверьте:**

- [ ] `APP_ENV=prod` (не `dev`)
- [ ] `DEBUG=false` (не `true`)
- [ ] `POSTGRES_DB=eatfit24` (не `eatfit24_dev`)
- [ ] `SECRET_KEY` - уникальный, минимум 50 символов
- [ ] `POSTGRES_PASSWORD` - сильный, отличается от DEV
- [ ] `YOOKASSA_SECRET_KEY=live_***` (не `test_***`)
- [ ] `YOOKASSA_MODE=prod` (не `test`)
- [ ] `SECURE_SSL_REDIRECT=true`
- [ ] `SESSION_COOKIE_SECURE=true`
- [ ] `CSRF_COOKIE_SECURE=true`
- [ ] Health check возвращает `app_env: "prod"`

**После deploy проверьте логи:**
```bash
docker compose logs backend | grep "STARTUP"
# [STARTUP] APP_ENV=prod ✓
# [STARTUP] POSTGRES_DB=eatfit24 ✓
# [STARTUP] YOOKASSA_MODE=prod ✓
# Environment guards: PASSED ✓
```

---

## Мониторинг

### Health Check Endpoint

**URL:** `https://eatfit24.ru/health/`

**Response Example:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "python_version": "3.12.12",
  "app_env": "prod",
  "timestamp": 1768222029,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "celery": "ok"
  },
  "celery_workers": 1
}
```

### Что проверять

1. **`app_env`** - должно совпадать с реальным окружением
   - DEV: `"dev"`
   - PROD: `"prod"`

2. **`checks.database`** - должно быть `"ok"`
   - Если `"error"` - проблемы с PostgreSQL

3. **`checks.redis`** - должно быть `"ok"`
   - Если `"error"` - проблемы с Redis

4. **`checks.celery`** - может быть `"ok"` или `"warning: no active workers"`
   - Celery не критичен для health check
   - Если `"warning"` - Celery workers не запущены (проверьте celery-worker контейнер)

5. **`celery_workers`** - количество активных воркеров
   - PROD: обычно ≥ 1
   - Если `0` - проверьте `docker compose ps celery-worker`

### Алерты

**Рекомендуется настроить алерты на:**

```bash
# Health check возвращает не 200
curl -f https://eatfit24.ru/health/ || alert "Health check failed"

# app_env не совпадает с ожиданием
APP_ENV=$(curl -s https://eatfit24.ru/health/ | jq -r '.app_env')
[[ "$APP_ENV" != "prod" ]] && alert "Wrong app_env: $APP_ENV"

# Celery workers = 0
WORKERS=$(curl -s https://eatfit24.ru/health/ | jq -r '.celery_workers')
[[ "$WORKERS" -eq 0 ]] && alert "No Celery workers"
```

---

## Changelog

### v2.0 (2026-01-12)

**Added:**
- ✅ Environment Guards в `backend/entrypoint.sh`
- ✅ Startup logging (APP_ENV, POSTGRES_DB, YOOKASSA_MODE)
- ✅ Enhanced health check с `app_env` и `celery_workers`
- ✅ `env_file: .env` в `compose.yml` для всех сервисов
- ✅ Comprehensive тесты (`test_environment_guards.py`, `test_smoke.py`)

**Changed:**
- 📝 Упрощена схема: один `.env` файл вместо `.env.prod`/симлинков
- 📝 Убрана зависимость от `compose.prod.yml` (все в `.env`)

**Security:**
- 🛡️ DEV не может подключиться к PROD БД
- 🛡️ PROD не может подключиться к DEV БД
- 🛡️ PROD не может использовать `test_` ключи YooKassa

### v1.0 (2025-12-XX)

- Базовая конфигурация с `.env.example`

---

## FAQ

**Q: Почему нельзя использовать симлинки `.env -> .env.local`?**

A: Docker Desktop на Windows плохо работает с symlinks. Используйте копирование:
```bash
cp .env.local .env
```

**Q: Почему guards так строгие? Можно ли их отключить?**

A: Guards защищают от **критических ошибок** (случайное подключение DEV к PROD БД, использование test ключей в prod). Отключать **НЕ рекомендуется**. Если действительно нужно - измените `backend/entrypoint.sh`.

**Q: Как добавить новую переменную?**

1. Добавьте в `.env.local` с плейсхолдером `REPLACE_ME`
2. Добавьте в `.env.example` с описанием
3. Добавьте в этот документ в раздел "Переменные окружения"
4. Обновите production `.env` на сервере

**Q: Что делать если забыл какой файл используется?**

```bash
# Проверьте логи startup
docker compose logs backend | grep "STARTUP"

# Должны увидеть реальные значения:
# [STARTUP] APP_ENV=dev
# [STARTUP] POSTGRES_DB=eatfit24_dev
```

**Q: Можно ли запустить production локально?**

Технически да, но **не рекомендуется**:
```bash
# Создайте .env с PROD переменными
# APP_ENV=prod, POSTGRES_DB=eatfit24, и т.д.

docker compose up -d

# НО это создаст путаницу и может быть опасно
```

Лучше используйте staging окружение отдельно.

---

## Поддержка

**Вопросы по конфигурации:**
- Проверьте этот документ
- Проверьте [`KNOWN_ISSUES_RESOLUTION.md`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/docs/KNOWN_ISSUES_RESOLUTION.md)
- Посмотрите логи: `docker compose logs backend | grep "STARTUP\|FATAL"`

**Проблемы с guards:**
- Убедитесь что `APP_ENV` совпадает с `POSTGRES_DB`
- DEV: `APP_ENV=dev` + `POSTGRES_DB=eatfit24_dev`
- PROD: `APP_ENV=prod` + `POSTGRES_DB=eatfit24`

**Документация:**
- [KNOWN_ISSUES_RESOLUTION.md](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/docs/KNOWN_ISSUES_RESOLUTION.md) - резолюция 5 известных проблем
- [ENV_MIGRATION_GUIDE.md](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/docs/ENV_MIGRATION_GUIDE.md) - legacy, история миграций
- `.env.example` - шаблон переменных

---

**Версия документа:** 2.0  
**Production Ready:** ✅ Да  
**Last Verified:** 2026-01-12

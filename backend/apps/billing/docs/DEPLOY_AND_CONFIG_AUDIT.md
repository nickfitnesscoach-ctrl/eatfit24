# Deploy и Config — Аудит

**Дата аудита**: 2025-12-17  
**Аудитор**: Senior Backend Architect / Payment Systems Engineer

---

## Обзор

| Файл | Назначение |
|------|------------|
| `Dockerfile` | Multi-stage build для Django |
| `docker-compose.yml` | Orchestration всех сервисов |
| `.env.example` | Документация env переменных |

---

## Dockerfile

**Файл:** `backend/Dockerfile`

### Структура
```
Stage 1: builder (python:3.12-slim)
  - Install gcc, libpq-dev
  - pip install requirements.txt
  
Stage 2: runtime (python:3.12-slim)
  - Copy packages from builder
  - Copy project files
  - ENTRYPOINT: entrypoint.sh
```

**✓ Хорошо:**
- Multi-stage build (меньший размер)
- Без gcc в runtime
- PYTHONUNBUFFERED=1

### Проблемы

### P2-DEP-01: Нет версий пакетов в Dockerfile
- **Где**: `Dockerfile`
- **Проблема**: `pip install gunicorn psycopg2-binary dj-database-url` без версий
- **Последствия**: Непредсказуемые версии при rebuild
- **Рекомендация**: Указать версии или добавить в requirements.txt
- **Сложность**: S

---

## docker-compose.yml

### Сервисы

| Сервис | Image | Порт | Зависимости |
|--------|-------|------|-------------|
| db | postgres:15 | 5432 | - |
| redis | redis:7-alpine | 6379 | - |
| backend | ./backend | 8000 | db, redis |
| celery-worker | ./backend | - | db, redis |
| bot | ./bot | - | db, backend |
| frontend | ./frontend | 3000 | backend |

### Backend env vars (billing-related)

```yaml
- YOOKASSA_MODE=${YOOKASSA_MODE:-test}
- YOOKASSA_SHOP_ID_TEST=${YOOKASSA_SHOP_ID_TEST}
- YOOKASSA_API_KEY_TEST=${YOOKASSA_API_KEY_TEST}
- YOOKASSA_SHOP_ID_PROD=${YOOKASSA_SHOP_ID_PROD}
- YOOKASSA_API_KEY_PROD=${YOOKASSA_API_KEY_PROD}
- YOOKASSA_RETURN_URL=${YOOKASSA_RETURN_URL}
- WEBHOOK_TRUST_XFF=${WEBHOOK_TRUST_XFF:-false}
- WEBHOOK_TRUSTED_PROXIES=${WEBHOOK_TRUSTED_PROXIES:-127.0.0.1,172.23.0.0/16}
- BILLING_RECURRING_ENABLED=${BILLING_RECURRING_ENABLED:-false}
```

**✓ Хорошо:**
- Безопасные defaults (test mode, XFF disabled)
- Отдельные credentials для test/prod

### Celery Worker

```yaml
celery-worker:
  command: celery -A config worker -l info -Q ai,billing,default --concurrency=4
```

**⚠ Проблема:** Все очереди на одном worker — billing может заблокироваться AI задачами

### Redis

```yaml
redis:
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy volatile-lru
```

**✓ Хорошо:** volatile-lru вместо allkeys-lru (не удаляет task results)

---

## .env.example

### Billing переменные

| Переменная | Default | Описание |
|------------|---------|----------|
| `YOOKASSA_MODE` | test | test/prod |
| `YOOKASSA_SHOP_ID_TEST` | - | Test shop ID |
| `YOOKASSA_API_KEY_TEST` | - | Test API key |
| `YOOKASSA_SHOP_ID_PROD` | - | Prod shop ID |
| `YOOKASSA_API_KEY_PROD` | - | Prod API key |
| `YOOKASSA_RETURN_URL` | - | URL после оплаты |
| `YOOKASSA_WEBHOOK_SECRET` | - | (не используется) |
| `WEBHOOK_TRUST_XFF` | false | Trust X-Forwarded-For |
| `WEBHOOK_TRUSTED_PROXIES` | 127.0.0.1,172.23.0.0/16 | Trusted proxy IPs |

### Проблемы

### P2-DEP-02: YOOKASSA_WEBHOOK_SECRET не используется
- **Где**: `.env.example`
- **Проблема**: Переменная документирована, но не используется в коде
- **Последствия**: Путаница, ложное ощущение безопасности
- **Рекомендация**: Либо удалить, либо реализовать HMAC signature verification
- **Сложность**: M

### P2-DEP-03: BILLING_RECURRING_ENABLED не документирован
- **Где**: `.env.example`
- **Проблема**: Переменная используется в коде, но не в .env.example
- **Последствия**: Путаница при deploy
- **Рекомендация**: Добавить в .env.example с описанием
- **Сложность**: S

---

## Опасные default значения

| Переменная | Default | Риск |
|------------|---------|------|
| `YOOKASSA_MODE` | test | ✓ Безопасно |
| `WEBHOOK_TRUST_XFF` | false | ✓ Безопасно |
| `BILLING_RECURRING_ENABLED` | false | ✓ Безопасно |
| `DEBUG` | False | ✓ Безопасно |

**Статус:** ✓ Безопасные defaults

---

## Проблемы при rebuild / stale images

### Сценарий 1: Стоящие контейнеры при rebuild

**Проблема:** `docker-compose up -d` не перебилдит изменённые images

**Решение:**
```bash
docker-compose build --no-cache backend
docker-compose up -d --force-recreate backend
```

### Сценарий 2: Несовпадение migrations

**Проблема:** Backend image обновлён, migrations не применены

**Решение:** entrypoint.sh должен запускать migrate (проверить!)

### P2-DEP-04: Celery worker делает migrate
- **Где**: `docker-compose.yml`
- **Проблема**: `celery-worker` делает `python manage.py migrate` перед стартом
- **Последствия**: Race condition если backend и celery стартуют одновременно
- **Рекомендация**: Migrate только в backend, celery ждёт с retry
- **Сложность**: M

```yaml
# Текущее
celery-worker:
  command: |
    python manage.py migrate --noinput
    celery -A config worker ...

# Рекомендация
celery-worker:
  command: celery -A config worker ...
  depends_on:
    backend:
      condition: service_healthy  # backend уже сделал migrate
```

---

## Healthchecks

| Сервис | Healthcheck | Интервал |
|--------|-------------|----------|
| db | pg_isready | 10s |
| redis | redis-cli ping | 10s |
| backend | curl /health/ | 30s |
| celery-worker | celery inspect ping | 30s |
| frontend | curl / | 30s |

**✓ Хорошо:** Все критические сервисы имеют healthcheck

---

## Резюме

| Компонент | Статус | Критичность |
|-----------|--------|-------------|
| Multi-stage build | ✓ | - |
| Safe defaults | ✓ | - |
| Healthchecks | ✓ | - |
| Celery queue separation | ⚠ | P2 |
| Migrate race condition | ⚠ | P2 |
| Unused WEBHOOK_SECRET | ⚠ | P2 |
| Package versions | ⚠ | P2 |

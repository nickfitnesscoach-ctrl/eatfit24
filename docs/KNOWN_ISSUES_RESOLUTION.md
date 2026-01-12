# Резолюция Известных Проблем EatFit24

**Дата:** 2026-01-12  
**Версия:** 1.0

---

## Executive Summary

Проведен полный аудит и ремедиация 5 известных проблем проекта.

**Результаты:**
- ✅ **2 проблемы** — не обнаружены (уже решены в архитектуре)
- ✅ **3 проблемы** — исправлены с добавлением safeguards

---

## 1. HTTP 301 Redirects

**Статус:** ✅ Проблема не обнаружена

**Проверено:**
- [`backend/nginx-host.conf`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/nginx-host.conf)
- [`frontend/nginx.conf`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/frontend/nginx.conf)

**Результат:** Конфигурация nginx корректна:
- Нет цепочек редиректов
- `absolute_redirect off` включен в frontend nginx
- Все proxy_pass настроены правильно

**Действия:** Только документация (никаких изменений не требовалось)

---

## 2. Dual DB Access

**Статус:** ✅ Проблема решена архитектурой

**Архитектура:**
- **Bot** → использует только HTTP API через `backend_api` client
- **Backend** → единственный владелец PostgreSQL БД

**Доказательства:**
- `bot/` не содержит файлов `models.py`
- Все обращения к данным идут через [`bot/app/services/backend_api.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/bot/app/services/backend_api.py)
- Нет прямых SQL-запросов в боте

**Действия:** Только документация (архитектура корректна)

---

## 3. Environment Isolation

**Статус:** 🟢 Реализовано с runtime safeguards

### Текущая реализация

**Environment Variables:**
- `APP_ENV=dev|prod` — основной флаг окружения
- `COMPOSE_PROJECT_NAME=eatfit24_dev` vs `eatfit24_prod` — изоляция Docker volumes
- `POSTGRES_DB=eatfit24_dev` vs `eatfit24_prod` — разные БД

### Добавленные Safeguards

#### Backend Entrypoint Guards

**Файл:** [`backend/entrypoint.sh`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/entrypoint.sh)

**Guards:**

1. **DEV → PROD Database Prevention**
   ```bash
   if [ "${APP_ENV}" = "dev" ]; then
       if [ "${POSTGRES_DB}" = "eatfit24_prod" ]; then
           echo "[FATAL] DEV environment cannot connect to PROD database"
           exit 1
       fi
   fi
   ```

2. **PROD → DEV Database Prevention**
   ```bash
   if [ "${APP_ENV}" = "prod" ]; then
       if [ "${POSTGRES_DB}" = "eatfit24_dev" ]; then
           echo "[FATAL] PROD environment cannot connect to DEV database"
           exit 1
       fi
   fi
   ```

3. **PROD Test Key Prevention**
   ```bash
   if echo "${YOOKASSA_SECRET_KEY}" | grep -q "test_"; then
       echo "[FATAL] PROD cannot use test YooKassa key"
       exit 1
   fi
   ```

4. **Startup Logging**
   ```bash
   echo "[STARTUP] APP_ENV=${APP_ENV}"
   echo "[STARTUP] POSTGRES_DB=${POSTGRES_DB}"
   echo "[STARTUP] YOOKASSA_MODE=${YOOKASSA_MODE}"
   ```

#### Bot Entrypoint Logging

**Файл:** [`bot/entrypoint.sh`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/bot/entrypoint.sh)

**Logging:**
```bash
echo "[BOT STARTUP] APP_ENV=${APP_ENV}"
echo "[BOT STARTUP] ENVIRONMENT=${ENVIRONMENT}"
echo "[BOT STARTUP] BACKEND_URL=${DJANGO_API_URL}"
```

### Тесты

**Файл:** [`backend/apps/core/tests/test_environment_guards.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/apps/core/tests/test_environment_guards.py)

**Покрытие:**
- Проверка наличия guards в entrypoint.sh
- Проверка блокировки test_ ключей
- Проверка startup logging

**Запуск:**
```bash
cd backend
docker compose exec backend python manage.py test apps.core.tests.test_environment_guards
```

---

## 4. Celery Beat

**Статус:** ✅ Корректно настроен

**Конфигурация:** [`backend/config/celery.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/config/celery.py)

**Periodic Tasks (4 задачи):**

1. **billing-retry-stuck-webhooks** — каждые 5 мин
2. **billing-alert-failed-webhooks** — каждые 15 мин  
3. **billing-cleanup-pending-payments** — каждый час
4. **billing-process-due-renewals** — каждый час

**Логирование при старте:**
```python
@app.on_after_configure.connect
def log_celery_config(sender, **kwargs):
    logger.info("[CELERY CONFIG] beat_schedule: %d task(s) configured", task_count)
    for task_name, task_config in schedule.items():
        logger.info("  ✓ %s", task_name)
```

**Проверка в production:**
```bash
docker compose logs celery-beat | grep "beat_schedule"
# Expected: 4 task(s) configured
```

---

## 5. Monitoring

**Статус:** 🟢 Расширен comprehensive health check

### Health Check Endpoint

**URL:** `/health/`  
**Файл:** [`backend/apps/common/views.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/apps/common/views.py)

**Проверки:**
- ✅ **Database** — `SELECT 1` query
- ✅ **Redis** — cache read/write test
- ✅ **Celery** — active workers count (non-critical)
- ✅ **Environment** — APP_ENV, timestamp

**Response Example:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "python_version": "3.12.0",
  "app_env": "dev",
  "timestamp": 1736686526,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "celery": "ok"
  },
  "celery_workers": 1
}
```

> [!WARNING]
> **Security Note:** `/health/` is designed as an **internal monitoring endpoint**.
> 
> При публичном экспонировании:
> - Рекомендуется ограничить доступ (firewall, VPN, trusted IPs)
> - ИЛИ урезать поля в response (удалить `app_env`, `celery_workers`, `checks` детали)
> - Используйте `/live/` для публичных health checks (минимальный response)

### Использование

**Локально:**
```bash
curl http://localhost:8000/health/ | jq
```

**Production:**
```bash
curl https://eatfit24.ru/health/ | jq
```

**Docker healthcheck:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health/"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Тесты

**Файл:** [`backend/apps/core/tests/test_smoke.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/apps/core/tests/test_smoke.py)

**Покрытие:**
- ✅ Health endpoint возвращает 200
- ✅ Response содержит все обязательные поля
- ✅ Checks structure корректна
- ✅ Database и Redis статусы = "ok"

**Запуск:**
```bash
cd backend
docker compose exec backend python manage.py test apps.core.tests.test_smoke
```

---

## Verification

### Manual Testing

#### 1. Environment Guards

**Test DEV → PROD блокируется:**
```bash
export APP_ENV=dev
export POSTGRES_DB=eatfit24_prod
docker compose -f compose.yml -f compose.dev.yml up backend
# Expected: Container crashes with "[FATAL] DEV environment cannot connect to PROD database"
```

**Test PROD → test key блокируется:**
```bash
export APP_ENV=prod
export YOOKASSA_SECRET_KEY=test_abcdef12345
docker compose up backend
# Expected: Container crashes with "[FATAL] PROD cannot use test YooKassa key"
```

#### 2. Startup Logging

**Проверка логов:**
```bash
docker compose logs backend | grep "STARTUP"
docker compose logs bot | grep "BOT STARTUP"
```

**Expected output:**
```
[STARTUP] APP_ENV=dev
[STARTUP] POSTGRES_DB=eatfit24_dev
[STARTUP] YOOKASSA_MODE=test
[BOT STARTUP] APP_ENV=dev
```

#### 3. Health Check

**Проверка endpoint:**
```bash
curl http://localhost:8000/health/ | jq
```

**Expected:**
- `status: "ok"`
- `checks.database: "ok"`
- `checks.redis: "ok"`
- `checks.celery: "ok"` or `"warning: no active workers"`

### Automated Tests

**Запуск всех новых тестов:**
```bash
cd backend
docker compose exec backend python manage.py test apps.core.tests.test_smoke
docker compose exec backend python manage.py test apps.core.tests.test_environment_guards
```

**Expected:** All tests passing ✓

---

## Summary

| Проблема | До | После | Изменения |
|----------|-----|-------|-----------|
| HTTP 301 Redirects | ✅ OK | ✅ OK | Нет |
| Dual DB Access | ✅ OK | ✅ OK | Нет |
| Environment Isolation | 🟡 Partial | ✅ Fixed | Guards, logging, tests |
| Celery Beat | ✅ OK | ✅ OK | Нет (логирование уже было) |
| Monitoring | 🟡 Basic | ✅ Enhanced | Celery check, APP_ENV, tests |

**Файлы изменены:**
- [`backend/entrypoint.sh`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/entrypoint.sh) — guards + logging
- [`bot/entrypoint.sh`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/bot/entrypoint.sh) — logging
- [`backend/apps/common/views.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/apps/common/views.py) — enhanced health check
- [`backend/apps/core/tests/test_smoke.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/apps/core/tests/test_smoke.py) — health check tests
- [`backend/apps/core/tests/test_environment_guards.py`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/backend/apps/core/tests/test_environment_guards.py) — guards tests (новый)

**Новые файлы:**
- [`docs/KNOWN_ISSUES_RESOLUTION.md`](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/01_PROJECTS/eatfit24/docs/KNOWN_ISSUES_RESOLUTION.md) — эта документация

---

## Next Steps

### Required for Production:

> [!IMPORTANT]
> **CI/CD Integration (Required):**
> 
> Следующие тесты **ОБЯЗАТЕЛЬНЫ** для выполнения в CI pipeline перед deploy:
> - `apps.core.tests.test_environment_guards` — проверка наличия guards
> - `apps.core.tests.test_smoke` — smoke tests включая health check
> 
> Без этих тестов deploy должен блокироваться.

**Мониторинг (Required):**
1. Настроить алерты на `/health/` endpoint (status ≠ "ok")
2. Проверить startup logs в production после deploy:
   ```bash
   docker compose logs backend | grep "STARTUP"
   docker compose logs bot | grep "BOT STARTUP"
   ```

### Опциональные улучшения (будущее):

- Prometheus/Grafana метрики
- Sentry integration для ERROR-only alerts
- Алерт на `celery_workers == 0`
- Расширенный Celery Beat healthcheck

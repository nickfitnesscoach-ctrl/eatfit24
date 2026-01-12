# Health Monitor - Production Мониторинг

## Обзор

`health-monitor.sh` — простейший health check мониторинг для production окружения EatFit24.

**Философия:**
- Без Prometheus/Sentry (слишком сложно для текущего масштаба)
- Простой bash скрипт + cron
- Алерты через Telegram (используем существующего бота)
- Минимальные зависимости (только `jq` и `curl`)

## Характеристики

- **Частота проверок:** Каждые 5 минут (через cron)
- **Alert cooldown:** 15 минут (предотвращает спам)
- **Логирование:** `/opt/eatfit24/logs/health-monitor.log`
- **State tracking:** `/opt/eatfit24/.health_monitor_last_alert`

## Что проверяет

### 1. HTTP Status Code
- **Endpoint:** `https://eatfit24.ru/health/`
- **Ожидание:** HTTP 200
- **Severity:** CRITICAL
- **Action:** Check backend logs, verify nginx/gunicorn

### 2. APP_ENV
- **Источник:** JSON response `.app_env`
- **Ожидание:** `"prod"`
- **Severity:** WARNING
- **Action:** Check `.env` configuration, verify `APP_ENV=prod`

### 3. Database Health
- **Источник:** JSON response `.checks.database`
- **Ожидание:** `"ok"`
- **Severity:** CRITICAL
- **Action:** Check PostgreSQL container (`docker ps`, `docker logs eatfit24-db-1`)

### 4. Redis Health
- **Источник:** JSON response `.checks.redis`
- **Ожидание:** `"ok"`
- **Severity:** CRITICAL
- **Action:** Check Redis container (`docker ps`, `docker logs eatfit24-redis-1`)

### 5. Celery Workers
- **Источник:** JSON response `.celery_workers`
- **Ожидание:** `>= 1`
- **Severity:** WARNING
- **Action:** Check celery-worker container (`docker ps`, `docker logs eatfit24-celery-worker-1`)

## Использование

### Manual Run (тестирование)

```bash
cd /opt/eatfit24
./scripts/health-monitor.sh
```

Выход:
- Exit code 0: Всё OK
- Exit code 1: Есть проблемы (смотри логи)

### View Logs

```bash
# All alerts
cat /opt/eatfit24/logs/health-monitor.log

# Last 20 alerts
tail -20 /opt/eatfit24/logs/health-monitor.log

# Follow in real-time (wait for next alert)
tail -f /opt/eatfit24/logs/health-monitor.log
```

### Check Alert State

```bash
# View cooldown state
cat /opt/eatfit24/.health_monitor_last_alert

# Example output:
# http_status=1768226500
# celery_workers=1768226800
```

Формат: `<alert_key>=<unix_timestamp>`

## Cron Setup

### View Current Cron

```bash
crontab -l
```

Ожидается:
```
*/5 * * * * /opt/eatfit24/scripts/health-monitor.sh >/dev/null 2>&1
```

### Edit Cron (если нужно)

```bash
crontab -e
```

Добавить:
```
*/5 * * * * /opt/eatfit24/scripts/health-monitor.sh >/dev/null 2>&1
```

### Verify Cron Executes

```bash
# Check syslog for cron activity
grep CRON /var/log/syslog | tail -10

# Check script logs (должны обновляться каждые 5 минут при проблемах)
ls -lh /opt/eatfit24/logs/health-monitor.log
```

## Telegram Alerts

### Формат сообщений

**HTTP Status Failure:**
```
🔴 EatFit24 Health Check Failed

HTTP Status: 500
Expected: 200

Action: Check backend logs
```

**Wrong Environment:**
```
⚠️ EatFit24 Wrong Environment

APP_ENV: dev
Expected: prod

Action: Check .env configuration
```

**Database Check Failed:**
```
🔴 EatFit24 Database Check Failed

Status: error
Expected: ok

Action: Check PostgreSQL container
```

**Redis Check Failed:**
```
🔴 EatFit24 Redis Check Failed

Status: error
Expected: ok

Action: Check Redis container
```

**Celery Workers Warning:**
```
⚠️ EatFit24 Celery Workers Warning

Active workers: 0
Expected: >= 1

Action: Check celery-worker container
```

### Alert Recipients

Определяется через `.env` переменную `TELEGRAM_ADMINS`:

```bash
TELEGRAM_ADMINS=310151740
# Или несколько (comma-separated):
TELEGRAM_ADMINS=310151740,123456789
```

## Troubleshooting

### Alerts не приходят

1. **Проверить TELEGRAM_BOT_TOKEN и TELEGRAM_ADMINS в .env:**
   ```bash
   cd /opt/eatfit24
   grep -E '^(TELEGRAM_BOT_TOKEN|TELEGRAM_ADMINS)=' .env
   ```

2. **Test run вручную:**
   ```bash
   ./scripts/health-monitor.sh
   ```

   Если нет ошибок — значит всё OK (нет проблем для алертинга).

3. **Проверить cron:**
   ```bash
   crontab -l | grep health-monitor
   ```

4. **Проверить логи cron:**
   ```bash
   grep health-monitor /var/log/syslog | tail -20
   ```

### Слишком много alerts (спам)

Причина: Cooldown может быть слишком коротким или проблема персистентная.

**Решение:**
1. Исправить проблему (см. Action в алерте)
2. Увеличить cooldown в скрипте (по умолчанию 15 минут):
   ```bash
   # В health-monitor.sh, строка:
   local cooldown_seconds=900  # Изменить на 1800 (30 минут)
   ```

### Alerts не сбрасываются после исправления

Причина: Alert state file хранит timestamp последнего алерта.

**Решение:**
```bash
# Сбросить state для конкретного алерта
cd /opt/eatfit24
sed -i '/^http_status=/d' .health_monitor_last_alert

# ИЛИ сбросить все alerts
rm .health_monitor_last_alert
```

После следующего check (в течение 5 минут) state будет пересоздан.

### jq не установлен

```bash
sudo apt-get update && sudo apt-get install -y jq
```

Если `jq` недоступен, скрипт пропускает JSON parsing (проверяет только HTTP status).

## Архитектура

```
Cron (every 5 min)
    ↓
health-monitor.sh
    ↓
curl https://eatfit24.ru/health/
    ↓
Parse JSON (jq)
    ↓
Check each field
    ↓
should_alert() → Check cooldown
    ↓
send_alert() → Telegram API
    ↓
record_alert() → Update state file
    ↓
Log to health-monitor.log
```

## Security Notes

- ✅ Скрипт не хранит секреты (читает из `.env`)
- ✅ Использует `--data-urlencode` для безопасного encoding
- ✅ Redirect stdout/stderr в cron (`>/dev/null 2>&1`)
- ✅ Read-only операции (не меняет конфигурацию сервера)

## Future Improvements

Если мониторинг нужно масштабировать:

1. **Memory/CPU anomaly detection** — добавить проверки `docker stats`
2. **Container restart detection** — проверять `docker ps --format "{{.Status}}"`
3. **Disk space monitoring** — добавить `df -h` checks
4. **Response time tracking** — измерять latency `/health/` endpoint

Но для текущего масштаба (1 сервер, 5 контейнеров) — **текущая реализация достаточна**.

## Installation Checklist

- [x] Script создан: `/opt/eatfit24/scripts/health-monitor.sh`
- [x] Executable permissions: `chmod +x`
- [x] `jq` установлен
- [x] `.env` содержит `TELEGRAM_BOT_TOKEN` и `TELEGRAM_ADMINS`
- [x] Cron настроен: `*/5 * * * *`
- [x] Test run выполнен: `./scripts/health-monitor.sh`
- [x] Test alert отправлен в Telegram
- [x] Logs directory создана: `/opt/eatfit24/logs/`

## Operational Baseline

При здоровой системе:
- HTTP status: 200
- app_env: "prod"
- checks.database: "ok"
- checks.redis: "ok"
- celery_workers: 1 (или больше)

Любое отклонение → alert в Telegram в течение 5 минут.

---

**Created:** 2026-01-12
**Author:** DevOps Agent
**Status:** Active in production

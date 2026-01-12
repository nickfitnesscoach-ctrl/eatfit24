#!/bin/bash
# Simple health monitor with Telegram alerts
# Runs every 5 minutes via cron
# NO SECRETS IN THIS SCRIPT - reads from .env

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source <(grep -v '^#' "$PROJECT_DIR/.env" | grep -E '^(TELEGRAM_BOT_TOKEN|TELEGRAM_ADMINS)=')
    set +a
fi

HEALTH_URL="https://eatfit24.ru/health/"
ALERT_FILE="$PROJECT_DIR/.health_monitor_last_alert"

# Function to send Telegram alert
send_alert() {
    local message="$1"

    # Split by comma if multiple admins
    IFS=',' read -ra admin_ids <<< "$TELEGRAM_ADMINS"

    for admin_id in "${admin_ids[@]}"; do
        admin_id=$(echo "$admin_id" | xargs)
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${admin_id}" \
            --data-urlencode text="$message" >/dev/null 2>&1
    done

    # Log alert locally
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $message" >> "$PROJECT_DIR/logs/health-monitor.log"
}

# Function to check if we should alert (prevent spam)
should_alert() {
    local alert_key="$1"
    local cooldown_seconds=900  # 15 minutes

    if [ ! -f "$ALERT_FILE" ]; then
        return 0
    fi

    local last_alert=$(grep "^${alert_key}=" "$ALERT_FILE" 2>/dev/null | cut -d'=' -f2)
    if [ -z "$last_alert" ]; then
        return 0
    fi

    local now=$(date +%s)
    local diff=$((now - last_alert))

    if [ $diff -gt $cooldown_seconds ]; then
        return 0
    fi

    return 1
}

# Function to record alert
record_alert() {
    local alert_key="$1"
    local now=$(date +%s)

    mkdir -p "$(dirname "$ALERT_FILE")"

    # Update or append alert timestamp
    if grep -q "^${alert_key}=" "$ALERT_FILE" 2>/dev/null; then
        sed -i "s/^${alert_key}=.*/${alert_key}=${now}/" "$ALERT_FILE"
    else
        echo "${alert_key}=${now}" >> "$ALERT_FILE"
    fi
}

# Main health check
check_health() {
    # Check HTTP status
    local http_status=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "$HEALTH_URL")

    if [ "$http_status" != "200" ]; then
        if should_alert "http_status"; then
            send_alert "🔴 EatFit24 Health Check Failed

HTTP Status: ${http_status}
Expected: 200

Action: Check backend logs"
            record_alert "http_status"
        fi
        return 1
    fi

    # Parse JSON response
    if ! command -v jq &> /dev/null; then
        # jq not available, skip JSON checks
        return 0
    fi

    local app_env=$(jq -r '.app_env' /tmp/health_response.json 2>/dev/null)
    local db_check=$(jq -r '.checks.database' /tmp/health_response.json 2>/dev/null)
    local redis_check=$(jq -r '.checks.redis' /tmp/health_response.json 2>/dev/null)
    local celery_workers=$(jq -r '.celery_workers' /tmp/health_response.json 2>/dev/null)

    # Check app_env
    if [ "$app_env" != "prod" ]; then
        if should_alert "app_env"; then
            send_alert "⚠️ EatFit24 Wrong Environment

APP_ENV: ${app_env}
Expected: prod

Action: Check .env configuration"
            record_alert "app_env"
        fi
    fi

    # Check database
    if [ "$db_check" != "ok" ]; then
        if should_alert "database"; then
            send_alert "🔴 EatFit24 Database Check Failed

Status: ${db_check}
Expected: ok

Action: Check PostgreSQL container"
            record_alert "database"
        fi
    fi

    # Check Redis
    if [ "$redis_check" != "ok" ]; then
        if should_alert "redis"; then
            send_alert "🔴 EatFit24 Redis Check Failed

Status: ${redis_check}
Expected: ok

Action: Check Redis container"
            record_alert "redis"
        fi
    fi

    # Check Celery workers (warning level, not critical)
    if [ "$celery_workers" = "0" ] || [ -z "$celery_workers" ]; then
        if should_alert "celery_workers"; then
            send_alert "⚠️ EatFit24 Celery Workers Warning

Active workers: ${celery_workers}
Expected: >= 1

Action: Check celery-worker container"
            record_alert "celery_workers"
        fi
    fi

    # Cleanup temp file
    rm -f /tmp/health_response.json
}

# Run check
check_health

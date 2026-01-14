#!/usr/bin/env bash
set -euo pipefail

# Config file must export:
# TELEGRAM_BOT_TOKEN=...
# ADMIN_TELEGRAM_ID=...
CONFIG_FILE="/opt/eatfit24/.env.monitor"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
else
  echo "Missing $CONFIG_FILE" >&2
  exit 1
fi

: "${TELEGRAM_BOT_TOKEN:?missing TELEGRAM_BOT_TOKEN}"
: "${ADMIN_TELEGRAM_ID:?missing ADMIN_TELEGRAM_ID}"

WARN=70
CRIT=85

LOCK_FILE="/tmp/disk-alert.lock"
ALERT_COOLDOWN=86400 # 24h

HOST="$(hostname)"
USAGE="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
FREE="$(df -hP / | awk 'NR==2 {print $4}')"

send_alert() {
  local level="$1"
  local emoji="$2"
  local threshold="$3"

  curl -fsS --max-time 10 \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${ADMIN_TELEGRAM_ID}" \
    --data-urlencode "text=${emoji} ${HOST} диск ${level}: ${USAGE}% used (free ${FREE}, threshold ${threshold}%)" \
    >/dev/null
}

cooldown_active() {
  if [[ -f "$LOCK_FILE" ]]; then
    local last now
    last="$(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)"
    now="$(date +%s)"
    if (( now - last < ALERT_COOLDOWN )); then
      return 0
    fi
  fi
  return 1
}

if (( USAGE >= CRIT )); then
  if cooldown_active; then exit 0; fi
  send_alert "CRITICAL" "🚨" "$CRIT"
  touch "$LOCK_FILE"
elif (( USAGE >= WARN )); then
  if cooldown_active; then exit 0; fi
  send_alert "WARNING" "⚠️" "$WARN"
  touch "$LOCK_FILE"
else
  rm -f "$LOCK_FILE"
fi

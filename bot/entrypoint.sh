#!/bin/bash
set -e

echo "🚀 Starting bot entrypoint..."

# ============================================================
# ENVIRONMENT LOGGING (Audit Trail)
# ============================================================
echo "[BOT STARTUP] APP_ENV=${APP_ENV:-unset}"
echo "[BOT STARTUP] ENVIRONMENT=${ENVIRONMENT:-unset}"
echo "[BOT STARTUP] BACKEND_URL=${DJANGO_API_URL:-unset}"


# Ждём доступности Django Backend API
echo "⏳ Waiting for Backend API to be ready..."
BACKEND_URL="${DJANGO_API_URL:-http://backend:8000/api/v1}"
HEALTH_URL="${BACKEND_URL%/api/v1}/health/"

for i in {1..30}; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "✅ Backend API is ready!"
        break
    fi
    echo "Backend API is unavailable - attempt $i/30, sleeping..."
    sleep 2
done

if ! curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "⚠️ Backend API health check failed, but continuing to start the bot"
fi

# Запускаем бота
echo "🤖 Starting the bot..."
exec python main.py

#!/usr/bin/env bash
# Monthly media size baseline tracker
# Runs 1st of every month at 09:05 MSK
# Purpose: Track media growth trend without alerting

set -euo pipefail

MEDIA_PATH="/var/lib/eatfit24/media/uploads"
LOG_FILE="/var/log/media-baseline.log"

# Get size and count
MEDIA_SIZE=$(du -sh "$MEDIA_PATH" 2>/dev/null | awk '{print $1}')
FILE_COUNT=$(find "$MEDIA_PATH" -type f 2>/dev/null | wc -l)
TIMESTAMP=$(date -Iseconds)

# Log baseline
echo "$TIMESTAMP | uploads: $MEDIA_SIZE | files: $FILE_COUNT" >> "$LOG_FILE"

# Optional: Send to Telegram for visibility (uncomment if wanted)
# source /opt/eatfit24/.env.monitor
# curl -fsS --max-time 10 \
#   -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
#   -d "chat_id=${ADMIN_TELEGRAM_ID}" \
#   --data-urlencode "text=📸 Monthly baseline: media/uploads = $MEDIA_SIZE ($FILE_COUNT files)" \
#   >/dev/null

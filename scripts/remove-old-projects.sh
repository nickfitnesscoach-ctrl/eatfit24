#!/bin/bash
# Remove old project volumes (youtube-media-bot, kbju_bot, foodmind)
# ONLY run this if you're 100% sure you don't need these projects!

set -e

echo "===================================="
echo "REMOVE OLD PROJECT VOLUMES"
echo "===================================="
echo ""
echo "⚠️  WARNING: This will PERMANENTLY delete data from old projects:"
echo "   - youtube-media-bot"
echo "   - kbju_bot"
echo "   - foodmind"
echo ""
echo "Volumes to be removed:"
echo ""

VOLUMES_TO_REMOVE=(
    "2025-09-30_youtube-media-bot_bot_downloads"
    "2025-09-30_youtube-media-bot_bot_logs"
    "2025-09-30_youtube-media-bot_postgres_data"
    "2025-09-30_youtube-media-bot_redis_data"
    "2025-09-30_youtube-media-bot_telegram_api_data"
    "youtube-media-bot_bot_downloads"
    "youtube-media-bot_bot_logs"
    "youtube-media-bot_postgres_data"
    "youtube-media-bot_redis_data"
    "youtube-media-bot_telegram_api_data"
    "ymb_bot_downloads"
    "ymb_bot_logs"
    "ymb_postgres_data"
    "ymb_redis_data"
    "ymb_telegram_api_data"
    "kbju_bot_kbju_sqlite"
    "foodmind_db-data"
    "foodmind_redis-data"
)

for vol in "${VOLUMES_TO_REMOVE[@]}"; do
    echo "  - $vol"
done

echo ""
echo "Total volumes: ${#VOLUMES_TO_REMOVE[@]}"
echo ""

# Calculate approximate size
echo "Calculating size..."
TOTAL_SIZE=0
for vol in "${VOLUMES_TO_REMOVE[@]}"; do
    if docker volume inspect "$vol" &>/dev/null; then
        SIZE=$(docker system df -v | grep "$vol" | awk '{print $3}' || echo "0")
        echo "  $vol: $SIZE"
    fi
done
echo ""

read -p "⚠️  Are you ABSOLUTELY SURE you want to delete these volumes? (yes/no) " -r
echo
if [[ $REPLY == "yes" ]]; then
    echo "Removing volumes..."
    for vol in "${VOLUMES_TO_REMOVE[@]}"; do
        if docker volume inspect "$vol" &>/dev/null; then
            echo "  Removing $vol..."
            docker volume rm "$vol" || echo "    ⚠️  Failed to remove $vol (might be in use)"
        else
            echo "  ⏭️  $vol not found (already removed?)"
        fi
    done
    echo ""
    echo "✅ Cleanup complete!"
    echo ""
    echo "Remaining volumes:"
    docker volume ls
    echo ""
    echo "Disk usage:"
    df -h /
else
    echo "❌ Cancelled. No volumes were removed."
fi
echo ""

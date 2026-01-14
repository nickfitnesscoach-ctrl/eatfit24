#!/bin/bash
# Safe Disk Cleanup Script for EatFit24
# Освобождает ~20GB без риска потери данных

set -e

echo "===================================="
echo "SAFE DISK CLEANUP - EatFit24"
echo "===================================="
echo ""

# 1. Configure Docker log rotation
echo "Step 1: Configuring Docker log rotation..."
echo "Current daemon.json:"
cat /etc/docker/daemon.json 2>/dev/null || echo "No daemon.json found"
echo ""

read -p "Update /etc/docker/daemon.json with log rotation? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "dns": ["1.1.1.1", "8.8.8.8"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
    echo "✅ Log rotation configured"

    echo "Restarting Docker daemon..."
    sudo systemctl restart docker
    sleep 5

    echo "Restarting EatFit24 services..."
    cd /opt/eatfit24
    docker compose up -d
    echo "✅ Docker restarted"
else
    echo "⏭️  Skipped"
fi
echo ""

# 2. Clean build cache
echo "Step 2: Cleaning Docker build cache..."
echo "Current cache size:"
docker system df | grep "Build Cache"
echo ""

read -p "Clean build cache? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker builder prune -af
    echo "✅ Build cache cleaned"
else
    echo "⏭️  Skipped"
fi
echo ""

# 3. Clean unused images
echo "Step 3: Cleaning unused Docker images..."
echo "Current images:"
docker system df | grep "Images"
echo ""

read -p "Clean unused images? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker image prune -af
    echo "✅ Unused images cleaned"
else
    echo "⏭️  Skipped"
fi
echo ""

# 4. Clean unused volumes (SAFE MODE)
echo "Step 4: Cleaning unused Docker volumes..."
echo "Current volumes:"
docker volume ls
echo ""
echo "Unused volumes that will be removed:"
docker volume ls --filter "dangling=true"
echo ""

read -p "Clean ONLY unused volumes? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker volume prune -f
    echo "✅ Unused volumes cleaned"
else
    echo "⏭️  Skipped"
fi
echo ""

# 5. Final report
echo "===================================="
echo "CLEANUP COMPLETE"
echo "===================================="
echo ""
echo "Disk usage after cleanup:"
df -h /
echo ""
echo "Docker disk usage:"
docker system df
echo ""
echo "⚠️  Note: Old project volumes (youtube-media-bot, kbju_bot, foodmind)"
echo "are still present. Review and remove manually if needed:"
echo ""
echo "docker volume rm youtube-media-bot_bot_downloads youtube-media-bot_bot_logs \\"
echo "  youtube-media-bot_postgres_data youtube-media-bot_redis_data \\"
echo "  youtube-media-bot_telegram_api_data \\"
echo "  kbju_bot_kbju_sqlite \\"
echo "  foodmind_db-data foodmind_redis-data"
echo ""

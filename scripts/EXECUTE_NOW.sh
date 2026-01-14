#!/bin/bash
# CRITICAL: Execute these commands on the server NOW
# Copy-paste this entire block into your SSH session

set -e

echo "===================================="
echo "STEP 1: CONFIGURE DOCKER LOG ROTATION"
echo "===================================="
echo ""

# Backup current config
sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Update daemon.json
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "dns": ["1.1.1.1", "8.8.8.8"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

echo "✅ daemon.json updated:"
cat /etc/docker/daemon.json
echo ""

# Restart Docker
echo "Restarting Docker daemon..."
sudo systemctl restart docker
echo "✅ Docker restarted"
echo ""

# Wait for Docker to be ready
sleep 5

# Restart EatFit24 services
echo "Restarting EatFit24 services..."
cd /opt/eatfit24
docker compose up -d
echo "✅ EatFit24 restarted"
echo ""

# Verify services
echo "Checking service status..."
docker compose ps
echo ""

# Check health
echo "Checking health endpoint..."
curl -s -H "Host: eatfit24.ru" http://localhost:8000/health/ | jq . || echo "⚠️ Health check failed"
echo ""

echo "===================================="
echo "STEP 1 COMPLETE - Log rotation configured!"
echo "===================================="
echo ""
echo "Now run: bash /tmp/disk-cleanup-safe.sh"
echo ""

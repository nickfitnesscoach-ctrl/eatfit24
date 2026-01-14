#!/bin/bash
# STEP 1: Configure Docker Log Rotation
# Run this on the server: bash /tmp/step1-log-rotation.sh

set -e

echo "================================================"
echo "STEP 1: CONFIGURING DOCKER LOG ROTATION"
echo "================================================"
echo ""

# Backup current config
echo "Backing up current daemon.json..."
sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Show current config
echo "Current configuration:"
cat /etc/docker/daemon.json
echo ""

# Update daemon.json
echo "Updating daemon.json with log rotation..."
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

echo "✅ New configuration:"
cat /etc/docker/daemon.json
echo ""

# Restart Docker
echo "Restarting Docker daemon..."
sudo systemctl restart docker
echo "✅ Docker daemon restarted"
echo ""

# Wait for Docker to be ready
echo "Waiting for Docker to be ready..."
sleep 5

# Restart EatFit24 services
echo "Restarting EatFit24 services..."
cd /opt/eatfit24
docker compose up -d
echo ""

# Check status
echo "Checking service status..."
docker compose ps
echo ""

# Verify log rotation is applied to existing containers
echo "Verifying log rotation config..."
docker inspect eatfit24-backend-1 2>/dev/null | grep -A 5 "LogConfig" || echo "Container not found (will be created with new config)"
echo ""

# Check health
echo "Checking health endpoint..."
sleep 3
curl -s -H "Host: eatfit24.ru" http://localhost:8000/health/ | jq . 2>/dev/null || curl -s -H "Host: eatfit24.ru" http://localhost:8000/health/
echo ""

echo "================================================"
echo "✅ STEP 1 COMPLETE!"
echo "================================================"
echo ""
echo "Log rotation configured successfully:"
echo "  - Max log file size: 10MB"
echo "  - Max log files: 3"
echo "  - Total max per container: 30MB"
echo ""
echo "Next step: Run cleanup script"
echo "  bash /tmp/disk-cleanup-safe.sh"
echo ""

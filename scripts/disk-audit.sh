#!/bin/bash
# Disk Space Audit Script for EatFit24
# Usage: ./disk-audit.sh > disk_audit_report.txt

echo "===================================="
echo "DISK SPACE AUDIT - $(date)"
echo "===================================="
echo ""

echo "1. DISK USAGE OVERVIEW"
echo "------------------------------------"
df -h
echo ""

echo "2. TOP DISK CONSUMERS AT ROOT LEVEL"
echo "------------------------------------"
sudo du -h --max-depth=1 / 2>/dev/null | sort -h | tail -20
echo ""

echo "3. /var DIRECTORY BREAKDOWN"
echo "------------------------------------"
sudo du -h --max-depth=1 /var 2>/dev/null | sort -h | tail -15
echo ""

echo "4. /var/lib DIRECTORY BREAKDOWN"
echo "------------------------------------"
sudo du -h --max-depth=1 /var/lib 2>/dev/null | sort -h | tail -15
echo ""

echo "5. /var/log SIZE"
echo "------------------------------------"
sudo du -h --max-depth=1 /var/log 2>/dev/null | sort -h | tail -10
echo ""

echo "6. DOCKER ANALYSIS"
echo "------------------------------------"
echo "Docker root directory:"
sudo du -h --max-depth=1 /var/lib/docker 2>/dev/null | sort -h | tail -10
echo ""
echo "Container logs:"
sudo ls -lh /var/lib/docker/containers/*/*.log 2>/dev/null | head -20
echo ""
echo "Docker daemon config:"
cat /etc/docker/daemon.json 2>/dev/null || echo "No daemon.json found"
echo ""

echo "7. EATFIT24 MEDIA"
echo "------------------------------------"
sudo du -h --max-depth=2 /var/lib/eatfit24 2>/dev/null
echo ""

echo "8. POSTGRESQL SIZE"
echo "------------------------------------"
sudo du -h --max-depth=1 /var/lib/postgresql 2>/dev/null
echo ""

echo "9. NGINX LOGS"
echo "------------------------------------"
sudo ls -lh /var/log/nginx 2>/dev/null
echo ""

echo "10. TEMP DIRECTORIES"
echo "------------------------------------"
echo "/tmp:"
sudo du -h --max-depth=1 /tmp 2>/dev/null | sort -h | tail -5
echo "/var/tmp:"
sudo du -h --max-depth=1 /var/tmp 2>/dev/null | sort -h | tail -5
echo ""

echo "11. DOCKER VOLUMES & UNUSED OBJECTS"
echo "------------------------------------"
echo "Volumes:"
docker volume ls
echo ""
echo "Unused objects summary:"
docker system df
echo ""

echo "===================================="
echo "AUDIT COMPLETE"
echo "===================================="

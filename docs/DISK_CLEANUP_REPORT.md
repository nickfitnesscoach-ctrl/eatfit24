# Disk Space Audit & Cleanup Report — EatFit24

**Date:** 2026-01-14
**Server:** eatfit24.ru (85.198.81.133)
**Status:** ⚠️ 76% full (37GB / 50GB) — Cleanup required

---

## 📊 Executive Summary

**Total space that can be freed: ~23GB (63% of used space)**

| Component | Current Size | Reclaimable | % |
|-----------|-------------|-------------|---|
| Docker Build Cache | 18.44GB | 12.82GB | 69% |
| Docker Images | 8.52GB | 5.34GB | 62% |
| Docker Volumes | 5.05GB | 4.98GB | 98% |
| **TOTAL** | **32.01GB** | **23.14GB** | **72%** |

---

## 🔥 Critical Issues Found

### 1. Docker Log Rotation NOT CONFIGURED ⚠️ BLOCKER

**Problem:**
- `/etc/docker/daemon.json` missing `log-driver` and `log-opts`
- Container logs grow indefinitely
- **Current config:** Only DNS settings

```json
{ "dns": ["1.1.1.1", "8.8.8.8"] }
```

**Impact:** Disk will fill up over time (P0 issue)

**Fix:** See "Action Plan" below

---

### 2. Docker Build Cache — 18.44GB (12.82GB reclaimable)

**Cause:** Old build layers from previous deployments
**Risk:** LOW (safe to clean)
**Command:** `docker builder prune -af`

---

### 3. Docker Images — 8.52GB (5.34GB reclaimable)

**Problem:**
- 346 total images
- Only 10 active images
- 336 dangling/unused images (97%)

**Cause:** Old image versions not cleaned up after deployments
**Risk:** LOW (safe to clean)
**Command:** `docker image prune -af`

---

### 4. Docker Volumes — 5.05GB (4.98GB reclaimable)

**Problem:**
- 30 total volumes
- Only 4 active volumes
- 26 unused volumes (87%)

**Dead projects found:**
- `youtube-media-bot_*` (5 volumes)
- `2025-09-30_youtube-media-bot_*` (5 volumes)
- `ymb_*` (5 volumes)
- `kbju_bot_*` (1 volume)
- `foodmind_*` (2 volumes)

**Duplicates found:**
- `eatfit24-redis-data` vs `eatfit24_redis_data`
- `eatfit24-backend-static` vs `eatfit24_backend_static`

**Risk:** MEDIUM (need to verify active volumes before removal)

---

## 🎯 Action Plan

### Phase 1: URGENT (Do NOW) — 5 minutes

#### ⚡ Fix Docker Log Rotation (BLOCKER)

```bash
# 1. Update daemon.json
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

# 2. Restart Docker daemon
sudo systemctl restart docker

# 3. Verify EatFit24 is running
cd /opt/eatfit24
docker compose ps

# 4. Check services are healthy
curl -H "Host: eatfit24.ru" http://localhost:8000/health/
```

**Expected result:** Each container limited to 30MB logs (10MB × 3 files)

**Verification:**
```bash
cat /etc/docker/daemon.json
# Should show log-driver and log-opts
```

---

### Phase 2: SAFE CLEANUP (10 minutes) — Free ~18GB

Use the automated script:

```bash
# Upload script to server
scp scripts/disk-cleanup-safe.sh deploy@85.198.81.133:/tmp/

# Run on server
ssh deploy@85.198.81.133
chmod +x /tmp/disk-cleanup-safe.sh
/tmp/disk-cleanup-safe.sh
```

**What it does:**
1. ✅ Configure log rotation (if not done in Phase 1)
2. ✅ Clean build cache (~12.82GB)
3. ✅ Remove unused images (~5.34GB)
4. ✅ Remove unused volumes (safe mode)

**Total freed:** ~18GB

---

### Phase 3: MANUAL CLEANUP (Optional) — Free ~5GB

Remove old project volumes (ONLY if you're sure they're not needed):

```bash
# Upload script
scp scripts/remove-old-projects.sh deploy@85.198.81.133:/tmp/

# Run on server
ssh deploy@85.198.81.133
chmod +x /tmp/remove-old-projects.sh
/tmp/remove-old-projects.sh
```

**Removes:**
- All youtube-media-bot volumes
- All kbju_bot volumes
- All foodmind volumes

**Total freed:** ~5GB

---

## 🔍 What's Still Unknown (Need sudo access)

To complete the audit, run these commands manually on the server:

```bash
# Docker overlay2 size (container filesystems)
sudo du -sh /var/lib/docker/overlay2

# Docker container logs
sudo du -sh /var/lib/docker/containers
sudo ls -lh /var/lib/docker/containers/*/*.log | head -20

# EatFit24 media files
sudo du -h --max-depth=2 /var/lib/eatfit24

# PostgreSQL database size
sudo du -sh /var/lib/postgresql

# System logs
sudo du -h --max-depth=1 /var/log | sort -h | tail -10
```

---

## 📋 Expected Results After Cleanup

| Metric | Before | After | Saved |
|--------|--------|-------|-------|
| Disk Usage | 37GB (76%) | ~14GB (28%) | 23GB |
| Available Space | 13GB | 36GB | +23GB |
| Docker Build Cache | 18.44GB | 6GB | 12.44GB |
| Docker Images | 8.52GB | 3GB | 5.52GB |
| Docker Volumes | 5.05GB | 0.07GB | 4.98GB |

---

## 🚀 Quick Commands Reference

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Safe cleanup (all in one)
docker builder prune -af && \
docker image prune -af && \
docker volume prune -f

# Check active volumes
docker volume ls --filter "dangling=false"

# List container log sizes
sudo du -sh /var/lib/docker/containers/*

# Verify log rotation is working
docker inspect eatfit24-backend-1 | grep -A 5 LogConfig
```

---

## 🛡️ Prevention (Future)

### 1. Automated Docker Cleanup (Recommended)

Add to crontab:

```bash
# Clean Docker weekly (Sundays at 3 AM MSK)
0 3 * * 0 /usr/bin/docker system prune -af --volumes --filter "until=168h" >> /var/log/docker-cleanup.log 2>&1
```

### 2. Monitor Disk Usage

Add to monitoring:

```bash
# Alert if disk > 80%
df -h / | awk 'NR==2 {print $5}' | sed 's/%//' | \
  awk '{if ($1 > 80) print "ALERT: Disk usage at " $1 "%"}'
```

### 3. Media Files Retention Policy

Add Celery task to cleanup old AI photos:

```python
# In backend/apps/nutrition/tasks.py
@shared_task
def cleanup_old_ai_photos():
    """Delete AI-generated photos older than 90 days"""
    threshold = timezone.now() - timedelta(days=90)
    # Implementation...
```

Schedule in `config/celery.py`:

```python
'nutrition-cleanup-old-photos': {
    'task': 'apps.nutrition.tasks.cleanup_old_ai_photos',
    'schedule': crontab(hour=4, minute=0, day_of_week=1),  # Mondays 4 AM MSK
},
```

---

## ⚠️ DO NOT DO

❌ `docker system prune -a` without audit
❌ `rm -rf /var/lib/docker` (will break Docker)
❌ Manually delete volumes without verification
❌ Delete PostgreSQL data
❌ Clear logs without setting up rotation first

---

## 📞 Next Steps

1. ✅ Run Phase 1 (log rotation) — **NOW**
2. ✅ Run Phase 2 (safe cleanup) — **TODAY**
3. ⏸️ Run Phase 3 (old projects) — **When confirmed**
4. 📊 Collect sudo data for complete audit — **This week**
5. 🔄 Set up automated cleanup — **This week**

---

## 🔗 Scripts Created

- [`scripts/disk-audit.sh`](../scripts/disk-audit.sh) — Full audit report
- [`scripts/disk-cleanup-safe.sh`](../scripts/disk-cleanup-safe.sh) — Safe automated cleanup
- [`scripts/remove-old-projects.sh`](../scripts/remove-old-projects.sh) — Remove old project volumes

---

**Report generated by:** DevOps Agent
**Audit duration:** 15 minutes
**Confidence level:** HIGH (based on `docker system df` output)

# Operations Runbook — EatFit24

Operational procedures, triggers, and decision trees for infrastructure maintenance.

**Last updated:** 2026-01-16
**Owner:** DevOps / Infrastructure

---

## 📊 Current Baselines (as of 2026-01-14)

### Disk Usage
- **Current:** 22% (11GB/50GB)
- **Thresholds:**
  - 70% = WARNING (trend monitoring)
  - 85% = CRITICAL (immediate action)
- **Alert:** Daily at 9 AM MSK via Telegram
- **Cooldown:** 24 hours (anti-spam)

### Docker Resources
- **Images:** 1.3GB (10 active)
- **Build cache:** 0B (cleaned weekly)
- **Volumes:** 222MB (10 volumes, 4 active)
- **Cleanup:** Weekly (Sundays 3 AM MSK)

### Media Storage
- **Current:** 47MB (/var/lib/eatfit24/media/uploads)
- **Files:** 142 files
- **Growth rate:** ~10-20MB/month (MVP stage)
- **Baseline tracking:** Monthly (1st day, 9:05 AM MSK)

### Database
- **MealPhoto records:** 8 (all < 30 days old)
- **Meal records:** 4
- **Retention:** Subscription-driven (FREE=7d, PRO=180d)

---

## 🔄 Automated Maintenance

### Active Cron Jobs

```bash
# Health monitoring (every 5 min)
*/5 * * * * /opt/eatfit24/scripts/health-monitor.sh >/dev/null 2>&1

# Docker cleanup (weekly, Sunday 3 AM MSK)
0 3 * * 0 /opt/eatfit24/scripts/docker-cleanup.sh

# Disk monitoring (daily, 9 AM MSK)
0 9 * * * /opt/eatfit24/scripts/disk-monitor.sh

# Monthly media baseline (1st of month, 9:05 AM MSK)
5 9 1 * * /opt/eatfit24/scripts/media-baseline.sh
```

### Log Rotation

All automated tasks have logrotate configured:

- `/var/log/docker-cleanup.log` — weekly, keep 8 weeks
- `/var/log/media-baseline.log` — monthly, keep 24 months

---

## 🚨 Alert Response Procedures

### Disk Usage Warning (70%)

**Alert message:** `⚠️ eatfit24.ru диск WARNING: 70% used (free XG, threshold 70%)`

**Actions:**
1. Check media growth: `tail -20 /var/log/media-baseline.log`
2. Check Docker resources: `docker system df`
3. Review recent deployments (image accumulation)
4. If media > 500MB, consider activating `cleanup_old_meal_photos` (see below)
5. If Docker cache > 10GB, run manual cleanup: `docker builder prune -af`

**No immediate action required** — this is trend monitoring.

### Disk Usage Critical (85%)

**Alert message:** `🚨 eatfit24.ru диск CRITICAL: 85% used (free XG, threshold 85%)`

**Actions (sequential, check after each step):**
1. **Emergency Docker cleanup:**
   ```bash
   docker builder prune -af
   docker image prune -af --filter "until=168h"
   docker volume prune -f
   ```
2. **Check disk usage again:** `df -h /`
3. **If still critical, check largest directories:**
   ```bash
   du -h /var/lib/eatfit24/media | sort -h | tail -20
   du -h /var/log | sort -h | tail -20
   ```
4. **Consider emergency media cleanup** (see AI Photo Cleanup section below)
5. **If disk still > 80%, escalate:** Consider expanding disk or migrating media to S3

### Health Monitor Failures

**Alert message:** `❌ EatFit24 health check failed (service down)`

**Actions:**
1. Check service status: `docker compose ps`
2. Check logs: `docker compose logs --tail 100 [service]`
3. Restart if needed:
   - **Without env changes:** `docker compose restart [service]`
   - **After env changes:** `docker compose up -d --force-recreate [service]`
   - **Critical:** If restarting backend/celery-worker/celery-beat/bot after `.env` changes, ALWAYS use `--force-recreate` for ALL affected services to avoid env desync
4. Verify: `curl -H "Host: eatfit24.ru" http://localhost:8000/health/`

---

## 🗄️ AI Photo Cleanup Activation

### Current Status: **BACKLOG** (not needed)

**Reason:** Media is only 47MB, all photos < 90 days old, business logic (`cleanup_old_meals`) handles subscription-based cleanup.

### Activation Triggers

**Enable weekly cleanup when ANY of these conditions are met:**

1. **Media size:** `/var/lib/eatfit24/media/uploads` > 500MB
2. **Growth rate:** > 100MB/week (check monthly baselines for trend)
3. **Record count:** `MealPhoto` records > 1,000
4. **Disk pressure:** Overall disk usage trending toward 70%

### Activation Procedure

**Step 1: Dry-run to assess impact**
```bash
cd /opt/eatfit24
docker compose exec backend python manage.py cleanup_old_meal_photos --days 90 --status ALL --dry-run
```

Review output:
- How many photos will be deleted?
- How much space will be freed?
- Any orphaned records?

**Step 2: Manual cleanup (first time)**
```bash
# Remove --dry-run to execute
docker compose exec backend python manage.py cleanup_old_meal_photos --days 90 --status ALL
```

Verify:
- Services still healthy
- No errors in logs
- Media directory size reduced

**Step 3: Add to weekly cron**
```bash
crontab -e

# Add (runs Sunday 4 AM MSK, after Docker cleanup)
0 4 * * 0 cd /opt/eatfit24 && docker compose exec -T backend python manage.py cleanup_old_meal_photos --days 90 >> /var/log/meal-photos-cleanup.log 2>&1
```

**Step 4: Configure logrotate**
```bash
sudo tee /etc/logrotate.d/meal-photos-cleanup > /dev/null <<'EOF'
/var/log/meal-photos-cleanup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
```

### Retention Policy

**Default:** 90 days (configurable via `--days` parameter)

**Rationale:**
- Business cleanup (`cleanup_old_meals`) removes meals based on subscription plan (7d FREE, 180d PRO)
- Infrastructure cleanup targets photos that escaped business rules (orphans, failed uploads, etc.)
- 90 days provides safety margin beyond free tier retention

**Adjust if needed:**
- More aggressive (60 days): If disk pressure is high
- More conservative (180 days): If storage is cheap and data useful for analytics

---

## 📈 Capacity Planning

### Media Growth Projections

**Current baseline:** 47MB, 142 files (2026-01-14)

**Projected growth (conservative):**
- 10-20 MB/month during MVP/low traffic
- 100-200 MB/month at 100 active users
- 500 MB-1 GB/month at 500+ active users

**Storage limits:**
- Current disk: 50GB total
- Safe media cap: ~5GB (10% of disk)
- Alert threshold: 500MB (1% of disk) — triggers cleanup activation

**When to consider S3/external storage:**
- Media consistently > 2GB
- Growth > 500MB/month
- Disk space becoming constraint for other services

### Docker Image Accumulation

**Baseline:** 10 active images (~1.3GB)

**Growth pattern:**
- +300-500MB per deployment (new image versions)
- Old images accumulate if not pruned
- Weekly cleanup keeps this under control

**Manual intervention needed if:**
- Images > 5GB despite weekly cleanup
- Build cache consistently > 10GB
- Suggests frequent deployments or large layer changes

---

## 🔧 Manual Maintenance Commands

### Docker Cleanup (manual)
```bash
# See what's reclaimable
docker system df

# Clean build cache
docker builder prune -af --filter "until=168h"

# Clean unused images
docker image prune -af --filter "until=168h"

# Clean dangling volumes (CAUTION: check first)
docker volume ls --filter dangling=true
docker volume prune -f

# Nuclear option (use only if desperate)
# WARNING: Removes ALL unused resources
docker system prune -a --volumes
```

### Media Cleanup (manual)
```bash
# Check current size
du -sh /var/lib/eatfit24/media/*

# See largest files
find /var/lib/eatfit24/media -type f -exec du -h {} + | sort -rh | head -20

# Cleanup via Django command
cd /opt/eatfit24
docker compose exec backend python manage.py cleanup_old_meal_photos --days 90 --dry-run
```

### Database Cleanup (subscription-driven)
```bash
# Current business logic cleanup
docker compose exec backend python manage.py cleanup_old_meals --dry-run

# Check meal/photo counts
docker compose exec backend python manage.py shell
>>> from apps.nutrition.models import Meal, MealPhoto
>>> Meal.objects.count()
>>> MealPhoto.objects.count()
```

### Log Analysis
```bash
# Check media growth trend
tail -20 /var/log/media-baseline.log

# Check Docker cleanup history
tail -50 /var/log/docker-cleanup.log

# Check disk alerts
grep "диск" /var/log/disk-monitor.log 2>/dev/null || echo "No disk alerts"

# Check service health
tail -100 /var/log/health-monitor.log 2>/dev/null
```

---

## 📞 Escalation Paths

### Disk Space Emergency (>90%)
1. Run emergency Docker cleanup (see above)
2. If still critical, stop non-essential services temporarily
3. Contact infrastructure owner to expand disk or migrate to larger instance
4. Consider immediate migration of media to S3

### Recurring Disk Warnings
1. Review monthly media baselines for growth trend
2. Activate AI photo cleanup if thresholds met (see above)
3. Consider implementing CDN + S3 for media if growth is exponential
4. Plan disk expansion if trend shows 90% within 3 months

### Service Health Degradation
1. Check container logs for errors
2. Check disk I/O and memory usage: `docker stats`
3. Restart affected services:
   - **Without env changes:** `docker compose restart [service]`
   - **After env changes:** `docker compose up -d --force-recreate [service]`
   - **Critical:** If `.env` was modified recently, recreate ALL services that read env vars (backend, celery-worker, celery-beat, bot) to avoid desync
4. If persistent, check for resource exhaustion or application bugs
5. Escalate to development team if application-level issue

---

## 🔧 Known Issues & Solutions

### Environment Desync (AI Tasks Failing with 401/403)

**Symptom:** Photo upload fails with "Ошибка обработки", Celery logs show `401 Unauthorized` or `403 Forbidden` when calling AI Proxy.

**Root cause:** `celery-worker` container has stale/missing `AI_PROXY_SECRET` after backend restart with updated `.env`.

**Why it happens:** `docker compose restart` does NOT reload `.env` changes. Partial restarts (only `backend`) leave other services with old environment.

**Quick fix:**
```bash
cd /opt/eatfit24
docker compose up -d --force-recreate celery-worker
docker compose exec celery-worker env | grep AI_PROXY_SECRET  # Verify
docker compose logs --tail 50 celery-worker  # Check startup
```

**Prevention:** After ANY `.env` modification, recreate ALL affected services:
```bash
docker compose up -d --force-recreate backend celery-worker celery-beat bot
```

**Verification:**
```bash
# All services should have matching secrets
for service in backend celery-worker; do
  echo "=== $service ==="
  docker compose exec $service env | grep AI_PROXY_SECRET | head -c 20
  echo "..."
done
```

**First occurrence:** 2026-01-16 (documented in [CLAUDE.md](../CLAUDE.md) Deployment Invariant #6)

---

## 📚 Related Documentation

- [FINAL_CLEANUP_REPORT.md](../FINAL_CLEANUP_REPORT.md) — Initial disk cleanup (2026-01-14)
- [DISK_CLEANUP_REPORT.md](../docs/DISK_CLEANUP_REPORT.md) — Audit findings
- [CLAUDE.md](../CLAUDE.md) — Development setup and procedures
- [backend/apps/billing/docs/](../backend/apps/billing/docs/) — Billing system operations

---

## 🔄 Runbook Maintenance

**Review frequency:** Quarterly or when infrastructure changes

**Update triggers:**
- Baseline thresholds change significantly
- New services added to stack
- Storage architecture changes (e.g., S3 migration)
- Alert patterns show runbook is outdated

**Last reviewed:** 2026-01-14 (initial creation)

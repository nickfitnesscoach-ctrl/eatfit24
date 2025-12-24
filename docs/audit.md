# EatFit24 Production Audit Report
**Date:** 2025-12-25
**Auditor:** DevOps Agent
**Server:** eatfit24.ru (85.198.81.133)

---

## Executive Summary

**Current Status:** 🔴 **DOWN** — Website returns 502 Bad Gateway
**Root Cause:** Multiple issues in Nginx ↔ Backend chain
**Impact:** Production website inaccessible to users

---

## Issue 1: Backend Port Not Exposed to Host

### Symptom
```
nginx error.log:
connect() failed (111: Connection refused) while connecting to upstream,
upstream: "http://127.0.0.1:8000/health/"
```

### Root Cause
`compose.yml` uses `expose: 8000` instead of `ports: 127.0.0.1:8000:8000`

**Current compose.yml (WRONG):**
```yaml
backend:
  expose:
    - "8000"  # ← Only exposes to Docker internal network
```

**Expected behavior:**
- Nginx on **host** tries to connect to `127.0.0.1:8000`
- Backend runs **inside Docker** with `expose: 8000` (Docker internal only)
- **Result:** Connection refused

### Verification
```bash
# From host
$ ss -lntp | grep :8000
# ← EMPTY (no listener on 8000)

$ curl http://127.0.0.1:8000/health/
curl: (7) Failed to connect to 127.0.0.1 port 8000: Connection refused
```

### Fix Required
Change `compose.yml`:
```yaml
backend:
  ports:
    - "127.0.0.1:8000:8000"  # Bind to localhost only (not exposed to internet)
```

---

## Issue 2: SECURE_SSL_REDIRECT Breaks Healthchecks

### Symptom
Backend container logs show:
```
127.0.0.1 - - [25/Dec/2025:01:10:47 +0300] "GET /health/ HTTP/1.1" 301 0
```

Healthcheck returns `301 Moved Permanently` → healthcheck **fails** (expects 2xx/3xx but follows redirect to HTTPS which isn't available inside container).

### Root Cause
Django `SECURE_SSL_REDIRECT=True` (default in `production.py:68`) redirects **all** HTTP → HTTPS, including internal healthchecks.

**Current behavior:**
```bash
$ docker exec eatfit24-backend curl -i http://127.0.0.1:8000/health/
HTTP/1.1 301 Moved Permanently
Location: https://eatfit24.ru/health/
```

### Fix Required
**Option A (Recommended):** Disable SSL redirect for healthcheck endpoint
- Add middleware exemption for `/health/` path

**Option B:** Set `SECURE_SSL_REDIRECT=False` in `.env`
- **Risk:** Removes defense-in-depth (though Nginx already handles redirect)

---

## Issue 3: Duplicate Nginx Server Blocks

### Symptom
```
nginx -T warnings:
conflicting server name "eatfit24.ru" on 0.0.0.0:80, ignored
conflicting server name "eatfit24.ru" on 0.0.0.0:443, ignored
```

### Root Cause
Multiple nginx config files define same `server_name`:
```bash
/etc/nginx/sites-enabled/
├── default (symlink to sites-available/default)
├── eatfit24.ru
├── eatfit24.ru.backup-20251223-144426
└── eatfit24.ru.bak
```

### Fix Required
```bash
# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Remove backup files from sites-enabled
sudo rm /etc/nginx/sites-enabled/*.bak*

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## Issue 4: Frontend Also Not Accessible

### Symptom
Nginx logs show:
```
connect() failed (111: Connection refused) while connecting to upstream,
upstream: "http://127.0.0.1:3000/"
```

### Root Cause
Same issue as backend — frontend container not accessible from host.

**Current compose.yml:**
```yaml
frontend:
  ports:
    - "80:80"  # ← Port 80 conflict with Nginx
```

This creates port conflict: both Nginx and frontend container try to bind to port 80.

### Verification
```bash
$ ss -lntp | grep :80
LISTEN ... nginx
# ← Nginx already owns port 80, frontend container likely failed to start on this port
```

### Fix Required
Frontend should expose to localhost on different port:
```yaml
frontend:
  ports:
    - "127.0.0.1:3000:80"  # Expose container's 80 → host's 3000
```

---

## Issue 5: ALLOWED_HOSTS Ambiguity

### Current .env
```
ALLOWED_HOSTS=eatfit24.ru,www.eatfit24.ru
DJANGO_ALLOWED_HOSTS=eatfit24.ru,www.eatfit24.ru,localhost,127.0.0.1
```

### Issue
- Two variables with different values
- Django uses `ALLOWED_HOSTS` (from `production.py:24-25`)
- `DJANGO_ALLOWED_HOSTS` is **ignored**

### Fix Required
Unify to single variable with complete list:
```env
ALLOWED_HOSTS=eatfit24.ru,www.eatfit24.ru,localhost,127.0.0.1,backend
```

---

## Docker Container Status (Before Fixes)

```
NAME                     STATUS
eatfit24-backend         Up 57 minutes (healthy)*
eatfit24-bot             Up 52 seconds
eatfit24-celery-beat     Up 57 minutes
eatfit24-celery-worker   Up 57 minutes
eatfit24-db              Up 58 minutes (healthy)
eatfit24-redis           Up 58 minutes (healthy)
eatfit24-frontend        NOT CHECKED (likely unhealthy due to port conflict)
```

*Note: `(healthy)` is misleading — healthcheck passes inside container but service is inaccessible from host.

---

## Backups Created ✅

Before making any changes, backups were created:

1. **Environment file:**
   ```
   /opt/EatFit24/.env.backup.2025-12-25_010631
   ```

2. **PostgreSQL database:**
   ```
   /opt/EatFit24/backups/postgres_backup_2025-12-25_010946.sql.gz (8.8KB)
   ```

3. **Docker state:**
   ```
   Documented container versions and images
   ```

---

## Summary of Required Fixes

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Backend port not exposed to host | 🔴 Critical | Change `expose: 8000` → `ports: 127.0.0.1:8000:8000` |
| 2 | SSL redirect breaks healthcheck | 🔴 Critical | Exempt `/health/` from SSL redirect OR disable `SECURE_SSL_REDIRECT` |
| 3 | Duplicate nginx configs | 🟡 Warning | Remove `default` and `.bak` files from sites-enabled |
| 4 | Frontend port conflict | 🔴 Critical | Change `ports: 80:80` → `ports: 127.0.0.1:3000:80` |
| 5 | ALLOWED_HOSTS confusion | 🟡 Minor | Unify to single `ALLOWED_HOSTS` variable |

---

## Recommended Fix Order

1. **Fix compose.yml** (backend + frontend ports)
2. **Fix ALLOWED_HOSTS** in .env
3. **Fix SSL redirect** (disable for healthcheck or globally)
4. **Clean nginx configs** (remove duplicates)
5. **Restart services** and verify
6. **Update CI/CD** to prevent future issues

---

## Next Steps

See implementation plan in:
- Task 2: [Fix Nginx → Backend routing](#)
- Task 3: [Fix ALLOWED_HOSTS and SSL redirect](#)
- Task 6: [Fix compose healthchecks](#)

# UV Migration - Final Validation Checklist

**Date:** January 7, 2026
**Status:** Ready for Validation

---

## ✅ COMPLETED STEPS

### ШАГ D: UV Initialization
- [x] Created `backend/pyproject.toml` with all dependencies
- [x] Created `bot/pyproject.toml` with all dependencies
- [x] Executed `uv sync --dev` for backend (successful)
- [x] Executed `uv sync --dev` for bot (successful)
- [x] Verified imports: `uv run python -c "import django, celery, redis"`
- [x] Verified imports: `uv run python -c "import aiogram, httpx"`
- [x] Files generated: `backend/uv.lock`, `bot/uv.lock`

### ШАГ E: Documentation
- [x] Created `MIGRATION_UV.md` with complete migration guide
- [x] Documented local development workflow
- [x] Documented Docker strategy (venv binaries)
- [x] Documented CI/CD changes
- [x] Documented rollback procedure

### ШАГ F: Dockerfiles
- [x] Updated `backend/Dockerfile` to use uv
  - Multi-stage build with uv in builder
  - Copy `.venv` from builder to runtime
  - Set `PATH=/app/.venv/bin:$PATH`
  - Removed all pip commands
- [x] Updated `bot/Dockerfile` to use uv
  - Same pattern as backend
- [x] Updated `backend/entrypoint.sh`
  - Changed `python` → `/app/.venv/bin/python`
  - Changed `gunicorn` → `/app/.venv/bin/gunicorn`

### ШАГ G: Compose Files
- [x] Updated `compose.yml`
  - Celery worker: `/app/.venv/bin/celery`
  - Celery beat: `/app/.venv/bin/celery`
- [x] Updated `compose.yml.prod`
  - Same changes as compose.yml
- [x] Updated `docker-compose.dev.yml`
  - Dev runserver: `/app/.venv/bin/python`

### ШАГ H: CI/CD
- [x] Updated `.github/workflows/backend.yml`
  - Install uv via curl
  - Use `uv sync --dev`
  - Use `uv run` for all commands
  - Changed cache from pip to uv
- [x] Updated `.github/workflows/bot.yml`
  - Same uv pattern
  - Ruff/Black via `uv run`

### ШАГ I: Backward Compatibility
- [x] Marked `backend/requirements.txt` as DEPRECATED
- [x] Marked `bot/requirements.txt` as DEPRECATED
- [x] Kept files for emergency rollback
- [x] Added clear warnings in file headers

---

## 🔍 VALIDATION CHECKLIST (Execute Now)

### Local Environment

#### Backend
```bash
cd backend

# 1. Check uv.lock exists and is valid
ls -la uv.lock
file uv.lock  # Should show "Unicode text"

# 2. Sync dependencies
uv sync --dev

# 3. Verify environment
uv run python -c "import django, celery, redis, requests, yookassa, openai; print('All imports OK')"

# 4. Django checks
uv run python manage.py check

# 5. Run a test
uv run pytest apps/ai/tests/test_tasks.py -v -k test_recognize || echo "Tests may need DB setup"
```

**Expected:** All commands succeed without pip-related errors.

#### Bot
```bash
cd bot

# 1. Check uv.lock
ls -la uv.lock

# 2. Sync
uv sync --dev

# 3. Verify imports
uv run python -c "import aiogram, httpx, pydantic, redis; print('All imports OK')"

# 4. Check main.py imports (without running)
uv run python -c "from app.__main__ import main; print('Main imports OK')"
```

**Expected:** All imports successful.

---

### Docker Build

```bash
cd /path/to/Fitness-app

# 1. Build backend image (no cache to ensure clean build)
docker build --no-cache -t eatfit24-backend:uv-test -f backend/Dockerfile backend/

# Expected: Should complete successfully with uv sync logs visible

# 2. Build bot image
docker build --no-cache -t eatfit24-bot:uv-test -f bot/Dockerfile bot/

# 3. Test backend image
docker run --rm eatfit24-backend:uv-test /app/.venv/bin/python -c "import django; print(django.VERSION)"

# Expected: Should print Django version (e.g., (6, 0, 1, 'final', 0))

# 4. Test bot image
docker run --rm eatfit24-bot:uv-test /app/.venv/bin/python -c "import aiogram; print('Bot OK')"

# Expected: Should print "Bot OK"
```

**Expected:** All builds succeed, no pip errors, images are runnable.

---

### Docker Compose (Full Stack)

```bash
cd /path/to/Fitness-app

# 1. Stop any running containers
docker compose down -v

# 2. Build all services
docker compose build --no-cache

# Expected: All services build successfully

# 3. Start services
docker compose up -d

# 4. Check service health
docker compose ps

# Expected: All services "healthy" or "running"

# 5. Check backend logs for uv/venv references
docker logs eatfit24-backend-1 | head -50

# Expected: No pip errors, should see entrypoint logs

# 6. Check celery worker
docker logs eatfit24-celery-worker-1 | grep "celery@"

# Expected: Worker starts, connects to Redis

# 7. Health check
curl -H "Host: eatfit24.ru" http://127.0.0.1:8000/health/

# Expected: {"status": "healthy"}
```

**Expected:** All services start and health checks pass.

---

### CI/CD (GitHub Actions)

**Manual Check:**

1. Go to GitHub repository
2. Navigate to Actions tab
3. Find latest workflow runs for:
   - `Backend CI (EatFit24)`
   - `Bot CI (EatFit24)`

**Expected Behavior:**
- Workflows use `uv sync --dev`
- All commands prefixed with `uv run`
- No `pip install` in logs
- Green checkmark (passing)

**If CI fails:**
- Check logs for "uv: command not found" → PATH issue
- Check for "No solution found" → dependency conflict
- Check for "uv.lock not found" → file not committed

---

## 🚨 CRITICAL VERIFICATION POINTS

### 1. No Pip References
```bash
# Search for forbidden pip usage
cd /path/to/Fitness-app
grep -r "pip install" --include="Dockerfile" --include="*.yml" --include="*.sh" backend/ bot/ .github/ docker-compose* compose*

# Expected: NO MATCHES (except in DEPRECATED requirements.txt comments)
```

### 2. Lock Files Committed
```bash
git status backend/uv.lock bot/uv.lock

# Expected: "nothing to commit" or "Changes to be committed"
# Must NOT show "Untracked files"
```

### 3. Entrypoint Uses Venv Binaries
```bash
grep -n "\.venv/bin" backend/entrypoint.sh compose.yml compose.yml.prod docker-compose.dev.yml

# Expected: Multiple matches showing /app/.venv/bin/python, /app/.venv/bin/celery, etc.
```

### 4. CI Uses UV
```bash
grep -n "uv sync" .github/workflows/backend.yml .github/workflows/bot.yml

# Expected: Both files show "uv sync --dev"
```

---

## 📝 SIGN-OFF CRITERIA

Mark each as ✅ only after successful validation:

- [ ] **Local Dev:** `uv run python manage.py check` passes (backend)
- [ ] **Local Dev:** `uv run pytest` can be executed (bot)
- [ ] **Docker Build:** Both Dockerfiles build without errors
- [ ] **Docker Compose:** All services start and pass health checks
- [ ] **No Pip:** Zero `pip install` references in Docker/CI files
- [ ] **Lock Files:** `uv.lock` committed for backend and bot
- [ ] **CI Workflows:** Both workflows reference `uv sync --dev`
- [ ] **Entrypoints:** All use `/app/.venv/bin/*` pattern
- [ ] **Documentation:** `MIGRATION_UV.md` exists and is complete
- [ ] **DEPRECATED:** `requirements.txt` files marked as deprecated

---

## 🎯 DEFINITION OF DONE

**Migration is COMPLETE when:**

1. ✅ All validation checks pass
2. ✅ Production deploy succeeds with new images
3. ✅ Rollback procedure tested (or documented)
4. ✅ Team onboarded to `uv add` workflow
5. ✅ No regression in functionality

---

## 🔄 ROLLBACK PROCEDURE (If Needed)

### Quick Rollback (Emergency)

1. Revert Dockerfiles:
```bash
git revert <migration-commit-hash>
```

2. Use old requirements.txt:
```bash
# In Dockerfile, change:
# FROM: COPY pyproject.toml uv.lock ./
# TO:   COPY requirements.txt ./
# FROM: RUN uv sync --no-dev
# TO:   RUN pip install --no-cache-dir -r requirements.txt
```

3. Rebuild and deploy:
```bash
docker compose build --no-cache
docker compose up -d
```

### Post-Rollback Actions

- Investigate why uv failed
- Fix issues in dev environment
- Re-attempt migration after validation

---

**Next Step:** Execute validation checks above and mark completed items.

**Contact:** See MIGRATION_UV.md for troubleshooting common issues.

# UV Migration Guide (Python 3.12)

**Status:** ✅ COMPLETED (January 2026)
**Target:** EatFit24 monorepo (backend + bot)

---

## Why uv?

**uv** is a fast, Rust-based Python package manager that replaces pip + venv.

### Benefits:
- ⚡ **10-100x faster** than pip
- 🔒 **Deterministic builds** via `uv.lock`
- 📦 **Single tool** (no pip, setuptools, virtualenv)
- 🎯 **Production-ready** (used by Anthropic, Astral, etc.)

### Decision: Separate uv projects

We chose **separate uv projects** (backend/ and bot/) instead of a monorepo-wide lock:

- **Isolation:** Django (backend) vs aiogram (bot) have different stacks
- **Docker:** Simpler Dockerfile COPY logic (only relevant pyproject.toml + uv.lock)
- **CI:** Parallel workflows without cross-contamination
- **Dependencies:** No conflicts between backend and bot versions

---

## Project Structure

```
/
├── backend/
│   ├── pyproject.toml       # Backend dependencies (Django, Celery)
│   ├── uv.lock              # Lock file (MUST be in git)
│   ├── .venv/               # Virtual environment (DO NOT commit)
│   ├── requirements.txt     # DEPRECATED (kept for rollback only)
│   └── ...
├── bot/
│   ├── pyproject.toml       # Bot dependencies (aiogram, httpx)
│   ├── uv.lock              # Lock file (MUST be in git)
│   ├── .venv/               # Virtual environment (DO NOT commit)
│   ├── requirements.txt     # DEPRECATED (kept for rollback only)
│   └── ...
└── frontend/                # NOT AFFECTED (npm)
```

**CRITICAL:**
- ✅ `uv.lock` files MUST be committed to git
- ❌ `.venv/` directories MUST NOT be committed

---

## Local Development

### Prerequisites

Install uv (once per machine):

```bash
# Linux/macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Verify
uv --version  # Should show uv 0.5.x or higher
```

### Backend Setup

```bash
cd backend

# Install dependencies (creates .venv and reads uv.lock)
uv sync --dev

# Verify installation
uv run python -c "import django, celery, redis; print('Backend OK')"

# Run Django commands
uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py runserver

# Run Celery
uv run celery -A config worker -l INFO --concurrency=2 -Q ai,billing,default
uv run celery -A config beat -l INFO

# Run tests
uv run pytest -v

# Linting
uv run ruff check .
uv run black .
uv run mypy .
```

### Bot Setup

```bash
cd bot

# Install dependencies
uv sync --dev

# Verify
uv run python -c "import aiogram, httpx; print('Bot OK')"

# Run bot (requires TELEGRAM_BOT_TOKEN in .env)
uv run python main.py

# Run tests
uv run pytest tests/ -v
```

### Adding New Dependencies

```bash
# Production dependency
cd backend  # or bot
uv add <package>

# Development dependency
uv add --dev <package>

# Lock file is automatically updated
git add pyproject.toml uv.lock
git commit -m "Add <package> dependency"
```

---

## Docker (Production)

### How It Works

**CRITICAL PRINCIPLE:** In Docker, Python commands are executed via `.venv/bin/*`, NOT via `uv run`.

#### Why?
- **Runtime stability:** No dependency on uv binary in production
- **Performance:** Direct binary execution, no wrapper overhead
- **Simplicity:** Standard Python venv conventions

### Dockerfile Structure (Simplified)

```dockerfile
# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Copy dependency files FIRST (for Docker cache)
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --no-dev

# Copy application code AFTER (doesn't invalidate cache)
COPY . .

# Use direct venv binaries
CMD ["/app/.venv/bin/gunicorn", "--config", "gunicorn_config.py", "config.wsgi:application"]
```

### Entrypoint Pattern

**backend/entrypoint.sh:**
```bash
#!/bin/bash
set -euo pipefail

# Use venv binaries directly
/app/.venv/bin/python manage.py migrate
/app/.venv/bin/python manage.py collectstatic --noinput
exec /app/.venv/bin/gunicorn --config gunicorn_config.py config.wsgi:application
```

**Celery commands in compose.yml:**
```yaml
command: /app/.venv/bin/celery -A config worker -l INFO --concurrency=2 -Q ai,billing,default
```

### Building Images

```bash
# Production build (uses uv)
docker compose -f compose.yml build --no-cache

# Dev build (with live reload)
docker compose -f docker-compose.dev.yml up -d --build
```

---

## CI/CD

### GitHub Actions Setup

**backend.yml:**
```yaml
- name: Setup Python
  uses: actions/setup-python@v5
  with:
    python-version: "3.12"

- name: Install uv
  run: curl -LsSf https://astral.sh/uv/install.sh | sh

- name: Install dependencies
  working-directory: backend
  run: uv sync --dev

- name: Run checks
  working-directory: backend
  run: |
    uv run python manage.py check
    uv run pytest -v
```

**Key Points:**
- ✅ Use `uv sync --dev` (NOT `uv sync`)
- ✅ Run commands via `uv run`
- ❌ NO `pip install` anywhere
- ❌ NO `requirements.txt` in CI

---

## Backward Compatibility

### DEPRECATED Files (DO NOT DELETE YET)

The following files are kept for emergency rollback but are **NOT USED** anywhere:

- `backend/requirements.txt` — marked with "# DEPRECATED: Use pyproject.toml"
- `bot/requirements.txt` — marked with "# DEPRECATED: Use pyproject.toml"

### Rollback Procedure (Emergency)

If uv breaks in production:

1. Revert Dockerfile changes:
   ```dockerfile
   # Old way (emergency only)
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   ```

2. Rebuild and deploy:
   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

**IMPORTANT:** After rollback, investigate the issue and fix uv setup. Rollback is **NOT** a permanent solution.

---

## Common Issues

### Issue: `uv: command not found`

**Solution:** Install uv or use full path:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc  # or restart shell
```

### Issue: `error: No solution found when resolving dependencies`

**Solution:** Version conflict. Check `pyproject.toml` constraints:
```bash
uv lock --verbose  # Shows conflict details
```

### Issue: Docker build fails with "uv.lock not found"

**Solution:** Ensure `uv.lock` is committed:
```bash
git add backend/uv.lock bot/uv.lock
git commit -m "Add uv lock files"
```

### Issue: `.venv` not found in Docker

**Solution:** Check Dockerfile has `RUN uv sync --no-dev` AFTER copying `pyproject.toml` and `uv.lock`.

---

## Verification Checklist

### Local ✅

- [ ] `cd backend && uv sync --dev` completes without errors
- [ ] `cd bot && uv sync --dev` completes without errors
- [ ] `backend/uv.lock` and `bot/uv.lock` exist and are committed
- [ ] `uv run python manage.py check` passes (backend)
- [ ] `uv run pytest` passes (backend and bot)

### Docker ✅

- [ ] `docker compose build --no-cache` succeeds
- [ ] `docker compose up -d` starts all services
- [ ] `docker compose ps` shows all services healthy
- [ ] Backend health endpoint: `curl -H "Host: eatfit24.ru" http://127.0.0.1:8000/health/` returns 200
- [ ] Celery worker connects to Redis (check logs)
- [ ] Bot starts and waits for backend (check logs)

### CI ✅

- [ ] `.github/workflows/backend.yml` passes
- [ ] `.github/workflows/bot.yml` passes
- [ ] Deploy workflow uses Docker images built with uv

---

## Definition of Done

**Migration is complete when:**

1. ✅ `uv.lock` files exist for backend and bot (committed)
2. ✅ All local commands use `uv run`
3. ✅ All Dockerfiles use `uv sync --no-dev` and `/app/.venv/bin/*`
4. ✅ All CI workflows use `uv sync --dev`
5. ✅ `requirements.txt` marked as DEPRECATED (not deleted)
6. ✅ Zero references to `pip install` in Docker/CI
7. ✅ Production deployment succeeds with uv-based images
8. ✅ Rollback procedure documented and tested

---

## References

- **uv Documentation:** https://docs.astral.sh/uv/
- **pyproject.toml Spec:** https://packaging.python.org/en/latest/specifications/pyproject-toml/
- **EatFit24 Project:** See CLAUDE.md for project-specific commands

---

**Last Updated:** January 7, 2026
**Migration Lead:** Claude Sonnet 4.5
**Status:** Production-ready ✅

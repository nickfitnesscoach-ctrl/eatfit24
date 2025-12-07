# EatFit24 Backend Cleanup — December 2025

## Summary

Root directory cleanup of `backend/` to remove unused files and caches.

## Removed

| File | Reason |
|------|--------|
| `__pycache__/` | Python bytecode cache (should never be in git) |
| `.pytest_cache/` | pytest cache (should never be in git) |
| `check_db_data.py` | Legacy diagnostic script, not used in Docker/CI/infra |
| `nginx.conf` | Unused Nginx config for Docker-internal nginx (project uses host nginx via `deploy/nginx-eatfit24.ru.conf`) |

## Kept

| File | Reason |
|------|--------|
| `nginx-host.conf` | Reference config for host-based Nginx setup (localhost:8001 → Django) |
| `pyproject.toml` | Contains **ruff** linter configuration (not Poetry) |
| `.env.example` | Actual environment template for EatFit24 backend |
| `gunicorn_config.py` | Gunicorn production settings |
| `entrypoint.sh` | Docker entrypoint script |
| `Dockerfile` | Backend container build |
| `requirements.txt` | Python dependencies |
| `manage.py` | Django management script |

## Ignore Files Status

### `.gitignore` — OK
Already ignores:
- `__pycache__/`, `*.py[cod]`
- `*.sqlite3`
- `.env`, `*.env.local`
- `logs/`, `media/`, `staticfiles/`
- `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`

### `.dockerignore` — OK
Already ignores:
- `__pycache__/`, `*.py[cod]`
- `.env`, `.env.local`
- `*.sqlite3`
- `.pytest_cache/`, `.coverage`
- `docs/`, `*.md`
- `.git/`, `.github/`

## Infrastructure Notes

- **Database**: PostgreSQL via Docker Compose (no SQLite)
- **Nginx**: Host-based nginx using `deploy/nginx-eatfit24.ru.conf` for production
- **Dependencies**: Managed via `pip install -r requirements.txt` (no Poetry)
- **Linting**: ruff configured in `pyproject.toml`

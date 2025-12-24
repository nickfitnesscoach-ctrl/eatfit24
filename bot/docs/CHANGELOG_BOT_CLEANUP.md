# Bot Cleanup Changelog - SQLAlchemy Removal

**Date**: 2025-12-24  
**Commit**: `chore(bot): remove unused SQLAlchemy/Alembic (API-only bot)`

---

## Summary

Removed all unused SQLAlchemy/Alembic code from the bot. The bot now communicates **only** via Django Backend API (`DJANGO_API_URL`).

---

## Deleted Files/Directories

| Path | Description |
|------|-------------|
| `bot/alembic/` | Alembic migrations directory (4 migrations) |
| `bot/alembic.ini` | Alembic configuration |
| `bot/app/models/` | SQLAlchemy models (User, SurveyAnswer, Plan) |
| `bot/app/services/database/` | DB session and repositories |
| `bot/app/services/django_integration.py` | Legacy API client (unused) |
| `bot/app/schemas/django_api.py` | Legacy Pydantic schemas |

---

## Modified Files

| File | Changes |
|------|---------|
| `bot/app/services/__init__.py` | Removed database imports |
| `bot/app/schemas/__init__.py` | Removed django_api imports |
| `bot/app/config.py` | Removed `DB_*` settings and `database_url` property |
| `bot/entrypoint.sh` | Replaced Alembic migrations with Backend API health check |
| `bot/requirements.txt` | Removed `sqlalchemy`, `asyncpg`, `alembic` |
| `bot/.env.example` | Removed DB section |
| `docker-compose.yml` | Removed `DB_*` env vars from bot service, removed db dependency |

---

## Removed Dependencies

```diff
- sqlalchemy[asyncio]==2.0.36
- asyncpg==0.29.0
- alembic==1.13.3
```

---

## Removed ENV Variables (no longer needed)

| Variable | Status |
|----------|--------|
| `DB_HOST` | ❌ Removed |
| `DB_PORT` | ❌ Removed |
| `DB_NAME` | ❌ Removed |
| `DB_USER` | ❌ Removed |
| `DB_PASSWORD` | ❌ Removed |

---

## Current ENV Variables

### Required (Critical)

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123456:ABC...` |
| `TELEGRAM_BOT_API_SECRET` | Shared secret for X-Bot-Secret header | `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI | `sk-or-...` |
| `DJANGO_API_URL` | Django backend URL | `http://backend:8000/api/v1` |

### Optional (Recommended)

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_ADMIN_ID` | Primary admin Telegram ID | — |
| `ADMIN_IDS` | Comma-separated admin IDs | — |
| `WEB_APP_URL` | Telegram Mini App URL | — |
| `TRAINER_PANEL_BASE_URL` | Trainer panel URL | — |
| `ENVIRONMENT` | `development` / `production` | `development` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `MAX_PLANS_PER_DAY` | Rate limit for plans | `3` |

---

## Required ENV Variables (current)

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from BotFather |
| `TELEGRAM_BOT_API_SECRET` | ✅ | Shared secret for X-Bot-Secret header |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key |
| `DJANGO_API_URL` | ✅ | Django backend URL (e.g., `http://backend:8000/api/v1`) |
| `BOT_ADMIN_ID` | ⚠️ | Admin telegram ID(s) |
| `WEB_APP_URL` | ⚠️ | Mini App URL |
| `TRAINER_PANEL_BASE_URL` | ⚠️ | Trainer panel URL |

---

## Verification

- [x] Import verification: `from app.config import settings` ✅
- [x] Import verification: `from app.services import get_backend_api` ✅
- [x] No SQLAlchemy/Alembic imports in codebase

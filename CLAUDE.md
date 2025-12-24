# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EatFit24 / FoodMind** — AI-powered fitness lead generation and management platform. Monorepo with three services:
- **Backend**: Django REST API with Celery async processing
- **Bot**: Telegram bot using aiogram 3.x
- **Frontend**: React Telegram MiniApp (Vite + TypeScript)

## Quick Commands

### Backend (Django)
```bash
cd backend
python manage.py runserver              # Dev server
python manage.py test                   # Run all tests
pytest -v                               # Alternative: pytest
python manage.py makemigrations         # Create migrations
python manage.py migrate                # Apply migrations
ruff check .                            # Lint
```

### Bot (Telegram)
```bash
cd bot
python main.py                          # Run bot
pytest tests/ -v                        # Run tests
alembic upgrade head                    # Apply migrations
alembic revision --autogenerate -m "description"  # Create migration
```

### Frontend (React)
```bash
cd frontend
npm run dev                             # Dev server (localhost:5173)
npm run build                           # Production build
npm run lint                            # ESLint
npm run type-check                      # TypeScript check
npm run test                            # Vitest
```

### Docker (All Services)
```bash
docker compose up -d                    # Start all services
docker compose logs -f backend          # View logs
docker compose restart backend          # Restart service
docker compose down                     # Stop all
```

## Architecture

### Service Communication

```
Internet → Nginx → Frontend (React MiniApp)
                 → Backend API (Django + DRF)
                       ↓
              Celery Worker (async AI/billing tasks)
                       ↓
              Redis (broker) + PostgreSQL

Telegram → Bot (aiogram) → Django API
                         → PostgreSQL (direct via SQLAlchemy)
```

### Backend Structure (`backend/`)
- `apps/` — Django applications:
  - `ai/` — AI services (OpenRouter integration)
  - `billing/` — Subscriptions and YooKassa payments
  - `nutrition/` — Nutrition tracking
  - `telegram/` — Telegram integration endpoints
  - `users/` — User management
- `config/` — Django settings and Celery config
- Celery queues: `ai`, `billing`, `default`

### Bot Structure (`bot/`)
- `app/handlers/` — Message handlers
- `app/services/` — Business logic
- `app/models/` — SQLAlchemy models
- `alembic/` — Database migrations

### Frontend Structure (`frontend/src/`)
- `pages/` — Page components
- `components/` — Reusable components
- `contexts/` — React contexts (auth, theme)
- `services/` — API integration
- `hooks/` — Custom hooks

## Critical Conventions

### Time & Timezone
**"If it runs on the server — it's UTC."**
- Always use `timezone.now()` in Django, NEVER `datetime.now()`
- Database timestamps are UTC
- Celery Beat crontab uses `Europe/Moscow` (from Django TIME_ZONE)
- Frontend converts UTC to user's local timezone

### Backend Testing
```bash
cd backend
pytest -v                                        # All tests
pytest apps/billing/tests/test_webhooks.py -v   # Single file
pytest -k "test_payment" -v                     # By pattern
```
Uses `config.settings.test` module.

### Bot Testing
```bash
cd bot
pytest tests/ -v
pytest tests/test_critical_bugs.py::test_name -v  # Single test
```
All tests are async with mocked DB and external APIs.

### Frontend Testing
```bash
cd frontend
npm run test                    # Run once
npm run test:watch             # Watch mode
```
Uses Vitest + Testing Library.

## Environment Variables

All services read from root `.env` file. See `.env.example` for required variables.

Key variables:
- `POSTGRES_PASSWORD` — Required, shared by backend and bot
- `SECRET_KEY` — Django secret
- `TELEGRAM_BOT_TOKEN` — Bot token
- `OPENROUTER_API_KEY` — AI API key
- `BILLING_RECURRING_ENABLED` — Enable auto-renew subscriptions

## Celery Tasks

Worker handles queues: `ai`, `billing`, `default`

After modifying `config/celery.py`, reset Beat:
```bash
./scripts/reset-celery-beat.sh
```

Verify tasks are scheduled:
```bash
docker logs --tail 20 eatfit24-celery-beat-1 | grep "Sending due task"
```

## Pre-Deploy Checklist (Backend)

1. `git status` — clean working tree
2. `docker compose ps` — all services healthy
3. `docker exec eatfit24-backend-1 date` — verify UTC
4. `python manage.py migrate --plan` — check pending migrations
5. `docker exec eatfit24-redis-1 redis-cli PING` — Redis responsive

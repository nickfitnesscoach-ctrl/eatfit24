# Deployment & Operations — EatFit24

> **Status:** SSOT
> **Domain:** DevOps, Infrastructure, Lifecycle

---

## 1. Local Development (Quick Start)

### Requirements
- Docker & Docker Compose
- Python 3.11+ (for local IDE support)
- uv (preferred package manager)

### Commands
1. **Setup Env**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```
2. **Start Services**:
   ```bash
   docker compose -f compose.yml -f compose.dev.yml --env-file .env.local up -d
   ```
3. **Database Migrations**:
   ```bash
   docker compose exec backend python manage.py migrate
   ```

---

## 2. Production Deployment

### Infrastructure
- **Cloud Provider**: Timeweb Cloud / Other VPS
- **OS**: Ubuntu 22.04 LTS
- **Network**: Tailscale (for internal AI Proxy communication)

### Deployment Steps
1. **Pull latest code**: `git pull origin main`
2. **Update Environment**: Ensure `.env` is up to date with production values.
3. **Deploy**:
   ```bash
   docker compose up -d --build
   ```
   **Note:** Production uses `compose.yml` + `.env` (single-file strategy). Legacy `compose.prod.yml` is **deprecated** and should not be used.
4. **Automatic Migrations**: Handled by the `backend` container's entrypoint in production.

---

## 3. CI/CD (GitHub Actions)

We use a multi-stage pipeline:
- **Linting**: Ruff and Black for Python, ESLint for JS.
- **Testing**: `pytest` for backend apps (Billing, AI Proxy, Core).
- **Security Audit**: Automated `grep` for secrets and tokens.

---

## 4. Troubleshooting & Disaster Recovery

### Logs
- **Combined**: `docker compose logs -f`
- **Specific**: `docker compose logs -f backend`

### Database Backups
Automated nightly dumps are stored in `/var/lib/eatfit24/backups/` and rotated weekly.

### Common Issues
- **Redis Connection**: If workers fail to pick up tasks, check if `CELERY_BROKER_URL` in `.env` points to correct Redis DB (prod: `redis://redis:6379/1`).
- **Media Permissions**: Ensure `/var/lib/eatfit24/media` is owned by the user running Docker.

### Legacy Files
- **`compose.prod.yml`**: Deprecated as of 2026-01-12. Do not use. Production uses `compose.yml` + `.env`.
- **`.env.prod`**: Deprecated. Use single `.env` file with production values.

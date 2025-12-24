# CI/CD Documentation - EatFit24

**Last Updated:** 2025-12-25
**Pipeline:** GitHub Actions → VPS Deploy

---

## Overview

EatFit24 uses GitHub Actions for automated deployment to production VPS.

**Workflow File:** `.github/workflows/deploy.yml`

---

## Required GitHub Secrets

Configure these in: `Settings → Secrets and variables → Actions → Repository secrets`

| Secret Name | Description | Example |
|------------|-------------|---------|
| `VPS_HOST` | Production server hostname or IP | `eatfit24.ru` or `85.198.81.133` |
| `VPS_USERNAME` | SSH username for deployment | `deploy` |
| `VPS_SSH_KEY` | Private SSH key (ed25519) | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |
| `VPS_SUDO_PASSWORD` | Sudo password for deploy user | `YourSecurePassword123` |

---

## How to Set Up Secrets

### 1. Generate SSH Key (if not already done)
```bash
ssh-keygen -t ed25519 -C "github-actions@eatfit24" -f ~/.ssh/eatfit24_deploy
```

### 2. Add Public Key to Server
```bash
ssh-copy-id -i ~/.ssh/eatfit24_deploy.pub deploy@eatfit24.ru
```

### 3. Copy Private Key to GitHub Secret
```bash
cat ~/.ssh/eatfit24_deploy
# Copy the ENTIRE output (including -----BEGIN/END OPENSSH PRIVATE KEY-----)
# Paste into GitHub Secrets → VPS_SSH_KEY
```

### 4. Set Other Secrets
- `VPS_HOST`: `eatfit24.ru`
- `VPS_USERNAME`: `deploy`
- `VPS_SUDO_PASSWORD`: (ask server administrator)

---

## Trigger Deploy

### Automatic (on push to main)
Deploy automatically triggers when you push to `main` branch with changes in:
- `backend/**`
- `bot/**`
- `frontend/**`
- `compose.yml`
- `.github/workflows/deploy.yml`

### Manual (workflow_dispatch)
1. Go to: `Actions → Deploy to VPS (EatFit24) → Run workflow`
2. Select branch: `main`
3. Services: `all` (default) or specify comma-separated services
4. Click "Run workflow"

---

## Deploy Workflow Steps

The deploy workflow performs these steps:

### 1. Validate Secrets ✅
Checks that all required secrets are configured.

### 2. Check Project Directory 📁
Ensures `/opt/EatFit24` exists. If not, clones repo and exits (manual .env setup required).

### 3. Check .env File 🔐
Verifies `.env` file exists. **Deploy fails if missing** (prevents deploying without config).

### 4. Save Current Commit 💾
Stores current commit hash for rollback if deployment fails.

### 5. Update Code 🔄
- Attempts `git fetch` and `git reset --hard origin/main`
- Fallback: Fresh clone (preserves `.env` and `backups/`)

### 6. Verify compose.yml ✅
Checks that `compose.yml` exists.

### 7. Rebuild & Restart Services 🐳
Runs: `sudo docker compose up -d --build`

**Rollback on failure:** If this step fails, automatically rolls back to previous commit and restarts services.

### 8. Wait for Startup ⏱️
Waits 20 seconds for services to initialize.

### 9. Health Checks 🏥
- **Backend:** `curl http://127.0.0.1:8000/health/` (with Host header)
- **Frontend:** `curl http://127.0.0.1:3000/`
- **Public:** `curl https://eatfit24.ru/health/`

**Deploy fails if backend health check fails after 6 attempts (30 seconds).**

---

## What the Workflow Does NOT Do

✅ **Safe Practices:**
- ❌ Does NOT delete `.env` file
- ❌ Does NOT delete `/opt/EatFit24` directory (unless git fetch fails)
- ❌ Does NOT delete database volumes
- ❌ Does NOT modify `.env` contents
- ✅ DOES preserve `.env` even during fresh clone fallback
- ✅ DOES rollback on failure

---

## Viewing Deploy Logs

### From GitHub UI
1. Go to `Actions` tab
2. Click on latest "Deploy to VPS (EatFit24)" run
3. Click on "deploy" job
4. Expand steps to see logs

### From Server (After Deploy)
```bash
# Container logs
cd /opt/EatFit24
sudo docker compose logs -f

# Backend logs
sudo docker logs --tail 100 eatfit24-backend
```

---

## Common Deploy Failures & Fixes

### ❌ "Missing required secrets"
**Cause:** GitHub secrets not configured

**Fix:**
1. Go to `Settings → Secrets and variables → Actions`
2. Add missing secret (see Required Secrets table above)

---

### ❌ ".env file missing! Cannot deploy without configuration"
**Cause:** `.env` file doesn't exist on server

**Fix:**
```bash
# SSH to server
ssh deploy@eatfit24.ru
cd /opt/EatFit24

# Copy from example
cp .env.example .env

# Edit with production values
nano .env

# Retry deploy from GitHub
```

---

### ❌ "Backend health check failed!"
**Cause:** Backend container unhealthy or not responding

**Fix:**
```bash
# SSH to server
ssh deploy@eatfit24.ru
cd /opt/EatFit24

# Check backend logs
sudo docker logs --tail 200 eatfit24-backend

# Check backend status
sudo docker compose ps backend

# Common causes:
# 1. Database connection failed → check POSTGRES_* vars in .env
# 2. Missing SECRET_KEY → check SECRET_KEY in .env
# 3. Port conflict → check no other service uses port 8000
```

---

### ❌ "Git fetch failed, trying fresh clone..."
**Cause:** Local git state corrupted or merge conflicts

**Fix:**
This is handled automatically (workflow clones fresh copy). `.env` is preserved.

If this happens frequently:
```bash
# SSH to server and manually clean git state
cd /opt/EatFit24
git fetch origin
git reset --hard origin/main
git clean -fd
```

---

## Rollback Strategy

### Automatic Rollback (Built-in)
If `docker compose up` fails, workflow automatically:
1. Rolls back code to previous commit
2. Rebuilds services
3. Reports success/failure of rollback

### Manual Rollback (From Server)
```bash
ssh deploy@eatfit24.ru
cd /opt/EatFit24

# Find last working commit
git log --oneline -10

# Rollback to specific commit
git reset --hard <commit-hash>

# Rebuild services
sudo docker compose up -d --build

# Verify
sudo docker compose ps
curl -I https://eatfit24.ru/health/
```

---

## Testing Deploy Locally (Before Pushing)

### 1. Test Docker Build
```bash
# From local machine
cd /path/to/Fitness-app

# Test backend build
docker build -t test-backend ./backend

# Test frontend build
docker build -t test-frontend ./frontend

# Test bot build
docker build -t test-bot ./bot
```

### 2. Test Compose Config
```bash
# Validate compose file syntax
docker compose -f compose.yml config

# Test compose up (on local machine, using .env.example)
cp .env.example .env
docker compose up -d

# Verify containers start
docker compose ps
```

---

## Deployment Checklist (Before Merging to Main)

- [ ] Code changes tested locally
- [ ] Docker builds succeed locally
- [ ] No secrets hardcoded in code
- [ ] `.env.example` updated with new vars (if any)
- [ ] CI tests pass (backend, bot, frontend workflows)
- [ ] No breaking changes to database schema (or migration plan ready)
- [ ] All team members notified of deploy

---

## Emergency Stop Deployment

If a deployment is running and causing issues:

### 1. Cancel GitHub Action
1. Go to `Actions` tab
2. Click on running workflow
3. Click "Cancel workflow"

### 2. Rollback on Server (Manual)
```bash
ssh deploy@eatfit24.ru
cd /opt/EatFit24

# Find last stable commit
cat .last_deploy_commit

# Rollback
git reset --hard $(cat .last_deploy_commit)
sudo docker compose up -d --build
```

---

## Monitoring Deploy Success

### From GitHub
- ✅ All steps green
- ✅ "🎉 Deploy completed successfully!" in logs

### From Server
```bash
# All containers healthy
sudo docker compose ps

# Backend responds
curl -I https://eatfit24.ru/health/
# HTTP/2 200

# Site accessible
curl -I https://eatfit24.ru/
# HTTP/2 200
```

---

## Best Practices

1. **Always deploy during low-traffic hours** (e.g., early morning)
2. **Monitor logs** immediately after deploy
3. **Test critical flows** after deploy (login, payments, bot commands)
4. **Keep team in Slack/Telegram** during deploy
5. **Have rollback plan ready** before hitting "Deploy"

---

## Deploy Frequency

**Recommended:**
- Features: 1-2 times per week
- Hotfixes: As needed (test thoroughly first)
- Security updates: Immediately

**Not Recommended:**
- Deploying late Friday (less time to fix issues)
- Deploying during peak hours (12 PM - 6 PM MSK)
- Deploying untested code to prod

---

## Future Improvements (Roadmap)

- [ ] Blue-green deployment for zero-downtime
- [ ] Automated database migrations in CI/CD
- [ ] Slack/Telegram notifications on deploy success/failure
- [ ] Automated smoke tests post-deploy
- [ ] Canary deployments for risky changes

---

## Support

**If deploy fails:**
1. Check GitHub Actions logs
2. Check `/opt/EatFit24/docs/OPS_RUNBOOK.md` for troubleshooting
3. Check server logs: `sudo docker compose logs`
4. Contact DevOps team

**Emergency rollback:** See "Manual Rollback" section above

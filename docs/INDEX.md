# EatFit24 Documentation Index

> **Single entry point for all documentation.**  
> **Hard limit: ≤30 active .md files. If not here, doesn't exist.**

---

## 🚀 Quick Start

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Project overview + how to run |
| [QUICKSTART.md](../QUICKSTART.md) | Fast local setup |
| [CLAUDE.md](../CLAUDE.md) | AI agent development guidance |

---

## 📦 Core SSOT (Single Source of Truth)

| Domain | SSOT Document |
|--------|---------------|
| **Operations** | [OPS_RUNBOOK.md](OPS_RUNBOOK.md) |
| **Security** | [SECURITY_AUDIT.md](SECURITY_AUDIT.md) |
| **ENV Variables** | [env/ENV_CONTRACT.md](env/ENV_CONTRACT.md) |
| **Backend Runtime** | [BOOT_AND_RUNTIME.md](../backend/docs/BOOT_AND_RUNTIME.md) |
| **Backend Files** | [ROOT_FILES_MAP.md](../backend/docs/ROOT_FILES_MAP.md) |
| **Billing (Backend)** | [billing/README.md](../backend/apps/billing/docs/README.md) |
| **Telegram** | [telegram/README.md](../backend/apps/telegram/docs/README.md) |
| **AI Proxy** | [ai_proxy/README.md](../backend/apps/ai_proxy/README.md) |
| **Bot** | [bot/README.md](../bot/README.md) |
| **Frontend Billing** | [billing/README.md](../frontend/src/features/billing/docs/README.md) |
| **Frontend Trainer** | [trainer/TRAINER_PANEL.md](../frontend/src/features/trainer-panel/docs/TRAINER_PANEL.md) |

---

## 📁 Near-Code READMEs (minimal, essential)

- `backend/apps/billing/webhooks/README.md`
- `backend/apps/billing/management/commands/README.md`
- `backend/apps/telegram/docs/ops_runbook.md`
- `bot/docs/BOT_API_CALLS.md`
- `frontend/src/features/billing/docs/API_CONTRACT.md`
- `frontend/src/features/billing/docs/STATE_MODEL.md`
- `frontend/README.md`
- `frontend/src/features/ai/README.md`

---

## 🗄️ Archive

Historical documents in [docs/archive/](archive/) — preserved but not active.

---

## 📏 Rules

1. **SSOT = 1 file per domain** — no "v2", no "final_really_final.md"
2. **Hard limit ≤30** — archive or delete before adding
3. **Link, don't duplicate** — reference SSOT, don't copy content
4. **Verify before commit** — every claim maps to code
5. **If not in INDEX, doesn't exist**

---

*Active files: ~17 | Last updated: 2026-01-09*

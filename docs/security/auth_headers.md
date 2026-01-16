# Authentication Headers SSOT

**Last Updated:** 2026-01-16

## Auth Header

| Header | Source | Backend Module |
|--------|--------|----------------|
| `X-Telegram-Init-Data` | `Telegram.WebApp.initData` | `apps/telegram/auth/authentication.py` |

## How It Works

```
Frontend                    Nginx                     Backend
───────────────────────────────────────────────────────────────
Telegram.WebApp.initData
        │
        ▼
X-Telegram-Init-Data  ──▶  proxy_set_header  ──▶  TelegramWebAppAuthentication
                                                        │
                                                        ▼
                                              WebAppAuthService.validate_init_data()
```

## Backend Validation

```python
# apps/telegram/auth/authentication.py
class TelegramWebAppAuthentication:
    def authenticate(self, request):
        init_data = request.headers.get("X-Telegram-Init-Data")
        # Validates signature via WebAppAuthService
```

## Debug Mode (DEV Only)

**Headers:** `X-Debug-Mode`, `X-Debug-User-Id`

**Protection (triple-check):**
1. `DEBUG=True`
2. `APP_ENV=dev`
3. `WEBAPP_DEBUG_MODE_ENABLED=True`

**Production block:**
```python
# config/settings/production.py
if DEBUG:
    raise RuntimeError("[SAFETY] DEBUG=True is forbidden in production.")
```

## Nginx Config (Prod)

```nginx
# nginx/eatfit24.ru
proxy_set_header X-Telegram-Init-Data $http_x_telegram_init_data;
```

> [!WARNING]
> Prod nginx does NOT proxy debug headers (`X-Debug-Mode`, `X-Debug-User-Id`).

## Audit Checklist

- [ ] Single auth header: `X-Telegram-Init-Data`
- [ ] No fallback to other headers
- [ ] Debug bypass disabled in prod
- [ ] Nginx proxies header 1:1

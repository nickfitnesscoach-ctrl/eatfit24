# Environment Variables Migration Guide

**Цель**: Привести production env к чистому, безопасному, минимальному SSOT состоянию.

**Дата создания**: 2026-01-11

---

## Что изменилось

### 1. Разделение переменных по сервисам

**До**:
- Все сервисы читали из общего `.env` в корне проекта
- Дублирование переменных (например, `BOT_ADMIN_ID`, `ADMIN_IDS`, `TELEGRAM_ADMINS`)
- Backend содержал `OPENROUTER_API_KEY` (не нужен)

**После**:
- Backend: собственный набор переменных (см. `backend/.env.example`)
- Bot: собственный набор переменных (см. `bot/.env.example`)
- AI Proxy: собственный набор переменных (на отдельном сервере)

### 2. Удалены дублирующие переменные

| Удалено | Используйте вместо | Причина |
|---------|-------------------|---------|
| `BOT_ADMIN_ID` | `TELEGRAM_ADMINS` | Дублирование |
| `ADMIN_IDS` | `TELEGRAM_ADMINS` | Дублирование |
| `DATABASE_URL` | `POSTGRES_*` | Дублирование SSOT |
| `DJANGO_CACHE_BACKEND` | `REDIS_URL` | Дублирование SSOT |
| `OPENROUTER_API_KEY` (backend) | Удалить из backend | Backend не вызывает OpenRouter |
| `OPENAI_API_KEY` (backend) | Удалить из backend | Backend не использует |

### 3. Добавлены обязательные переменные

**Backend**:
```bash
ENV=prod                # Новое: для config/settings/[ENV].py
APP_ENV=prod           # Новое: safety check в production.py
```

**Bot**:
```bash
TELEGRAM_BOT_API_SECRET=<generated>  # Новое: для X-Bot-Secret header
```

---

## План миграции на сервере

### Шаг 1: Проверка текущего состояния

```bash
# Зайдите на production сервер
ssh root@85.198.81.133

cd /opt/eatfit24

# Проверьте текущий .env
cat .env | grep -E "^[A-Z]" | sort
```

### Шаг 2: Создайте резервную копию

```bash
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)
```

### Шаг 3: Создайте новый .env на основе backend/.env.example

```bash
# Скопируйте template
cp backend/.env.example .env

# Откройте в редакторе
nano .env
```

Замените все `<REPLACE_ME>` реальными значениями из старого `.env.backup.*`:

```bash
# Пример: извлечь значения из backup
grep "SECRET_KEY=" .env.backup.*
grep "POSTGRES_PASSWORD=" .env.backup.*
grep "TELEGRAM_BOT_TOKEN=" .env.backup.*
grep "YOOKASSA_SECRET_KEY=" .env.backup.*
grep "AI_PROXY_SECRET=" .env.backup.*
```

### Шаг 4: Добавьте новые обязательные переменные

```bash
# В .env добавьте:
APP_ENV=prod

# ENV=prod — опционально (используется только в entrypoint.sh для validation)
```

### Шаг 5: Удалите запрещённые переменные из backend .env

Убедитесь, что backend `.env` **НЕ содержит**:
```bash
# Удалите эти строки (если есть):
OPENROUTER_API_KEY=...
OPENAI_API_KEY=...
BOT_ADMIN_ID=...
ADMIN_IDS=...
DATABASE_URL=...
DJANGO_CACHE_BACKEND=...
```

### Шаг 6: Проверьте нормализацию переменных

**Убедитесь**, что используется только одна переменная из группы:

```bash
# ✅ Правильно (одна переменная):
TELEGRAM_ADMINS=310151740

# ❌ Неправильно (дублирование):
BOT_ADMIN_ID=310151740
ADMIN_IDS=310151740
TELEGRAM_ADMINS=310151740
```

### Шаг 7: AI Proxy Server (отдельный сервер)

```bash
# Зайдите на AI Proxy сервер
ssh root@185.171.80.128

cd /opt/eatfit24-ai-proxy

# Проверьте .env
cat .env
```

Убедитесь, что AI Proxy содержит **только**:
```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
API_PROXY_SECRET=<same-as-backend-AI_PROXY_SECRET>
APP_NAME=EatFit24 AI Proxy
LOG_LEVEL=INFO
```

### Шаг 8: Перезапустите сервисы

```bash
# На main сервере (85.198.81.133)
cd /opt/eatfit24

# ВАЖНО: используйте down && up для полной перезагрузки env
docker compose down
docker compose up -d --build

# Проверьте логи
docker compose logs -f backend
```

**Проверка env внутри контейнера**:
```bash
# Проверьте, что переменные загружены правильно
docker exec eatfit24-backend-1 printenv | grep -E "^(ENV|APP_ENV|SECRET_KEY|POSTGRES|TELEGRAM|AI_PROXY)" | sort

# Проверьте, что OPENROUTER_API_KEY отсутствует в backend
docker exec eatfit24-backend-1 printenv | grep OPENROUTER || echo "✅ OPENROUTER_API_KEY not found (correct)"
```

### Шаг 9: Проверьте работоспособность

**A. Проверка изоляции секретов (КРИТИЧНО)**:

```bash
# Backend: должны отсутствовать OPENROUTER_API_KEY, YOOKASSA_SECRET_KEY
docker exec eatfit24-backend-1 printenv | grep -E "OPENROUTER|YOOKASSA_SECRET_KEY" && echo "❌ SECRET LEAK" || echo "✅ Backend secrets isolated"

# Bot: должны отсутствовать POSTGRES_*, YOOKASSA_*
docker exec eatfit24-bot-1 printenv | grep -E "POSTGRES_|YOOKASSA_" && echo "❌ SECRET LEAK" || echo "✅ Bot secrets isolated"

# AI Proxy (на втором сервере): должны отсутствовать TELEGRAM, YOOKASSA, POSTGRES
ssh root@185.171.80.128 'docker exec eatfit24-ai-proxy printenv | grep -E "TELEGRAM|YOOKASSA|POSTGRES_"' && echo "❌ SECRET LEAK" || echo "✅ AI Proxy secrets isolated"
```

**B. Функциональные проверки**:

```bash
# Health check
curl -H "Host: eatfit24.ru" http://localhost:8000/health/

# Попробуйте загрузить фото через бота (проверка ai-proxy integration)
# Попробуйте сгенерировать план питания через бота (проверка bot OpenRouter)
```

---

## Проверка после миграции

### Backend (.env)

**Обязательные переменные**:
```bash
✅ APP_ENV=prod
✅ DJANGO_SETTINGS_MODULE=config.settings.production
✅ SECRET_KEY=<64-hex>
✅ ALLOWED_HOSTS=eatfit24.ru,www.eatfit24.ru
✅ POSTGRES_DB=eatfit24
✅ POSTGRES_USER=eatfit24
✅ POSTGRES_PASSWORD=<secure>
✅ REDIS_URL=redis://redis:6379/1
✅ TELEGRAM_BOT_TOKEN=<from-botfather>
✅ TELEGRAM_ADMINS=310151740
✅ YOOKASSA_SHOP_ID=1195531
✅ YOOKASSA_SECRET_KEY=live_...
✅ YOOKASSA_MODE=prod
✅ AI_PROXY_URL=http://185.171.80.128:8001
✅ AI_PROXY_SECRET=<shared-with-ai-proxy>
```

**Опциональные переменные**:
```bash
ENV=prod  # Используется в entrypoint.sh для validation (не обязательно)
```

**Запрещённые переменные** (должны отсутствовать):
```bash
❌ OPENROUTER_API_KEY (только в bot и ai-proxy)
❌ OPENAI_API_KEY (только в ai-proxy)
❌ BOT_ADMIN_ID (используйте TELEGRAM_ADMINS)
❌ ADMIN_IDS (используйте TELEGRAM_ADMINS)
❌ DATABASE_URL (используйте POSTGRES_*)
❌ DJANGO_CACHE_BACKEND (используйте REDIS_URL)
```

### Bot (.env)

Создайте отдельный `.env` для bot (пока bot читает из корневого `.env`, это нормально, но планируется переход на `env_file` в compose):

**Обязательные переменные**:
```bash
✅ TELEGRAM_BOT_TOKEN=<from-botfather>
✅ TELEGRAM_BOT_API_SECRET=<generated>
✅ TELEGRAM_ADMINS=310151740
✅ OPENROUTER_API_KEY=sk-or-v1-...
✅ DJANGO_API_URL=http://backend:8000/api/v1
```

**Запрещённые переменные** (должны отсутствовать):
```bash
❌ POSTGRES_* (bot не имеет прямого доступа к БД)
❌ YOOKASSA_* (биллинг только в backend)
```

### AI Proxy (.env на 185.171.80.128)

```bash
✅ OPENROUTER_API_KEY=sk-or-v1-...
✅ OPENROUTER_MODEL=openai/gpt-4o-mini
✅ API_PROXY_SECRET=<shared-with-backend>
```

---

## Откат (если что-то пошло не так)

```bash
# На main сервере
cd /opt/eatfit24

# Восстановите backup
cp .env.backup.YYYYMMDD-HHMMSS .env

# Перезапустите
docker compose down && docker compose up -d
```

---

## Проверка безопасности перед коммитом

```bash
# Проверьте, что секреты не попали в git
./scripts/check-secrets-leak.sh

# Если секреты обнаружены - STOP, не коммитьте
```

---

## Дополнительные улучшения (опционально, позже)

### 1. Разделение .env per-service в compose.yml

**Сейчас** (текущая схема):
```yaml
# compose.yml
services:
  backend:
    # Читает из корневого .env
  bot:
    # Читает из корневого .env
```

**Будущее** (улучшенная схема):
```yaml
# compose.yml
services:
  backend:
    env_file:
      - .env.backend  # backend/.env или root/.env.backend
  bot:
    env_file:
      - .env.bot      # bot/.env или root/.env.bot
```

**Преимущества**:
- Изолирование переменных
- Невозможно случайно передать backend секреты в bot
- Явное разделение ответственности

**Когда делать**: Не критично, можно сделать позже (после стабилизации текущей схемы)

### 2. CI/CD Gate для проверки секретов

Добавьте в `.github/workflows/backend.yml`:

```yaml
- name: Secret leak detection
  run: |
    chmod +x scripts/check-secrets-leak.sh
    ./scripts/check-secrets-leak.sh
```

---

## Контакты ENV по сервисам

### Backend ENV Contract
См. [backend/docs/ENV_CONTRACT.md](../backend/docs/ENV_CONTRACT.md)

### Bot ENV Contract
См. [bot/docs/ENV_CONTRACT.md](../bot/docs/ENV_CONTRACT.md)

### AI Proxy ENV
AI Proxy уже имеет минималистичный `.env.example` в своём репо.

---

## Частые вопросы

### Q: Почему backend НЕ должен содержать OPENROUTER_API_KEY?

**A**: Backend не вызывает OpenRouter напрямую:
- Фото-анализ: backend → ai-proxy (у ai-proxy есть ключ)
- План питания: генерируется в bot (у bot есть ключ)

Хранить ключ в backend — излишнее распространение секрета без необходимости.

### Q: Можно ли использовать один OPENROUTER_API_KEY для bot и ai-proxy?

**A**: Да, можно:
- **Общий ключ**: Упрощает управление, общий бюджет OpenRouter
- **Раздельные ключи**: Раздельный учёт расходов (bot vs photo-analysis)

Текущая production схема: **один ключ** для обоих.

### Q: Что делать, если забыл добавить APP_ENV=prod?

**A**: Backend не запустится, `production.py` проверит `APP_ENV != "prod"` и выдаст ошибку:
```
RuntimeError: [SAFETY] APP_ENV must be 'prod' in production
```

Добавьте `APP_ENV=prod` в `.env`, перезапустите.

**Примечание**: `ENV=prod` — опциональная переменная (используется только в `entrypoint.sh` для validation).

### Q: Нужно ли менять compose.yml сейчас?

**A**: Нет, текущая схема (все сервисы читают из корневого `.env`) рабочая.

Переход на `env_file` per-service — улучшение, но не критичное.

### Q: Почему в ALLOWED_HOSTS нет "backend" и "localhost"?

**A**: Не нужны для production безопасности:
- **Healthcheck**: `compose.yml` использует `Host: eatfit24.ru` header (строка 82)
- **"backend"**: Docker internal DNS — не требует ALLOWED_HOSTS
- **"localhost"**: Не нужен на production сервере

**Минимум** (только реальные домены):
```bash
ALLOWED_HOSTS=eatfit24.ru,www.eatfit24.ru
```

Если нужен локальный healthcheck без nginx — используйте header:
```bash
curl -H "Host: eatfit24.ru" http://localhost:8000/health/
```

---

## См. также

- [backend/.env.example](../backend/.env.example)
- [bot/.env.example](../bot/.env.example)
- [backend/docs/ENV_CONTRACT.md](../backend/docs/ENV_CONTRACT.md)
- [bot/docs/ENV_CONTRACT.md](../bot/docs/ENV_CONTRACT.md)
- [scripts/check-secrets-leak.sh](../scripts/check-secrets-leak.sh)

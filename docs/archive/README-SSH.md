# SSH и DevOps режим для EatFit24

## Быстрый доступ

Используйте любое из этих кодовых слов для активации DevOps режима:
- `ssh` - подключение к production серверу
- `prod` - работа с production
- `production` - полное название

## Что происходит когда вы пишете "ssh"

Claude автоматически:
1. Читает конфигурацию из `.claude/ssh-config.json`
2. Переходит в DevOps режим
3. Подключается к production серверу (85.198.81.133)
4. Готов выполнять команды на сервере как DevOps агент

## Production сервер

**Подключение:**
- Host: `85.198.81.133`
- Domain: `eatfit24.ru`
- User: `deploy`
- Project path: `/opt/eatfit24`

**Сервисы:**
- `eatfit24-backend` - Django REST API
- `eatfit24-frontend` - React приложение
- `eatfit24-bot` - Telegram бот
- `eatfit24-celery-worker` - Celery worker для фоновых задач
- `eatfit24-celery-beat` - Celery beat для периодических задач
- `eatfit24-db` - PostgreSQL база данных
- `eatfit24-redis` - Redis для кеша и очередей

**AI Proxy сервер:**
- Host: `185.171.80.128:8001`
- URL: `http://185.171.80.128:8001`

## Типичные DevOps задачи

### Мониторинг
```bash
# Статус контейнеров
docker compose ps

# Логи backend
docker logs eatfit24-backend --tail 100

# Логи celery worker
docker logs eatfit24-celery-worker --tail 100

# Проверка переменных окружения
docker exec eatfit24-backend printenv | sort
```

### Управление
```bash
# Перезапуск сервиса
docker compose restart backend

# Пересборка и запуск
docker compose up -d --build backend celery-worker frontend

# Проверка git статуса
cd /opt/eatfit24 && git status

# Деплой новой версии
cd /opt/eatfit24 && git pull origin main && docker compose up -d --build
```

### Health checks
- Backend API: проверка `/health` endpoint
- Database: проверка подключения к PostgreSQL
- Redis: проверка подключения
- Celery: проверка worker статуса
- AI Proxy: проверка `http://185.171.80.128:8001/health`

## Примеры использования

**Пользователь пишет:** `ssh`

**Claude делает:**
1. Читает конфигурацию
2. Проверяет статус сервисов
3. Готов к DevOps командам

**Пользователь пишет:** `проверь логи backend`

**Claude выполняет:**
```bash
powershell.exe -Command "echo 'PASSWORD' | ssh deploy@85.198.81.133 -o StrictHostKeyChecking=no 'docker logs eatfit24-backend --tail 100 2>&1'"
```

## Безопасность

⚠️ Конфигурационный файл `ssh-config.json` содержит чувствительные данные (пароль, API ключи).

**Важно:**
- Файл должен быть в `.gitignore`
- Не коммитить в репозиторий
- Хранить только локально

## Связанные файлы

- `.claude/project.json` - основная конфигурация проекта
- `.claude/ssh-config.json` - SSH конфигурация и DevOps команды
- `.claude/settings.local.json` - разрешения для команд

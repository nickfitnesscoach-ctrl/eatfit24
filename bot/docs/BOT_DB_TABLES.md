# EatFit24 Bot Database Tables

> **Статус**: ✅ **УДАЛЕНО** (2025-12-24)  
> SQLAlchemy модели и Alembic миграции удалены из бота.  
> Бот работает исключительно через Django API.

---

## Историческая справка

До 2025-12-24 в боте были определены следующие SQLAlchemy таблицы, которые **никогда не использовались**:

### Удалённые таблицы (были в боте)

| Таблица | Назначение | Статус |
|---------|-----------|--------|
| `users` | Telegram пользователи | ❌ Удалено |
| `survey_answers` | Ответы на опрос | ❌ Удалено |
| `plans` | AI-планы | ❌ Удалено |

---

## Текущая архитектура

Все данные хранятся в **Django моделях**:

| Сущность | Django модель | Приложение |
|----------|---------------|------------|
| Пользователи | `TelegramUser` | `apps.telegram` |
| Опросы | `PersonalPlanSurvey` | `apps.telegram` |
| Планы | `PersonalPlan` | `apps.telegram` |

### API endpoints

| Операция | Endpoint |
|----------|----------|
| Создать пользователя | `GET /telegram/users/get-or-create/` |
| Сохранить опрос | `POST /telegram/personal-plan/survey/` |
| Сохранить план | `POST /telegram/personal-plan/plan/` |
| Проверить лимит | `GET /telegram/personal-plan/count-today/` |

---

## Удалённые файлы

| Путь | Описание |
|------|----------|
| `bot/alembic/` | Alembic миграции (4 файла) |
| `bot/alembic.ini` | Конфигурация Alembic |
| `bot/app/models/` | SQLAlchemy модели (User, SurveyAnswer, Plan) |
| `bot/app/services/database/` | DB session и repositories |

---

## Очистка БД (опционально)

Если в PostgreSQL остались пустые таблицы от бота:

```sql
-- Проверить наличие
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'survey_answers', 'plans', 'alembic_version');

-- Удалить (если пустые и не нужны)
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS survey_answers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS alembic_version;
```

> ⚠️ **Внимание**: Убедитесь, что эти таблицы не используются Django backend!

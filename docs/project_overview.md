# Паспорт проекта FoodMind AI

Документ для быстрого погружения в архитектуру проекта. Предназначен для разработчиков и AI-ассистентов (ChatGPT, Claude и других).

---

## 1. Tech Stack и роли сервисов

Проект состоит из 4 основных компонентов:

### Backend (Django REST Framework)
- **Технологии**: Django 5.x, Django REST Framework, PostgreSQL 15+, Gunicorn
- **Роль**: REST API для управления пользователями, подписками, платежами, КБЖУ-трекером, AI-распознаванием блюд
- **Порт**: 8000
- **База данных**: PostgreSQL (shared с ботом)
- **Особенности**:
  - Авторизация через Telegram WebApp (валидация initData)
  - Интеграция с YooKassa для платежей
  - AI-распознавание блюд через OpenRouter API
  - Swagger/ReDoc документация (защищена Basic Auth)

### Bot (Telegram Bot на aiogram)
- **Технологии**: Python 3.12, aiogram 3.x, SQLAlchemy 2.x, Alembic
- **Роль**: Лид-магнит бот для сбора анкет и генерации персональных планов тренировок через AI
- **База данных**: PostgreSQL (shared с backend)
- **Особенности**:
  - FSM (Finite State Machine) для многоэтапных опросов
  - Интеграция с OpenRouter AI для генерации планов
  - Синхронизация данных с Django backend через REST API
  - Лид-магнит: Personal Plan Survey (опрос с AI-рекомендациями)

### Frontend (React + TypeScript)
- **Технологии**: React 19, TypeScript, Vite, TailwindCSS, React Router
- **Роль**: Telegram Mini App для клиентов (КБЖУ-трекер, профиль, подписки) + Панель тренера
- **Порт**: 3000 (в проде через Nginx на :80)
- **Особенности**:
  - Telegram WebApp SDK для авторизации
  - КБЖУ-трекер с фото блюд
  - Управление подписками и платежами (YooKassa)
  - Панель тренера для просмотра заявок из лид-магнита

### Nginx
- **Роль**: Reverse proxy, статические файлы, валидация Telegram initData
- **Функции**:
  - Проксирование запросов к backend и frontend
  - Валидация Telegram WebApp initData и прокидывание заголовков (X-Telegram-ID, X-Telegram-First-Name и т.д.)
  - Раздача статики (React build, media files)

---

## 2. Структура репозитория

```
fitness-app/
├── backend/                 # Django REST API
│   ├── apps/               # Django приложения
│   │   ├── users/          # Пользователи, профили, аватары
│   │   ├── billing/        # Подписки, платежи (YooKassa)
│   │   ├── nutrition/      # КБЖУ-трекер (Meal, FoodItem, DailyGoal)
│   │   ├── telegram/       # Telegram интеграция, панель тренера
│   │   ├── ai/             # AI-распознавание блюд (OpenRouter)
│   │   └── common/         # Общие утилиты (health checks, storage)
│   ├── config/             # Настройки Django (settings, urls)
│   ├── staticfiles/        # Статика Django (после collectstatic)
│   ├── media/              # Загруженные файлы (аватары, фото блюд)
│   ├── logs/               # Логи Django/Gunicorn
│   ├── Dockerfile
│   ├── requirements.txt
│   └── manage.py
│
├── bot/                    # Telegram Bot (aiogram)
│   ├── app/                # Основной код бота
│   │   ├── handlers/       # Обработчики сообщений (FSM)
│   │   ├── services/       # Бизнес-логика (AI, database, Django API)
│   │   ├── models/         # SQLAlchemy модели (User, SurveyAnswer, Plan)
│   │   ├── states/         # FSM состояния для опросов
│   │   ├── keyboards/      # Telegram клавиатуры
│   │   ├── prompts/        # Промпты для AI (Personal Plan)
│   │   ├── texts/          # Текстовые сообщения
│   │   └── config.py       # Конфигурация из .env
│   ├── alembic/            # Миграции БД
│   ├── logs/               # Логи бота
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
│
├── frontend/               # React + TypeScript
│   ├── src/
│   │   ├── pages/          # Страницы приложения
│   │   │   ├── FoodLogPage.tsx        # КБЖУ-дневник
│   │   │   ├── ProfilePage.tsx        # Профиль пользователя
│   │   │   ├── SubscriptionPage.tsx   # Выбор подписки
│   │   │   ├── SettingsPage.tsx       # Настройки подписки
│   │   │   ├── ApplicationsPage.tsx   # Панель тренера: заявки
│   │   │   └── ClientsPage.tsx        # Панель тренера: клиенты
│   │   ├── components/     # Переиспользуемые компоненты
│   │   ├── contexts/       # React Context (Auth, Billing, Clients)
│   │   ├── services/       # API клиенты
│   │   └── App.tsx         # Роутинг
│   ├── public/             # Статические файлы
│   ├── nginx.conf          # Конфиг Nginx для продакшена
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
│
├── docs/                   # Документация проекта
│   ├── project_overview.md # Этот файл
│   └── ...
│
├── .github/workflows/      # CI/CD pipelines
│   ├── backend.yml         # Deploy backend на VPS
│   ├── bot.yml             # Deploy бота на VPS
│   └── frontend.yml        # Deploy фронтенда на VPS
│
├── docker-compose.yml      # Оркестрация всех сервисов
└── .env.example            # Пример переменных окружения
```

---

## 3. Бизнес-логика

### Основные сценарии использования

#### 1. Лид-магнит (Telegram Bot)
- Пользователь запускает бота `/start`
- Проходит опрос Personal Plan: пол, возраст, рост, вес, уровень активности, тип фигуры, цели
- AI (через OpenRouter) генерирует персональный план тренировок и питания
- Данные сохраняются в PostgreSQL (модели: `TelegramUser`, `PersonalPlanSurvey`, `PersonalPlan`)
- Тренер видит заявки в панели тренера (frontend)

#### 2. КБЖУ-трекер (Telegram Mini App)
- Пользователь заходит в Mini App из Telegram
- Авторизация через Telegram initData (автоматическая)
- Добавляет приёмы пищи (завтрак, обед, ужин, перекус)
- Загружает фото блюд → AI распознаёт блюдо и КБЖУ
- Видит прогресс по дневной норме (калории, белки, жиры, углеводы)

#### 3. Подписки и платежи
- 3 тарифа: FREE (3 фото/день, 7 дней истории), MONTHLY, YEARLY
- Создание платежа через YooKassa (тестовый или боевой режим)
- Webhook от YooKassa → активация подписки
- Автопродление через сохранённую карту (рекуррентные платежи)
- Привязка карты: платёж 1₽ с сохранением payment_method_id

#### 4. Панель тренера
- Авторизация через Telegram
- Вкладка "Заявки": все пользователи, прошедшие Personal Plan Survey
- Вкладка "Клиенты": пользователи с флагом `is_client=True`
- Просмотр анкет, AI-рекомендаций, контактов
- Приглашение клиентов в Mini App (генерация ссылки)

---

## 4. Основные модели и сущности

### Backend (Django)

#### `apps.users`
- **User** (встроенная Django модель): username, email, password
- **Profile**:
  - Связь 1-to-1 с User
  - Данные: пол, дата рождения, рост, вес, цель (похудение/набор/поддержание)
  - AI-рекомендации: диапазоны КБЖУ (min/max для калорий, белков, жиров, углеводов)
  - Аватар, telegram_id, training_level, goals (JSON), health_restrictions (JSON)
- **EmailVerificationToken**: токены для верификации email (срок 24 часа)

#### `apps.billing`
- **SubscriptionPlan**: тарифные планы (FREE, MONTHLY, YEARLY)
  - Цена, длительность (дни)
  - Лимиты: daily_photo_limit, history_days, ai_recognition, advanced_stats
- **Subscription**: подписка пользователя
  - Связь 1-to-1 с User
  - plan, start_date, end_date, is_active, auto_renew
  - Данные карты: yookassa_payment_method_id, card_mask, card_brand
- **Payment**: история платежей
  - Статусы: PENDING, SUCCEEDED, FAILED, CANCELED, REFUNDED
  - yookassa_payment_id, amount, currency, is_recurring, save_payment_method
- **Refund**: возвраты (связаны с Payment)

#### `apps.nutrition`
- **Meal**: приём пищи
  - Связь Many-to-One с User
  - meal_type (BREAKFAST, LUNCH, DINNER, SNACK), date
  - Вычисляемые свойства: total_calories, total_protein, total_fat, total_carbohydrates
- **FoodItem**: блюдо в приёме пищи
  - Связь Many-to-One с Meal
  - name, photo, grams, calories, protein, fat, carbohydrates
- **DailyGoal**: дневная цель по КБЖУ
  - Связь Many-to-One с User (один активный goal на пользователя)
  - source: AUTO (расчёт по формуле Mifflin-St Jeor) или MANUAL
  - calories, protein, fat, carbohydrates

#### `apps.telegram`
- **TelegramUser**: связь Django User с Telegram
  - telegram_id (unique), username, first_name, last_name, language_code, is_premium
  - ai_test_completed, ai_test_answers (JSON)
  - is_client (флаг для панели тренера)
  - Рекомендации из теста: recommended_calories, recommended_protein, recommended_fat, recommended_carbs
- **PersonalPlanSurvey**: ответы на опрос лид-магнита
  - Демография: gender, age, height_cm, weight_kg, target_weight_kg, activity
  - Цели: training_level, body_goals (JSON), health_limitations (JSON)
  - Типы фигуры: body_now_id, body_ideal_id
  - timezone, utc_offset_minutes
- **PersonalPlan**: AI-генерированные планы
  - ai_text (полный текст плана), ai_model, prompt_version
  - Связь с PersonalPlanSurvey

### Bot (SQLAlchemy)

**Важно**: Бот и Backend используют **одну и ту же PostgreSQL БД**, но разные ORM (SQLAlchemy vs Django ORM). Часть моделей дублируется.

Основные модели бота:
- **User**: Telegram пользователи (telegram_id, username, first_name, language_code)
- **SurveyAnswer**: ответы на опрос (age, height, weight, gender, activity_level, goals)
- **Plan**: сгенерированные AI планы (текст, модель, промпт)

---

## 5. API-эндпоинты

Все эндпоинты REST API находятся в `/api/v1/`.

### Группа: Авторизация (`/api/v1/users/auth/`)
- `POST /auth/register/` — регистрация (email, password)
- `POST /auth/login/` — логин (email, password) → JWT токены
- `POST /auth/refresh/` — обновление JWT токена
- `POST /auth/verify-email/` — верификация email по токену
- `POST /auth/resend-verification/` — повторная отправка письма

### Группа: Профиль (`/api/v1/users/profile/`)
- `GET /profile/` — получение профиля текущего пользователя
- `PUT/PATCH /profile/` — обновление профиля
- `POST /profile/avatar/` — загрузка аватара
- `POST /profile/change-password/` — смена пароля
- `DELETE /profile/delete/` — удаление аккаунта

### Группа: Подписки и платежи (`/api/v1/billing/`)
- `GET /billing/plan` — текущий тариф (legacy)
- `GET /billing/me/` — статус подписки (plan, days_remaining, auto_renew, card_mask)
- `POST /billing/subscribe` — оформление подписки (deprecated)
- `POST /billing/create-payment/` — создание платежа (универсальный endpoint)
- `POST /billing/create-plus-payment/` — создание платежа PLUS (deprecated)
- `POST /billing/bind-card/start/` — начало привязки карты (платёж 1₽)
- `POST /billing/create-test-live-payment/` — тест боевого платежа 1₽ (только админы)
- `POST /billing/auto-renew/toggle` — включение/выключение автопродления (legacy)
- `GET /billing/payments` — история платежей (legacy)

#### Новые эндпоинты для экрана настроек подписки
- `GET /billing/subscription/` — детали подписки
- `POST /billing/subscription/autorenew/` — установка автопродления
- `GET /billing/payment-method/` — данные способа оплаты (card_mask, card_brand)
- `GET /billing/payments/` — история платежей

#### Webhook
- `POST /billing/webhooks/yookassa` — webhook от YooKassa (обработка статусов платежей)

### Группа: КБЖУ-трекер (`/api/v1/`)
- `GET /meals/?date=YYYY-MM-DD` — дневник питания на дату
- `POST /meals/` — создание приёма пищи
- `GET/PUT/PATCH/DELETE /meals/{id}/` — CRUD приёма пищи
- `POST /meals/{meal_id}/items/` — добавление блюда в приём пищи
- `GET/PUT/PATCH/DELETE /meals/{meal_id}/items/{id}/` — CRUD блюда

### Группа: Дневные цели КБЖУ (`/api/v1/goals/`)
- `GET /goals/` — текущая цель
- `POST /goals/calculate/` — расчёт цели по формуле Mifflin-St Jeor
- `POST /goals/set-auto/` — установка автоматически рассчитанной цели
- `PUT/PATCH /goals/` — ручное обновление цели

### Группа: AI-распознавание (`/api/v1/ai/`)
- `POST /ai/recognize-food/` — распознавание блюда по фото
  - Принимает: multipart/form-data с фото
  - Возвращает: name, grams, calories, protein, fat, carbohydrates

### Группа: Панель тренера (`/api/v1/trainer-panel/`)
- `POST /trainer-panel/auth/` — авторизация тренера (Telegram initData)
- `GET /trainer-panel/applications/` — список заявок (пользователи с PersonalPlanSurvey)
- `GET /trainer-panel/clients/` — список клиентов (is_client=True)
- `PATCH /trainer-panel/applications/{id}/` — обновление статуса заявки (например, пометить is_client=True)

### Health checks
- `GET /health/` или `/api/v1/health/` — проверка работоспособности
- `GET /ready/` — readiness probe
- `GET /live/` — liveness probe

### Документация
- `GET /api/schema/` — OpenAPI schema (Basic Auth)
- `GET /api/schema/swagger-ui/` — Swagger UI (Basic Auth)
- `GET /api/schema/redoc/` — ReDoc (Basic Auth)

---

## 6. Авторизация и безопасность

### Способы авторизации

#### 1. Telegram WebApp (основной для Mini App)
- Клиент отправляет `initData` от Telegram WebApp
- Backend проверяет подпись HMAC-SHA256 с использованием `BOT_TOKEN`
- Nginx валидирует initData и прокидывает заголовки:
  - `X-Telegram-ID`
  - `X-Telegram-First-Name`
  - `X-Telegram-Username`
  - `X-Telegram-Last-Name`
  - `X-Telegram-Language-Code`
- Django использует `TelegramHeaderAuthentication` для создания/получения пользователя

**Код авторизации**: `apps.telegram.authentication.TelegramHeaderAuthentication`

#### 2. JWT токены (для email/password auth)
- Используется `rest_framework_simplejwt`
- Access token: 60 минут
- Refresh token: 7 дней (с ротацией)

**Endpoints**: `/api/v1/users/auth/login/`, `/api/v1/users/auth/refresh/`

### Роли и права доступа

#### Обычный пользователь (user)
- Доступ к своему профилю, КБЖУ-дневнику, подпискам
- Не может видеть панель тренера

#### Тренер (trainer)
- Telegram ID должен быть в списке `TELEGRAM_ADMINS` (переменная окружения)
- Доступ к панели тренера: заявки, клиенты
- Endpoint для проверки: `/api/v1/trainer-panel/auth/` возвращает `is_admin=True`

#### Админ Django
- Доступ к Django Admin (`/dj-admin/`)
- Middleware `TelegramAdminOnlyMiddleware` проверяет, что `telegram_id` в `TELEGRAM_ADMINS`
- Может создавать тестовые live-платежи (endpoint `/billing/create-test-live-payment/`)

### Защищённые части панели

- **Панель тренера** (`/trainer-panel/*`): требуется `is_admin=True`
- **Django Admin** (`/dj-admin/`): требуется Telegram ID из `TELEGRAM_ADMINS`
- **Swagger/ReDoc** (`/api/schema/*`): Basic Auth (SWAGGER_AUTH_USERNAME, SWAGGER_AUTH_PASSWORD)

### Безопасность
- Все пароли хэшируются (Django PBKDF2)
- JWT токены подписываются `SECRET_KEY`
- CORS настроен на конкретные origins (только HTTPS в проде)
- Telegram initData проверяется на подпись HMAC-SHA256
- Rate limiting для AI-распознавания: 10 req/min, 100 req/day (per user)
- Rate limiting для webhook: 100 req/hour

---

## 7. Интеграции

### YooKassa (платёжная система)

#### Режимы работы
- **Тестовый режим**: `YOOKASSA_MODE=test` (используются `YOOKASSA_SHOP_ID_TEST`, `YOOKASSA_API_KEY_TEST`)
- **Боевой режим**: `YOOKASSA_MODE=prod` (используются `YOOKASSA_SHOP_ID_PROD`, `YOOKASSA_API_KEY_PROD`)

#### Процесс платежа
1. Фронтенд вызывает `POST /api/v1/billing/create-payment/` с `plan_code` и `save_payment_method=true`
2. Backend создаёт Payment в статусе PENDING
3. Backend вызывает YooKassa API → получает `confirmation.confirmation_url`
4. Фронтенд открывает confirmation_url для ввода карты
5. Пользователь оплачивает → YooKassa отправляет webhook на `/api/v1/billing/webhooks/yookassa`
6. Backend обрабатывает webhook:
   - Если `payment.status=succeeded` → меняет статус Payment на SUCCEEDED, продлевает подписку
   - Если `save_payment_method=true` → сохраняет `payment_method_id` в Subscription
7. Фронтенд редиректится на `YOOKASSA_RETURN_URL` с параметром `?status=success`

#### Автопродление (рекуррентные платежи)
- При создании первого платежа с `save_payment_method=true` → сохраняется `payment_method_id`
- При включении `auto_renew=true` → бэкенд может создавать платежи с сохранённым способом оплаты
- TODO: реализовать Celery task для проверки истекающих подписок и автопродления

#### Привязка карты без оплаты
- Endpoint: `POST /api/v1/billing/bind-card/start/`
- Создаёт платёж на 1₽ с `save_payment_method=true`
- После успешной оплаты → возвращает 1₽ (refund) и сохраняет карту

### OpenRouter AI

#### Backend: распознавание блюд
- Модель: `google/gemini-2.5-flash-image` (дешёвая и стабильная, $0.30/M)
- Endpoint: `POST /api/v1/ai/recognize-food/`
- Промпт: распознать блюдо, вернуть JSON с `name`, `grams`, `calories`, `protein`, `fat`, `carbohydrates`
- Retry: до 3 попыток при невалидном JSON
- Rate limiting: 10 req/min, 100 req/day (per user)

#### Bot: генерация Personal Plan
- Модель: `meta-llama/llama-3.1-70b-instruct` (по умолчанию)
- Промпт: `bot/app/prompts/personal_plan.py`
- Генерирует план тренировок и питания на основе анкеты (возраст, вес, рост, цели, ограничения)
- Сохраняется в `PersonalPlan` (поле `ai_text`)

---

## 8. Переменные окружения и конфиг

### Общие (для всех сервисов)
```env
# База данных (shared)
POSTGRES_DB=foodmind
POSTGRES_USER=foodmind
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
BOT_ADMIN_ID=123456789
TELEGRAM_ADMINS=123456789,987654321  # Comma-separated

# AI
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=google/gemini-2.5-flash-image
```

### Backend (Django)
```env
# Django
SECRET_KEY=your_django_secret_key
DEBUG=False
ALLOWED_HOSTS=eatfit24.ru,www.eatfit24.ru
CORS_ALLOWED_ORIGINS=https://eatfit24.ru,https://www.eatfit24.ru
DJANGO_SETTINGS_MODULE=config.settings.production

# YooKassa
YOOKASSA_MODE=prod  # или test
YOOKASSA_SHOP_ID_TEST=test_shop_id
YOOKASSA_API_KEY_TEST=test_api_key
YOOKASSA_SHOP_ID_PROD=prod_shop_id
YOOKASSA_API_KEY_PROD=prod_api_key
YOOKASSA_RETURN_URL=https://eatfit24.ru/payments/return/

# Swagger (Basic Auth)
SWAGGER_AUTH_USERNAME=admin
SWAGGER_AUTH_PASSWORD=your_password
```

### Bot
```env
# Bot FSM
FSM_STORAGE_TYPE=memory  # или redis
REDIS_HOST=localhost  # если FSM_STORAGE_TYPE=redis
REDIS_PORT=6379

# Django API integration (опционально)
DJANGO_API_URL=http://backend:8000/api/v1  # в Docker
# или https://eatfit24.ru/api/v1 снаружи

# Telegram Mini App (опционально)
WEB_APP_URL=https://eatfit24.ru
TRAINER_PANEL_BASE_URL=https://eatfit24.ru

# Feature flags
FEATURE_PERSONAL_PLAN=on
DEBUG_MODE=False
ENVIRONMENT=production

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/bot.log
```

### Frontend (Vite)
Переменные встраиваются на этапе сборки через `vite.config.js`:
- API URL встроен в код (использует относительные пути `/api/v1/*`)
- Telegram WebApp SDK инжектится автоматически через скрипт Telegram

---

## 9. Запуск локально и в проде

### Локальный запуск (Docker Compose)

**Шаг 1**: Создать `.env` в корне проекта
```bash
cp .env.example .env
# Отредактировать .env и заполнить все переменные
```

**Шаг 2**: Запустить все сервисы
```bash
docker compose up -d --build
```

Это запустит:
- PostgreSQL на порту 5432
- Backend на порту 8000
- Frontend на порту 3000
- Bot (без открытых портов)

**Шаг 3**: Применить миграции (если база пустая)
```bash
# Django миграции
docker compose exec backend python manage.py migrate

# Bot миграции (Alembic)
docker compose exec bot alembic upgrade head
```

**Шаг 4**: Создать суперпользователя Django (для доступа к /dj-admin/)
```bash
docker compose exec backend python manage.py createsuperuser
```

**Шаг 5**: Создать FREE тариф (обязательно!)
```bash
docker compose exec backend python manage.py shell
>>> from apps.billing.models import SubscriptionPlan
>>> SubscriptionPlan.objects.create(
...     name='FREE',
...     display_name='Бесплатный',
...     price=0,
...     duration_days=0,
...     daily_photo_limit=3,
...     history_days=7,
...     ai_recognition=True
... )
```

**Шаг 6**: Доступ к сервисам
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/v1/
- Django Admin: http://localhost:8000/dj-admin/
- Swagger: http://localhost:8000/api/schema/swagger-ui/

### Продакшен (VPS)

**Домен**: https://eatfit24.ru

**Процесс деплоя**:
1. Push в `main` branch → GitHub Actions запускает CI/CD
2. Тесты проходят → код деплоится на VPS `/opt/foodmind`
3. `docker compose up -d --build` пересобирает и перезапускает контейнеры
4. Telegram уведомление о статусе деплоя

**Структура на VPS**:
```
/opt/foodmind/
├── backend/
├── bot/
├── frontend/
├── docker-compose.yml
└── .env  # Не в git, создаётся вручную
```

**Nginx** (на хосте, не в Docker):
- Проксирует `https://eatfit24.ru/api/*` → `http://localhost:8000/api/*`
- Проксирует `https://eatfit24.ru/*` → `http://localhost:3000/*` (React)
- Валидирует Telegram initData и прокидывает заголовки

**SSL**: Let's Encrypt (Certbot)

---

## 10. Ограничения и TODO

### Известные ограничения

1. **Нет Redis в проде**
   - FSM бота использует memory storage (состояния теряются при перезапуске)
   - TODO: добавить Redis в docker-compose для production

2. **Нет Celery**
   - Автопродление подписок не реализовано (нужен периодический task)
   - TODO: настроить Celery + Redis для фоновых задач

3. **Дублирование моделей**
   - Бот и Backend используют одну БД, но разные ORM (SQLAlchemy vs Django)
   - Модели частично дублируются (User, TelegramUser)
   - TODO: рассмотреть переезд бота на Django ORM или полное разделение БД

4. **Лимиты FREE тарифа**
   - Лимит 3 фото/день не проверяется строго (есть поле `daily_photo_limit`, но нет middleware)
   - TODO: добавить middleware для проверки лимитов

5. **Тестовые live-платежи**
   - Endpoint `/billing/create-test-live-payment/` создаёт боевой платёж 1₽ (для тестирования)
   - Доступен только админам (флаг `test_live_payment_available` в `/billing/me/`)
   - TODO: удалить после тестирования в проде

6. **Кеш аватаров**
   - Версионирование аватаров (`avatar_version`) работает, но кеш-заголовки не настроены
   - TODO: настроить `Cache-Control` для `/media/avatars/`

7. **Возвраты (Refund)**
   - Модель `Refund` создана, но логика возвратов не реализована
   - TODO: реализовать API для возвратов через YooKassa

### Будущие фичи (из кода)

1. **Email-уведомления**
   - `EMAIL_BACKEND` настроен, но письма не отправляются
   - TODO: настроить SMTP для верификации email и уведомлений

2. **Advanced Stats** (для платных подписок)
   - Флаг `advanced_stats` в `SubscriptionPlan`, но функционал не реализован
   - TODO: добавить графики, экспорт данных, аналитику

3. **Priority Support**
   - Флаг `priority_support` в тарифе, но без реализации
   - TODO: добавить чат с тренером или приоритетную обработку заявок

4. **Рекомендации по воде и сну**
   - В `Profile` есть поля для AI-рекомендаций, но используются только для КБЖУ
   - TODO: расширить AI-промпты для рекомендаций по режиму дня

5. **Интеграция бота с backend**
   - `DJANGO_API_URL` в боте настроена, но не все данные синхронизируются
   - TODO: после завершения опроса в боте → отправлять данные в Django API

6. **Публичный сайт (лендинг)**
   - В `frontend/public/landing/` есть заглушка
   - TODO: создать лендинг для привлечения пользователей

---

## Дополнительные ресурсы

- **Основной стек**: Django REST, aiogram 3, React 19, PostgreSQL 15
- **CI/CD**: GitHub Actions (деплой на VPS по SSH)
- **Мониторинг**: Health checks (`/health/`, `/ready/`, `/live/`)
- **Логи**: `backend/logs/`, `bot/logs/` (в Docker volumes)
- **Документация API**: Swagger UI (`/api/schema/swagger-ui/`)

---

**Примечание**: Этот документ актуален на момент создания (2025-11-29). При изменении архитектуры обновляйте этот файл.

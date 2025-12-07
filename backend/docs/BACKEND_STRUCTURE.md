# Структура Backend EatFit24

Простое описание: что где лежит и зачем нужно.

---

## Корневая папка `backend/`

```
backend/
├── apps/                # Django приложения (бизнес-логика)
├── config/              # Настройки Django проекта
├── docs/                # Документация бэкенда
├── logs/                # Логи (не в git)
├── media/               # Загруженные файлы (аватары, фото еды)
│
├── manage.py            # Точка входа Django (команды)
├── requirements.txt     # Python зависимости
├── pyproject.toml       # Настройки ruff (линтер)
│
├── Dockerfile           # Инструкция сборки Docker-образа
├── entrypoint.sh        # Скрипт запуска контейнера
├── gunicorn_config.py   # Настройки Gunicorn (production сервер)
├── nginx-host.conf      # Nginx конфиг для host-based деплоя
│
├── .env                 # Переменные окружения (не в git!)
├── .env.example         # Шаблон переменных
├── .gitignore           # Файлы, которые не попадают в git
└── .dockerignore        # Файлы, которые не попадают в Docker
```

---

## Папка `apps/` — Django приложения

Каждое приложение отвечает за свою область бизнес-логики:

```
apps/
├── users/       # Пользователи и профили
├── nutrition/   # Питание: приёмы пищи, продукты, КБЖУ
├── billing/     # Подписки и платежи (YooKassa)
├── telegram/    # Интеграция с Telegram
├── ai/          # AI-распознавание еды (эндпоинты)
├── ai_proxy/    # Клиент для AI Proxy сервиса
├── core/        # Общие исключения и утилиты
└── common/      # Переиспользуемые компоненты
```

---

## Приложение `users/` — Пользователи

Управление пользователями, профилями и аватарами.

```
apps/users/
├── models.py        # Модель Profile (вес, рост, цели, аватар)
├── views.py         # API: /profile/, /profile/avatar/
├── serializers.py   # Сериализация данных профиля
├── services.py      # Бизнес-логика (расчёт КБЖУ)
├── validators.py    # Валидация данных профиля
├── throttles.py     # Лимиты запросов
├── urls.py          # Роутинг URL
├── admin.py         # Админка Django
├── migrations/      # Миграции базы данных
├── tests/           # Тесты
└── templates/       # HTML шаблоны (если есть)
```

**Основные эндпоинты:**
| URL | Метод | Что делает |
|-----|-------|------------|
| `/api/v1/profile/` | GET | Получить профиль текущего пользователя |
| `/api/v1/profile/` | PATCH | Обновить профиль |
| `/api/v1/profile/avatar/` | POST | Загрузить аватар |
| `/api/v1/profile/avatar/` | DELETE | Удалить аватар |

---

## Приложение `nutrition/` — Питание

Дневник питания: приёмы пищи, продукты, цели КБЖУ.

```
apps/nutrition/
├── models.py        # Meal (приём пищи), FoodItem (продукт), DailyGoal
├── views.py         # API: /meals/, /goals/
├── serializers.py   # Сериализация данных
├── services.py      # Бизнес-логика (подсчёт калорий за день)
├── urls.py          # Роутинг URL
├── admin.py         # Админка
├── migrations/      # Миграции
└── tests.py         # Тесты
```

**Модели:**
| Модель | Описание |
|--------|----------|
| `Meal` | Приём пищи (завтрак, обед, ужин, перекус) |
| `FoodItem` | Конкретный продукт в приёме пищи (название, граммы, КБЖУ) |
| `DailyGoal` | Дневные цели КБЖУ пользователя |

**Основные эндпоинты:**
| URL | Метод | Что делает |
|-----|-------|------------|
| `/api/v1/meals/` | GET | Список приёмов пищи за дату |
| `/api/v1/meals/` | POST | Создать приём пищи |
| `/api/v1/meals/{id}/items/` | POST | Добавить продукт в приём |
| `/api/v1/goals/` | GET | Получить текущие цели КБЖУ |
| `/api/v1/goals/` | POST | Установить цели КБЖУ |

---

## Приложение `billing/` — Подписки и платежи

Интеграция с YooKassa, управление тарифами и подписками.

```
apps/billing/
├── models.py           # Tariff, Subscription, Payment, UsageLimit
├── views.py            # API: /billing/tariffs/, /billing/subscribe/
├── serializers.py      # Сериализация данных
├── services.py         # Логика подписок, создание платежей
├── yookassa_client.py  # Клиент YooKassa API
├── webhooks.py         # Обработка webhook-ов от YooKassa
├── webhooks/           # Дополнительные webhook обработчики
├── usage.py            # Учёт использования лимитов
├── throttles.py        # Лимиты запросов
├── urls.py             # Роутинг URL
├── admin.py            # Админка
├── migrations/         # Миграции
├── tests.py            # Тесты
└── test_limits.py      # Тесты лимитов
```

**Модели:**
| Модель | Описание |
|--------|----------|
| `Tariff` | Тарифный план (название, цена, лимиты) |
| `Subscription` | Подписка пользователя на тариф |
| `Payment` | Платёж через YooKassa |
| `UsageLimit` | Учёт использования (фото/день, и т.д.) |

**Основные эндпоинты:**
| URL | Метод | Что делает |
|-----|-------|------------|
| `/api/v1/billing/tariffs/` | GET | Список доступных тарифов |
| `/api/v1/billing/subscription/` | GET | Текущая подписка пользователя |
| `/api/v1/billing/subscribe/` | POST | Оформить подписку (создать платёж) |
| `/api/v1/billing/webhook/` | POST | Webhook от YooKassa |

---

## Приложение `telegram/` — Telegram интеграция

Авторизация через Telegram WebApp, работа с Telegram пользователями.

```
apps/telegram/
├── models.py           # TelegramUser (данные из Telegram)
├── views.py            # API: /telegram/auth/
├── views/              # Дополнительные views
├── authentication.py   # Telegram авторизация (проверка initData)
├── telegram_auth.py    # Утилиты авторизации
├── serializers.py      # Сериализация данных
├── services/           # Бизнес-логика
├── urls.py             # Роутинг URL
├── trainer_urls.py     # URL для тренера
├── migrations/         # Миграции
└── tests.py            # Тесты
```

**Как работает авторизация:**
1. Telegram WebApp отправляет `initData` в заголовке `X-TG-INIT-DATA`
2. Backend проверяет подпись с помощью токена бота
3. Если подпись верна — создаётся/обновляется пользователь
4. Все запросы авторизуются через этот заголовок

**Основные эндпоинты:**
| URL | Метод | Что делает |
|-----|-------|------------|
| `/api/v1/telegram/auth/` | POST | Авторизация через Telegram |
| `/api/v1/telegram/applications/` | GET | Заявки (для тренера) |
| `/api/v1/telegram/clients/` | GET | Клиенты (для тренера) |

---

## Приложение `ai/` — AI-распознавание

Эндпоинты для распознавания еды по фото.

```
apps/ai/
├── views.py         # API: /ai/recognize/
├── serializers.py   # Сериализация запросов/ответов
├── services.py      # Бизнес-логика распознавания
├── tasks.py         # Celery задачи (async распознавание)
├── throttles.py     # Лимиты запросов
├── urls.py          # Роутинг URL
└── tests.py         # Тесты
```

**Как работает распознавание:**
1. Пользователь отправляет фото на `/api/v1/ai/recognize/`
2. Backend отправляет фото в AI Proxy (через `ai_proxy`)
3. AI Proxy обрабатывает через OpenRouter/GPT-4 Vision
4. Результат возвращается: список продуктов с КБЖУ

**Основные эндпоинты:**
| URL | Метод | Что делает |
|-----|-------|------------|
| `/api/v1/ai/recognize/` | POST | Распознать еду на фото |
| `/api/v1/ai/task/{id}/` | GET | Статус async задачи |

---

## Приложение `ai_proxy/` — Клиент AI Proxy

Модуль для работы с внешним AI Proxy сервисом.

```
apps/ai_proxy/
├── client.py        # HTTP клиент для AI Proxy
├── service.py       # Сервис-обёртка
├── adapter.py       # Адаптер для разных AI провайдеров
├── utils.py         # Утилиты (парсинг data URL)
├── exceptions.py    # Кастомные исключения
└── README.md        # Документация модуля
```

**Что делает:**
- Отправляет изображения в AI Proxy сервис
- Обрабатывает ответы и ошибки
- Поддерживает multipart/form-data для отправки файлов

---

## Приложение `core/` — Общие компоненты

Базовые исключения и утилиты.

```
apps/core/
├── exceptions.py    # Кастомные исключения (APIError, ValidationError)
├── apps.py          # Конфигурация приложения
└── tests.py         # Тесты
```

---

## Приложение `common/` — Переиспользуемые утилиты

Общие утилиты, используемые во всех приложениях.

```
apps/common/
├── image_utils.py   # Работа с изображениями (resize, compress)
├── validators.py    # Общие валидаторы
├── logging.py       # Настройка логирования
├── storage.py       # Хранилище файлов (S3/local)
├── audit.py         # Аудит действий пользователей
├── views.py         # Общие views (health check)
└── tests.py         # Тесты
```

---

## Папка `config/` — Настройки Django

```
config/
├── settings/           # Настройки для разных окружений
│   ├── base.py        # Базовые настройки (общие для всех)
│   ├── local.py       # Настройки для локальной разработки
│   ├── production.py  # Настройки для production
│   └── test.py        # Настройки для тестов
│
├── urls.py             # Главный роутинг URL
├── celery.py           # Настройки Celery (async задачи)
├── wsgi.py             # WSGI точка входа (Gunicorn)
└── asgi.py             # ASGI точка входа (async)
```

**Настройки по окружениям:**
| Файл | Когда используется |
|------|-------------------|
| `base.py` | Всегда (базовые настройки) |
| `local.py` | `DJANGO_SETTINGS_MODULE=config.settings.local` |
| `production.py` | `DJANGO_SETTINGS_MODULE=config.settings.production` |
| `test.py` | При запуске тестов |

---

## Конфигурационные файлы

| Файл | Зачем нужен |
|------|-------------|
| `manage.py` | Команды Django: `python manage.py migrate`, `runserver`, и т.д. |
| `requirements.txt` | Список Python пакетов для `pip install -r requirements.txt` |
| `pyproject.toml` | Настройки **ruff** линтера (проверка кода) |

### Docker и деплой

| Файл | Зачем нужен |
|------|-------------|
| `Dockerfile` | Как собрать Docker-образ бэкенда |
| `entrypoint.sh` | Скрипт запуска: ждёт PostgreSQL → миграции → collectstatic → gunicorn |
| `gunicorn_config.py` | Настройки Gunicorn: воркеры, таймауты, логи |
| `nginx-host.conf` | Nginx конфиг для host-based деплоя (reference) |

### Переменные окружения (.env)

| Файл | Зачем нужен |
|------|-------------|
| `.env.example` | Шаблон — какие переменные нужны (коммитится в git) |
| `.env` | Реальные переменные (НЕ коммитится!) |

**Основные переменные:**
```bash
# Django
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=eatfit24.ru

# База данных
POSTGRES_DB=foodmind
POSTGRES_USER=foodmind
POSTGRES_PASSWORD=...
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis & Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# AI
AI_PROXY_URL=http://...
AI_PROXY_SECRET=...

# Telegram
TELEGRAM_BOT_TOKEN=...

# YooKassa
YOOKASSA_SHOP_ID_PROD=...
YOOKASSA_API_KEY_PROD=...
```

---

## Структура Django приложения (общая)

Каждое приложение в `apps/` следует стандартной структуре:

```
app_name/
├── models.py        # Модели базы данных (таблицы)
├── views.py         # Обработчики HTTP запросов
├── serializers.py   # Преобразование данных (JSON ↔ Python)
├── services.py      # Бизнес-логика (не в views!)
├── urls.py          # URL маршруты приложения
├── admin.py         # Настройка Django Admin
├── tests.py         # Тесты
├── migrations/      # Миграции базы данных
└── __init__.py      # Пустой файл (Python пакет)
```

---

## API структура

Все API эндпоинты доступны по префиксу `/api/v1/`:

```
/api/v1/
├── profile/              # Профиль пользователя
├── meals/                # Приёмы пищи
├── goals/                # Цели КБЖУ
├── ai/recognize/         # AI распознавание
├── billing/              # Подписки и платежи
│   ├── tariffs/
│   ├── subscription/
│   └── subscribe/
├── telegram/             # Telegram интеграция
│   ├── auth/
│   ├── applications/
│   └── clients/
└── health/               # Health check
```

---

## Полезные команды

```bash
# Разработка
python manage.py runserver              # Запустить dev-сервер
python manage.py shell                  # Django shell

# База данных
python manage.py makemigrations         # Создать миграции
python manage.py migrate                # Применить миграции
python manage.py showmigrations         # Показать статус миграций

# Админка
python manage.py createsuperuser        # Создать админа

# Тесты
python manage.py test                   # Запустить все тесты
python manage.py test apps.users        # Тесты конкретного приложения

# Статика
python manage.py collectstatic          # Собрать статику для production

# Celery (в отдельном терминале)
celery -A config worker -l info         # Запустить воркер
```

---

## Как всё работает вместе

```
1. Запрос от фронтенда
   └── nginx (reverse proxy)
       └── gunicorn (WSGI сервер)
           └── Django (обработка запроса)
               └── View → Serializer → Service → Model → DB

2. Async задачи (AI распознавание)
   └── View создаёт Celery task
       └── Redis (брокер)
           └── Celery Worker обрабатывает
               └── Результат в Redis
                   └── Frontend polling /task/{id}/

3. Платежи
   └── User → /billing/subscribe/ → YooKassa
       └── YooKassa → /billing/webhook/ (callback)
           └── Обновление подписки в БД
```

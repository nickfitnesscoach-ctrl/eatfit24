# 📋 EatFit24 Risk Register

> **Тип:** Приложение к AUDIT.md  
> **Дата:** 2025-12-24

---

## Формат записи

| Поле | Описание |
|------|----------|
| **ID** | Уникальный идентификатор (P0-1, P1-2, etc.) |
| **Severity** | P0 (Critical) / P1 (Important) / P2 (Minor) |
| **Category** | AI, Billing, Nutrition, Telegram, Security, Data |
| **Impact** | Что сломает для пользователя/бизнеса |
| **Root Cause** | Техническая причина |
| **Location** | Путь к файлу + строки |
| **Fix Outline** | Минимальное исправление |
| **Test Plan** | Как проверить исправление |
| **Status** | OPEN / IN_PROGRESS / FIXED |

---

## P0 — Critical

### P0-1: Лимиты AI не списываются

| Field | Value |
|-------|-------|
| **Severity** | P0 |
| **Category** | AI, Billing |
| **Impact** | FREE пользователи могут делать неограниченное количество AI запросов. Бизнес теряет мотивацию upgrade. |
| **Root Cause** | `recognize_food_async` в `tasks.py` не вызывает `DailyUsage.objects.increment_photo_ai_requests()` |
| **Location** | [tasks.py:159-195](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/tasks.py#L159-L195) |
| **Fix Outline** | После `transaction.atomic()` (line 172) добавить вызов `DailyUsage.objects.increment_photo_ai_requests(user)` |
| **Test Plan** | 1. Создать FREE user с limit=3; 2. Отправить 4 фото; 3. Проверить что 4-е отклонено с 429 |
| **Status** | OPEN |

---

### P0-2: Legacy файлы с битыми импортами

| Field | Value |
|-------|-------|
| **Severity** | P0 |
| **Category** | AI |
| **Impact** | `ImportError` при попытке использовать `services_legacy.py`. Путаница в кодовой базе. |
| **Root Cause** | `services_legacy.py:13` импортирует `AIProxyRecognitionService`, который не существует в `apps.ai_proxy.service` |
| **Location** | [services_legacy.py:13](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/services_legacy.py#L13), [tests_legacy.py:89](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/tests_legacy.py#L89) |
| **Fix Outline** | Удалить файлы: `rm backend/apps/ai/services_legacy.py backend/apps/ai/tests_legacy.py` |
| **Test Plan** | `python -c "from apps.ai import *"` — не должно падать |
| **Status** | OPEN |

---

### P0-3: Timezone mismatch в лимитах

| Field | Value |
|-------|-------|
| **Severity** | P0 |
| **Category** | Billing, Data |
| **Impact** | Лимиты могут сброситься в неправильное время (UTC vs local). Пользователь может получить больше или меньше запросов. |
| **Root Cause** | `DailyUsage.date` использует `date.today()` (local), а другие места `timezone.now().date()` (UTC-aware) |
| **Location** | [usage.py:150](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/billing/usage.py#L150), [serializers.py:95](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/nutrition/serializers.py#L95) |
| **Fix Outline** | Заменить все `date.today()` на `timezone.localdate()` или `timezone.now().date()` с явной политикой |
| **Test Plan** | 1. Установить TZ=UTC+3; 2. Проверить что "сегодня" одинаково в usage и nutrition |
| **Status** | OPEN |

---

## P1 — Important

### P1-1: Документация не соответствует коду

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Category** | Documentation |
| **Impact** | Разработчики используют неверные API (`can_analyze_photo`, `increment_usage`) |
| **Root Cause** | Документация описывает planned API, а не actual |
| **Location** | [limits-and-usage.md:42](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/billing/docs/limits-and-usage.md#L42) |
| **Fix Outline** | Обновить документацию под фактический API: `check_and_increment_if_allowed`, `increment_photo_ai_requests` |
| **Test Plan** | Все примеры кода в документации должны работать |
| **Status** | OPEN |

---

### P1-2: db.sqlite3 в репозитории

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Category** | Security, Data |
| **Impact** | Потенциально чувствительные данные в git history. 434KB мусора. |
| **Root Cause** | Файл не добавлен в .gitignore до commit |
| **Location** | [db.sqlite3](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/db.sqlite3) |
| **Fix Outline** | `git rm --cached backend/db.sqlite3` + добавить в .gitignore |
| **Test Plan** | `git ls-files | grep sqlite` — пусто |
| **Status** | OPEN |

---

### P1-3: grams vs amount_grams inconsistency

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Category** | AI, Data |
| **Impact** | `KeyError: 'grams'` при сохранении items в БД (строка 167 использует `it["grams"]`, но dict содержит `amount_grams`) |
| **Root Cause** | `_json_safe_items()` возвращает `amount_grams`, но `meal.items.create()` ожидает `grams` |
| **Location** | [tasks.py:72](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/tasks.py#L72) vs [tasks.py:167](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/tasks.py#L167) |
| **Fix Outline** | Использовать `it["amount_grams"]` в line 167 или вернуть `grams` в `_json_safe_items` |
| **Test Plan** | Unit test: `recognize_food_async` не падает с реальными данными AI |
| **Status** | OPEN |

---

### P1-4: Нет проверки лимита ДО создания Meal

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Category** | AI, Billing |
| **Impact** | Создаются "пустые" Meal записи даже когда лимит исчерпан |
| **Root Cause** | `AIRecognitionView.post()` создаёт Meal до проверки лимита |
| **Location** | [views.py:68-75](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/views.py#L68-L75) |
| **Fix Outline** | Добавить проверку `DailyUsage.objects.check_and_increment_if_allowed()` перед созданием Meal |
| **Test Plan** | При исчерпании лимита: 1) возвращается 429; 2) Meal НЕ создаётся |
| **Status** | OPEN |

---

### P1-5: DEBUG_MODE_ENABLED bypass

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Category** | Security |
| **Impact** | Если `DEBUG_MODE_ENABLED=True` в prod, можно bypass auth через `X-Debug-Mode: true` |
| **Root Cause** | Проверка `DEBUG_MODE_ENABLED` не связана с Django DEBUG |
| **Location** | [telegram_auth.py:121-146](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/telegram/telegram_auth.py#L121-L146) |
| **Fix Outline** | Заменить на `if settings.DEBUG and getattr(settings, "DEBUG_MODE_ENABLED", False):` |
| **Test Plan** | В prod с `DEBUG=False` заголовок `X-Debug-Mode` игнорируется |
| **Status** | OPEN |

---

### P1-6: Отсутствует проверка лимита в views.py

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Category** | AI, Billing |
| **Impact** | Даже если tasks.py будет списывать лимиты — 429 возвращается слишком поздно |
| **Root Cause** | Нет вызова `check_and_increment_if_allowed` в начале `AIRecognitionView.post()` |
| **Location** | [views.py:57-115](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/views.py#L57-L115) |
| **Fix Outline** | В начале post() проверить лимит, вернуть 429 если исчерпан |
| **Test Plan** | При 4-м запросе FREE user получает 429 ДО создания Meal |
| **Status** | OPEN |

---

## P2 — Minor

### P2-1: Runtime artifacts в репо

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Category** | Cleanup |
| **Files** | `celerybeat-schedule`, `gunicorn.pid`, `__pycache__/` |
| **Fix Outline** | `git rm --cached` + `.gitignore` |
| **Status** | OPEN |

---

### P2-2: Дублирование _clamp_grams

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Category** | Code Quality |
| **Location** | [tasks.py:49-58](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/tasks.py#L49-L58), [adapter.py:44-45](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai_proxy/adapter.py#L44-L45) |
| **Fix Outline** | Вынести в `common/utils.py` |
| **Status** | OPEN |

---

### P2-3: admin-credentials.txt в корне

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Category** | Security |
| **Location** | [admin-credentials.txt](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/admin-credentials.txt) |
| **Fix Outline** | Проверить содержимое. Если реальные креды — срочно удалить и ротировать. |
| **Status** | OPEN |

---

### P2-4: MEAL_TYPE_CHOICES дублируется

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Category** | Code Quality |
| **Location** | [serializers.py:26](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/serializers.py#L26), [models.py:19](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/nutrition/models.py#L19) |
| **Fix Outline** | Импортировать из models.py |
| **Status** | OPEN |

---

### P2-5: Отсутствует __init__.py экспорт для tests

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Category** | Code Quality |
| **Location** | [tests/__init__.py](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/Fitness-app/backend/apps/ai/tests/__init__.py) — почти пустой |
| **Fix Outline** | Добавить экспорт тестовых классов |
| **Status** | OPEN |

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 | 3 | 3 OPEN |
| P1 | 6 | 6 OPEN |
| P2 | 5 | 5 OPEN |
| **Total** | **14** | |

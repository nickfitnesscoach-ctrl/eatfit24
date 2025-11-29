# Управление тарифами через Django Admin

## Обзор

Система управления тарифами позволяет администраторам управлять ценами и параметрами подписок через Django Admin без изменения кода.

## Модель SubscriptionPlan

### Основные поля

#### Системные поля
- **code** (CharField, unique, read-only) - Системный код тарифа для API
  - Примеры: `FREE`, `PRO_MONTHLY`, `PRO_YEARLY`
  - **ВАЖНО**: Это поле доступно только для чтения в админке!
  - Используется во всех API запросах

- **name** (CharField, legacy) - Устаревшее поле, используйте `code`
  - Поддерживается для обратной совместимости
  - Скрыто в collapsed секции админки

#### Отображаемые поля
- **display_name** - Человекочитаемое название тарифа
  - Примеры: "Бесплатный", "PRO месяц", "PRO год"
  - Отображается пользователям в интерфейсе

- **description** - Описание тарифа (опционально)

#### Цены и сроки
- **price** (Decimal) - Цена в рублях
  - Можно изменять через админку
  - Изменения сразу влияют на API (без кеша)

- **duration_days** (Integer) - Срок действия тарифа в днях
  - `0` для FREE (бессрочно)
  - `30` для PRO_MONTHLY
  - `365` для PRO_YEARLY

#### Возможности (Features)
- **daily_photo_limit** - Лимит фото в день
  - `3` для FREE
  - `null` для PRO (безлимит)

- **history_days** - Хранение истории в днях
  - `7` для FREE
  - `-1` для PRO (неограниченно)

- **ai_recognition** - AI распознавание (Boolean)
- **advanced_stats** - Расширенная статистика (Boolean)
- **priority_support** - Приоритетная поддержка (Boolean)

#### Статус
- **is_active** - Активен ли план
- **is_test** - Тестовый план (для проверки платежей)

## Работа с Django Admin

### Доступ к админке
1. Откройте `https://your-domain.com/admin/`
2. Войдите с учетной записью суперпользователя
3. Перейдите в раздел "Billing" → "Тарифные планы"

### Что можно делать
✅ **Разрешено:**
- Редактировать существующие планы (FREE, PRO_MONTHLY, PRO_YEARLY)
- Изменять цены (`price`)
- Изменять параметры (`daily_photo_limit`, `history_days`, и т.д.)
- Изменять отображаемые названия (`display_name`)
- Включать/отключать планы (`is_active`)

❌ **Запрещено:**
- Создавать новые планы через UI
- Удалять существующие планы
- Изменять поле `code` (read-only)

### Пример: Изменение цены PRO_MONTHLY

1. Откройте план "PRO месяц" в админке
2. Измените поле "Цена (₽)" с `299.00` на новое значение
3. Нажмите "Сохранить"
4. **Готово!** Новая цена сразу доступна через API

## API Endpoints

### 1. GET /api/v1/billing/plans/
**Публичный endpoint** (без авторизации) для получения списка тарифов.

**Response:**
```json
[
  {
    "code": "FREE",
    "display_name": "Бесплатный",
    "price": 0,
    "duration_days": 0,
    "daily_photo_limit": 3,
    "history_days": 7,
    "ai_recognition": true,
    "advanced_stats": false,
    "priority_support": false
  },
  {
    "code": "PRO_MONTHLY",
    "display_name": "PRO месяц",
    "price": 299,
    "duration_days": 30,
    "daily_photo_limit": null,
    "history_days": -1,
    "ai_recognition": true,
    "advanced_stats": true,
    "priority_support": true
  },
  {
    "code": "PRO_YEARLY",
    "display_name": "PRO год",
    "price": 2490,
    "duration_days": 365,
    "daily_photo_limit": null,
    "history_days": -1,
    "ai_recognition": true,
    "advanced_stats": true,
    "priority_support": true
  }
]
```

### 2. POST /api/v1/billing/create-payment/
Создание платежа для подписки.

**ВАЖНО:** Сумма платежа берется с бэкенда из `SubscriptionPlan.price`, а **НЕ из фронтенда**.

**Request:**
```json
{
  "plan_code": "PRO_MONTHLY",
  "return_url": "https://example.com/success"  // опционально
}
```

**Response (201):**
```json
{
  "payment_id": "uuid",
  "yookassa_payment_id": "...",
  "confirmation_url": "https://..."
}
```

**Errors:**
- `400`: План не найден или невалиден
- `502`: Ошибка создания платежа в YooKassa

## Миграции

### Применение миграций

**ВАЖНО:** Перед применением миграций убедитесь, что у вас есть резервная копия БД!

```bash
# 1. Применить миграции
python manage.py migrate billing

# Будут применены:
# - 0006_add_code_field_to_subscription_plan: Добавление поля code
# - 0007_update_subscription_plans_data: Обновление данных тарифов
```

### Структура миграций

1. **0006_add_code_field_to_subscription_plan**
   - Добавляет поле `code` к модели `SubscriptionPlan`
   - Заполняет `code` для существующих планов:
     - `FREE` → `FREE`
     - `MONTHLY` → `PRO_MONTHLY`
     - `YEARLY` → `PRO_YEARLY`
   - Делает поле `name` опциональным (legacy)

2. **0007_update_subscription_plans_data**
   - Обновляет цены:
     - `PRO_MONTHLY`: 299₽
     - `PRO_YEARLY`: 2490₽
   - Обновляет названия и параметры планов

### Откат миграций (если нужно)

```bash
# Откат до миграции 0005
python manage.py migrate billing 0005_add_is_test_field_and_create_test_plan
```

## Обратная совместимость

### Legacy поля
Для обеспечения обратной совместимости со старым кодом:

1. **Поле `name`** - поддерживается, но помечено как deprecated
2. **API** - принимает как новые коды (`PRO_MONTHLY`), так и старые (`MONTHLY`)
3. **Сервисы** - автоматически пытаются найти план сначала по `code`, затем по `name`

### Пример (в коде):
```python
from apps.billing.services import create_subscription_payment

# Новый способ (рекомендуется)
payment, url = create_subscription_payment(user, 'PRO_MONTHLY')

# Старый способ (legacy, но работает)
payment, url = create_subscription_payment(user, 'MONTHLY')
```

## Тестирование

### 1. Проверка API списка тарифов
```bash
curl https://your-domain.com/api/v1/billing/plans/
```

### 2. Проверка создания платежа
```bash
curl -X POST https://your-domain.com/api/v1/billing/create-payment/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"plan_code": "PRO_MONTHLY"}'
```

### 3. Проверка админки
1. Откройте Django Admin
2. Перейдите в "Тарифные планы"
3. Убедитесь, что видны 3-4 плана (FREE, PRO_MONTHLY, PRO_YEARLY, возможно TEST_LIVE)
4. Попробуйте изменить цену любого плана
5. Проверьте, что изменение отображается в API

## FAQ

### Можно ли добавить новый тарифный план?
Нет, через админку нельзя. Новые планы добавляются через миграции:
1. Создайте новую миграцию
2. Добавьте создание плана в `RunPython`
3. Примените миграцию

### Как изменить цены на всех планах одновременно?
1. Откройте Django Admin
2. Выберите несколько планов в списке (checkbox)
3. В выпадающем меню "Действия" пока нет массового редактирования
4. Редактируйте каждый план отдельно

Альтернатива: создайте data-миграцию для массового обновления.

### Что будет, если удалить поле `name` из модели?
Старый код, использующий `name`, перестанет работать. Поэтому поле оставлено для обратной совместимости и помечено как deprecated.

### Как узнать, какие планы активны в production?
```bash
# В Django shell
python manage.py shell

from apps.billing.models import SubscriptionPlan
SubscriptionPlan.objects.filter(is_active=True).values('code', 'price', 'display_name')
```

## Безопасность

### Защита поля `code`
- Поле `code` read-only в админке
- Изменение `code` может сломать интеграции
- Если нужно изменить `code`, используйте миграцию

### Валидация цен
- Цены хранятся как `Decimal` для точности
- Не используйте отрицательные цены
- FREE план должен иметь `price = 0`

### Аудит изменений
Django Admin автоматически логирует все изменения в таблицу `django_admin_log`.

Просмотр истории изменений:
```bash
python manage.py shell

from django.contrib.admin.models import LogEntry
LogEntry.objects.filter(content_type__model='subscriptionplan').order_by('-action_time')
```

## Поддержка

При возникновении проблем:
1. Проверьте логи Django: `tail -f logs/django.log`
2. Проверьте миграции: `python manage.py showmigrations billing`
3. Откройте issue в проекте с описанием проблемы

# Daily Photo Limits System - Implementation Summary

## Обзор

Реализована комплексная система тарифных планов с дневными лимитами на распознавание фото через AI. Система включает три тарифа (FREE, MONTHLY, YEARLY) с различными лимитами и полную интеграцию с платежной системой YooKassa.

## Структура Тарифных Планов

### FREE Plan
- **Цена**: 0 ₽
- **Лимит**: 3 фото в день
- **Длительность**: Бессрочно
- **Код**: `FREE`

### MONTHLY Plan (Pro Месячный)
- **Цена**: 299 ₽
- **Лимит**: Безлимитно (null)
- **Длительность**: 30 дней
- **Код**: `MONTHLY`

### YEARLY Plan (Pro Годовой)
- **Цена**: 2490 ₽
- **Лимит**: Безлимитно (null)
- **Длительность**: 365 дней
- **Код**: `YEARLY`

## Реализованные Компоненты

### 1. Модели Данных

#### SubscriptionPlan (обновлена)
```python
# Новое поле
daily_photo_limit = IntegerField(null=True, blank=True)
# null = безлимит, число = количество фото в день
```

#### DailyUsage (новая модель)
```python
class DailyUsage(models.Model):
    user = ForeignKey(User)
    date = DateField(default=date.today)
    photo_ai_requests = IntegerField(default=0)

    class Meta:
        unique_together = [['user', 'date']]
```

**Менеджер DailyUsage:**
- `get_today(user)` - получить/создать запись на сегодня
- `increment_photo_requests(user)` - инкрементировать счетчик

### 2. Сервисы

#### `get_effective_plan_for_user(user)`
Возвращает действующий тарифный план пользователя:
- Если есть активная подписка → её план
- Иначе → FREE план

#### `create_subscription_payment(user, plan_code, return_url)`
Универсальный сервис создания платежа для любого плана:
- Валидирует план (не FREE, price > 0)
- Создает Payment с блокировкой (select_for_update)
- Интегрируется с YooKassa через кастомный клиент

#### `activate_or_extend_subscription(user, plan_code, duration_days)`
Активация или продление подписки:
- Создает подписку если её нет
- Продлевает активную подписку
- Обновляет план при необходимости

### 3. API Endpoints

#### `GET /api/v1/billing/me/`
Получение статуса подписки с лимитами:

**Response:**
```json
{
  "plan_code": "FREE",
  "plan_name": "Бесплатный",
  "expires_at": null,
  "is_active": true,
  "daily_photo_limit": 3,
  "used_today": 2,
  "remaining_today": 1
}
```

#### `POST /api/v1/billing/create-payment/`
Универсальное создание платежа:

**Request:**
```json
{
  "plan_code": "MONTHLY",
  "return_url": "https://example.com/success"  // опционально
}
```

**Response (201):**
```json
{
  "payment_id": "uuid",
  "yookassa_payment_id": "...",
  "confirmation_url": "https://yookassa.ru/..."
}
```

**Errors:**
- `400 MISSING_PLAN_CODE` - не указан plan_code
- `400 INVALID_PLAN` - план не найден или FREE
- `502 PAYMENT_CREATE_FAILED` - ошибка YooKassa

#### `POST /api/v1/ai/recognize/`
AI распознавание с проверкой лимитов:

**Логика проверки:**
1. Получить действующий план пользователя
2. Получить использование на сегодня
3. Если лимит превышен → вернуть 429
4. Иначе → выполнить распознавание
5. Инкрементировать счетчик

**Response 429 (при превышении):**
```json
{
  "error": "DAILY_LIMIT_REACHED",
  "detail": "Превышен дневной лимит 3 фото. Обновите тариф для безлимитного распознавания.",
  "current_plan": "FREE",
  "daily_limit": 3,
  "used_today": 3
}
```

### 4. Webhook Handler

#### `handle_payment_succeeded(payment_object)`
Обработка успешного платежа с защитой от FREE активации:

**Логика:**
1. Проверка: если план FREE или price ≤ 0 → блокировка
2. Логирование подозрительной активности
3. Активация/продление подписки
4. Сохранение payment_method для автопродления

### 5. Миграции

#### `0002_add_daily_photo_limit_and_usage.py`
- Добавляет поле `daily_photo_limit` в SubscriptionPlan
- Создает модель DailyUsage
- Добавляет индексы и ограничения

#### `0003_populate_subscription_plans.py`
Создает/обновляет стандартные планы:
- FREE (limit=3)
- MONTHLY (limit=null)
- YEARLY (limit=null)

### 6. Тесты

Создан файл `test_limits.py` с тестами:

**DailyUsageTestCase:**
- Создание записей на сегодня
- Инкремент счетчика
- Свойство is_today

**GetEffectivePlanTestCase:**
- Возврат FREE при отсутствии подписки
- Возврат активной подписки
- Возврат FREE при истекшей подписке

**PhotoLimitEnforcementTestCase:**
- FREE пользователь в пределах лимита (3 запроса)
- FREE пользователь блокируется на 4-м запросе (429)
- PRO пользователь делает безлимитные запросы

**GetSubscriptionStatusWithLimitsTestCase:**
- Корректное отображение лимитов и использования
- Безлимитный план (null values)

**CreateUniversalPaymentTestCase:**
- Создание платежа для MONTHLY/YEARLY
- Блокировка создания платежа для FREE
- Обработка отсутствующего plan_code

**WebhookFreePlanPreventionTestCase:**
- Webhook блокирует активацию FREE через платеж

## Безопасность

### Валидации
1. ✅ Невозможно создать платеж для FREE плана (price ≤ 0)
2. ✅ Webhook блокирует активацию FREE через payment.succeeded
3. ✅ Проверка лимитов происходит ДО обращения к AI
4. ✅ Счетчик инкрементируется только после успешного распознавания

### Логирование
- Security audit при создании платежа
- Warning при превышении лимита
- Error при попытке активации FREE через платеж
- Security event при подозрительных операциях

### Race Condition Protection
- `select_for_update()` при создании платежа
- `unique_together` constraint для DailyUsage
- Транзакции для критических операций

## Совместимость

### Обратная совместимость
- Поле `max_photos_per_day` помечено как legacy
- Endpoint `/billing/create-plus-payment/` помечен deprecated
- Сервис `create_monthly_subscription_payment()` обертка над новым

### Депрецированные компоненты
```python
# Старый endpoint (deprecated)
POST /api/v1/billing/create-plus-payment/

# Используйте вместо него:
POST /api/v1/billing/create-payment/
Body: {"plan_code": "MONTHLY"}
```

## Инструкции по Развертыванию

### 1. Применение миграций
```bash
cd backend
python manage.py migrate billing
```

Это создаст:
- Поле `daily_photo_limit` в таблице subscription_plans
- Таблицу `daily_usage`
- 3 стандартных тарифных плана

### 2. Проверка планов
```bash
python manage.py shell
>>> from apps.billing.models import SubscriptionPlan
>>> SubscriptionPlan.objects.all()
```

Должны быть созданы планы FREE, MONTHLY, YEARLY.

### 3. Запуск тестов
```bash
# Все тесты billing
python manage.py test apps.billing

# Только тесты лимитов
python manage.py test apps.billing.test_limits

# Конкретный тест
python manage.py test apps.billing.test_limits.PhotoLimitEnforcementTestCase
```

## Примеры Использования

### Проверка текущего плана
```python
from apps.billing.services import get_effective_plan_for_user

plan = get_effective_plan_for_user(user)
print(f"Plan: {plan.name}, Limit: {plan.daily_photo_limit}")
```

### Проверка использования
```python
from apps.billing.usage import DailyUsage

usage = DailyUsage.objects.get_today(user)
print(f"Used today: {usage.photo_ai_requests}")
```

### Создание платежа через API
```bash
curl -X POST https://api.example.com/api/v1/billing/create-payment/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_code": "MONTHLY"}'
```

## Мониторинг

### Метрики для отслеживания
1. Количество пользователей, достигших лимита (429 ответы)
2. Средне� использование на FREE пользователя
3. Conversion rate: FREE → MONTHLY/YEARLY
4. Попытки создания платежа для FREE (security audit)

### Логи
```bash
# Превышение лимитов
grep "exceeded daily photo limit" logs/django.log

# Подозрительная активность
grep "FREE_PLAN_PAYMENT_ATTEMPT" logs/security_audit.log

# Успешные платежи
grep "Payment.*succeeded" logs/django.log
```

## Известные Ограничения

1. **Сброс лимита**: Лимит сбрасывается в 00:00 UTC каждый день
2. **Часовые пояса**: Использование основано на timezone.now().date()
3. **База данных**: Требуется PostgreSQL для корректной работы транзакций

## Следующие Шаги

### Рекомендуемые улучшения
1. **Email уведомления**: Уведомление при достижении лимита
2. **Graceful degradation**: Показывать низкокачественное распознавание вместо 429
3. **Analytics dashboard**: Визуализация использования лимитов
4. **Автопродление**: Автоматическое продление подписки при auto_renew=True
5. **Промокоды**: Система промокодов для бесплатного PRO

### Возможная оптимизация
1. Кэширование `get_effective_plan_for_user` (Redis)
2. Batch increment для счетчика (уменьшение DB queries)
3. Денормализация: хранить лимит прямо в User модели

## Заключение

Система полностью готова к продакшн использованию. Все компоненты протестированы, включая edge cases (превышение лимита, истекшая подписка, попытка платежа за FREE).

**Основные преимущества:**
- ✅ Простая и понятная архитектура
- ✅ Полная тестовая покрытие
- ✅ Безопасность (валидации, аудит, race condition protection)
- ✅ Обратная совместимость
- ✅ Готовые миграции и тестовые данные

**Контакты для поддержки:**
- Backend: `backend/apps/billing/`
- Документация: Этот файл
- Тесты: `backend/apps/billing/test_limits.py`

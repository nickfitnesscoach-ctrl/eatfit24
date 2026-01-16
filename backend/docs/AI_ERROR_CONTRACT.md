# AI Error Contract

Единый, стабильный контракт ошибок для AI-обработки фото в EatFit24.

## Проблема

**До внедрения Error Contract:**
- ✗ Ошибка = произвольный текст (`error_message`)
- ✗ Нет структурированных кодов (`error_code`)
- ✗ Frontend не понимает, можно ли повторить
- ✗ Нет рекомендаций для пользователя (`user_actions`)
- ✗ Сложно строить аналитику

## Решение

Введён **Error Contract** — единый формат ошибок для бэкенда и фронтенда.

### Структура ошибки

```json
{
  "error_code": "AI_TIMEOUT",
  "user_title": "Не получилось обработать фото",
  "user_message": "Сервер не ответил вовремя. Попробуйте ещё раз.",
  "user_actions": ["retry"],
  "allow_retry": true,
  "retry_after_sec": 30,
  "trace_id": "abc123"
}
```

### Обязательные поля

| Поле | Тип | Описание |
|------|-----|----------|
| `error_code` | `string` | Уникальный код ошибки (UPPERCASE_SNAKE_CASE) |
| `user_title` | `string` | Короткий заголовок для пользователя (1-5 слов) |
| `user_message` | `string` | Подробное сообщение для пользователя (1-2 предложения) |
| `user_actions` | `array` | Список допустимых действий: `["retry", "retake", "contact_support", "upgrade"]` |
| `allow_retry` | `boolean` | Разрешить ли повторную попытку |
| `retry_after_sec` | `int?` | Рекомендуемая задержка перед retry (секунды, опционально) |
| `trace_id` | `string?` | ID трейса для корреляции логов (опционально) |

### Опциональные поля (только DEBUG режим)

| Поле | Тип | Описание |
|------|-----|----------|
| `debug_details` | `object?` | Технические детали (только в `DEBUG=True`) |

---

## Error Registry

Все ошибки определены централизованно в `backend/apps/ai/error_contract.py`.

### Доступные error_code (MVP)

#### Timeout Errors (категория: `timeout`)

| Code | User Title | Allow Retry | Retry After |
|------|------------|-------------|-------------|
| `AI_TIMEOUT` | Не получилось обработать фото | ✓ | 30 сек |
| `UPSTREAM_TIMEOUT` | Не получилось обработать фото | ✓ | 30 сек |

#### Server Errors (категория: `server`)

| Code | User Title | Allow Retry | Retry After |
|------|------------|-------------|-------------|
| `AI_SERVER_ERROR` | Не получилось обработать фото | ✓ | 60 сек |
| `UPSTREAM_ERROR` | Не получилось обработать фото | ✓ | 60 сек |
| `INTERNAL_ERROR` | Не получилось обработать фото | ✓ | 120 сек |

#### Image Validation Errors (категория: `validation`)

| Code | User Title | Allow Retry | User Actions |
|------|------------|-------------|--------------|
| `UNSUPPORTED_IMAGE_FORMAT` | Неподдерживаемый формат | ✗ | `["retake"]` |
| `IMAGE_DECODE_FAILED` | Не удалось обработать фото | ✗ | `["retake"]` |
| `INVALID_IMAGE` | Не удалось обработать фото | ✗ | `["retake"]` |
| `IMAGE_TOO_LARGE` | Фото слишком большое | ✗ | `["retake"]` |
| `UNSUPPORTED_IMAGE_TYPE` | Неподдерживаемый формат | ✗ | `["retake"]` |

#### Recognition Errors (категория: `validation`)

| Code | User Title | Allow Retry | User Actions |
|------|------------|-------------|--------------|
| `EMPTY_RESULT` | Не удалось распознать еду | ✗ | `["retake"]` |
| `UNSUPPORTED_CONTENT` | Не удалось распознать еду | ✗ | `["retake"]` |

#### Rate Limiting (категория: `limit`)

| Code | User Title | Allow Retry | User Actions |
|------|------------|-------------|--------------|
| `DAILY_PHOTO_LIMIT_EXCEEDED` | Дневной лимит исчерпан | ✗ | `["upgrade"]` |
| `RATE_LIMIT` | Слишком много запросов | ✓ (60 сек) | `["retry"]` |

#### System Errors (категория: `unknown`)

| Code | User Title | Allow Retry |
|------|------------|-------------|
| `CANCELLED` | Отменено | ✓ |
| `UNKNOWN_ERROR` | Произошла ошибка | ✓ (60 сек) |

---

## Использование в коде

### Backend (Python)

```python
from apps.ai.error_contract import AIErrorRegistry

# 1. Получить определение ошибки
error_def = AIErrorRegistry.AI_TIMEOUT

# 2. Преобразовать в dict для API response
response_data = error_def.to_dict(trace_id="abc123")

# 3. Результат:
{
    "error_code": "AI_TIMEOUT",
    "user_title": "Не получилось обработать фото",
    "user_message": "Сервер не ответил вовремя. Попробуйте ещё раз.",
    "user_actions": ["retry"],
    "allow_retry": True,
    "retry_after_sec": 30,
    "trace_id": "abc123"
}
```

### Пример в `tasks.py`

```python
from apps.ai.error_contract import AIErrorRegistry, AIErrorDefinition

def _update_meal_photo_failed(
    meal_photo_id: int | None,
    error_def: AIErrorDefinition,
    trace_id: Optional[str] = None,
):
    """Update MealPhoto to FAILED status with Error Contract data."""
    photo.error_code = error_def.code
    photo.error_message = error_def.user_message
    photo.recognized_data = error_def.to_dict(trace_id=trace_id)
    photo.save()

# Использование:
error_def = AIErrorRegistry.AI_TIMEOUT
_update_meal_photo_failed(meal_photo_id, error_def, trace_id=rid)
```

### Пример в `views.py` (лимиты)

```python
from apps.ai.error_contract import AIErrorRegistry
from rest_framework.response import Response
from rest_framework import status

# Дневной лимит фото
if usage.photo_ai_requests >= limit:
    error_def = AIErrorRegistry.DAILY_PHOTO_LIMIT_EXCEEDED
    resp = Response(
        error_def.to_dict(trace_id=request_id),
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    resp["X-Request-ID"] = request_id
    return resp

# Результат:
{
    "error_code": "DAILY_PHOTO_LIMIT_EXCEEDED",
    "user_title": "Дневной лимит исчерпан",
    "user_message": "Вы исчерпали дневной лимит фото. Оформите PRO для безлимита.",
    "user_actions": ["upgrade"],
    "allow_retry": false,
    "trace_id": "abc123"
}
```

### Пример в `exception_handler.py` (throttling)

```python
from rest_framework.exceptions import Throttled
from apps.ai.error_contract import AIErrorRegistry

def _handle_throttled_exception(exc: Throttled, context):
    """Handle DRF Throttled exception with AI Error Contract."""
    wait_seconds = int(exc.wait) if exc.wait else 60
    request_id = context.get('request').headers.get('X-Request-ID', uuid.uuid4().hex)

    error_def = AIErrorRegistry.RATE_LIMIT
    error_data = error_def.to_dict(trace_id=request_id)
    error_data['retry_after_sec'] = wait_seconds

    response = Response(error_data, status=status.HTTP_429_TOO_MANY_REQUESTS)
    response['X-Request-ID'] = request_id
    response['Retry-After'] = str(wait_seconds)
    return response

# Результат:
{
    "error_code": "RATE_LIMIT",
    "user_title": "Слишком много запросов",
    "user_message": "Подождите немного перед следующей попыткой.",
    "user_actions": ["retry"],
    "allow_retry": true,
    "retry_after_sec": 45,  # Динамическое значение от throttle
    "trace_id": "def456"
}
```

### Frontend (TypeScript)

Фронтенд продолжает использовать существующие константы (`frontend/src/features/ai/model/constants.ts`):

```typescript
// Проверка, можно ли повторить
if (result.allow_retry) {
    showRetryButton();
}

// Показ пользовательских действий
result.user_actions.forEach(action => {
    if (action === 'retry') showRetryButton();
    if (action === 'retake') showCameraButton();
    if (action === 'upgrade') showUpgradeButton();
});

// Показ сообщения
alert(result.user_title + '\n' + result.user_message);
```

---

## Backward Compatibility

### Для старых клиентов

Старые клиенты, ожидающие только `error` и `error_message`, продолжат работать:

```json
{
  "error": "AI_TIMEOUT",
  "error_message": "Сервер не ответил вовремя. Попробуйте ещё раз.",

  "error_code": "AI_TIMEOUT",
  "user_title": "Не получилось обработать фото",
  "user_message": "Сервер не ответил вовремя. Попробуйте ещё раз.",
  "user_actions": ["retry"],
  "allow_retry": true,
  "retry_after_sec": 30
}
```

### Маппинг legacy кодов

Старые коды автоматически маппятся на новые AIErrorDefinition:

```python
LEGACY_ERROR_CODE_MAP = {
    "IMAGE_PROCESSING_ERROR": AIErrorRegistry.IMAGE_DECODE_FAILED,
    "AI_ERROR": AIErrorRegistry.AI_SERVER_ERROR,
    "PREPROCESS_DECODE_FAILED": AIErrorRegistry.IMAGE_DECODE_FAILED,
    "UPSTREAM_INVALID_RESPONSE": AIErrorRegistry.UPSTREAM_ERROR,
}
```

---

## Debug vs Prod

### Production режим (`DEBUG=False`)

Только user-facing поля + trace_id:

```json
{
  "error_code": "AI_TIMEOUT",
  "user_title": "Не получилось обработать фото",
  "user_message": "Сервер не ответил вовремя. Попробуйте ещё раз.",
  "user_actions": ["retry"],
  "allow_retry": true,
  "retry_after_sec": 30,
  "trace_id": "abc123"
}
```

### Debug режим (`DEBUG=True`)

Добавляются технические детали:

```json
{
  "error_code": "INVALID_IMAGE",
  "user_title": "Не удалось обработать фото",
  "user_message": "Файл повреждён или не является изображением.",
  "user_actions": ["retake"],
  "allow_retry": false,
  "trace_id": "abc123",
  "debug_details": {
    "content_type": "image/gif",
    "longest_side": 2048,
    "exception": "PIL.UnidentifiedImageError"
  }
}
```

---

## Acceptance Testing

### Примеры ожидаемых ошибок для тестирования

#### 1. Дневной лимит фото (DAILY_PHOTO_LIMIT_EXCEEDED)

**Сценарий**: Пользователь исчерпал дневной лимит фото

**Ожидаемый ответ**:
```json
{
  "error_code": "DAILY_PHOTO_LIMIT_EXCEEDED",
  "user_title": "Дневной лимит исчерпан",
  "user_message": "Вы исчерпали дневной лимит фото. Оформите PRO для безлимита.",
  "user_actions": ["upgrade"],
  "allow_retry": false,
  "trace_id": "abc123"
}
```

**Проверки**:
- ✓ HTTP status = 429
- ✓ `allow_retry = false` (нельзя повторить, пока лимит не обновится)
- ✓ `user_actions = ["upgrade"]` (фронт показывает кнопку "Upgrade")
- ✓ `trace_id` присутствует

#### 2. Rate Limit (RATE_LIMIT)

**Сценарий**: Пользователь отправил слишком много запросов в минуту

**Ожидаемый ответ**:
```json
{
  "error_code": "RATE_LIMIT",
  "user_title": "Слишком много запросов",
  "user_message": "Подождите немного перед следующей попыткой.",
  "user_actions": ["retry"],
  "allow_retry": true,
  "retry_after_sec": 45,
  "trace_id": "def456"
}
```

**Проверки**:
- ✓ HTTP status = 429
- ✓ `allow_retry = true` (можно повторить после задержки)
- ✓ `retry_after_sec` заполнен (динамическое значение от throttle)
- ✓ HTTP header `Retry-After` присутствует
- ✓ `trace_id` присутствует

#### 3. Timeout (AI_TIMEOUT)

**Сценарий**: AI-сервер не ответил вовремя

**Ожидаемый ответ**:
```json
{
  "error_code": "AI_TIMEOUT",
  "user_title": "Не получилось обработать фото",
  "user_message": "Сервер не ответил вовремя. Попробуйте ещё раз.",
  "user_actions": ["retry"],
  "allow_retry": true,
  "retry_after_sec": 30,
  "trace_id": "ghi789"
}
```

**Проверки**:
- ✓ `allow_retry = true` (можно повторить)
- ✓ `retry_after_sec = 30` (рекомендованная задержка)
- ✓ `trace_id` присутствует

#### 4. Cancelled (CANCELLED)

**Сценарий**: Пользователь отменил обработку

**Ожидаемый ответ**:
```json
{
  "error_code": "CANCELLED",
  "user_title": "Отменено",
  "user_message": "Обработка была отменена пользователем.",
  "user_actions": [],
  "allow_retry": true,
  "trace_id": "jkl012"
}
```

**Проверки**:
- ✓ `allow_retry = true` (можно повторить, если передумал)
- ✓ `user_actions = []` (нет специальных действий)
- ✓ `trace_id` присутствует

#### 5. Unsupported Content (UNSUPPORTED_CONTENT)

**Сценарий**: На фото нет еды (скриншот, мем, рандомная картинка)

**Ожидаемый ответ**:
```json
{
  "error_code": "UNSUPPORTED_CONTENT",
  "user_title": "Не удалось распознать еду",
  "user_message": "На фото нет еды или изображение неподходящее. Попробуйте другое фото.",
  "user_actions": ["retake"],
  "allow_retry": false,
  "trace_id": "mno345"
}
```

**Проверки**:
- ✓ `allow_retry = false` (retry не поможет, нужно другое фото)
- ✓ `user_actions = ["retake"]` (фронт показывает кнопку "Переснять")
- ✓ `trace_id` присутствует

#### 6. Empty Result (EMPTY_RESULT)

**Сценарий**: Еда есть, но смазано/темно/не распознано

**Ожидаемый ответ**:
```json
{
  "error_code": "EMPTY_RESULT",
  "user_title": "Не удалось распознать еду",
  "user_message": "Мы не смогли распознать еду на фото. Попробуйте сделать фото крупнее.",
  "user_actions": ["retake"],
  "allow_retry": false,
  "trace_id": "pqr678"
}
```

**Проверки**:
- ✓ `allow_retry = false` (retry не поможет, нужно лучшее фото)
- ✓ `user_actions = ["retake"]` (фронт показывает подсказки + кнопку "Переснять")
- ✓ `trace_id` присутствует

---

## Преимущества

✅ **Frontend может строить UX без костылей** — знает, когда показывать retry, retake, upgrade
✅ **Ошибки становятся управляемыми** — централизованный реестр, нет дублирования
✅ **Есть база для саппорта и аналитики** — `error_code` + `category` + `trace_id`
✅ **Стабильный контракт** — frontend не ломается при изменении текста сообщений
✅ **Backward compatible** — старые клиенты продолжают работать

---

## Roadmap

### Реализовано (Phase 1)
- [x] Error Contract спецификация
- [x] `AIErrorRegistry` с централизованными определениями
- [x] Интеграция в `AIProxyService`
- [x] Интеграция в `tasks.py` (частично)
- [x] Backward compatibility маппинг

### TODO (Phase 2)
- [x] Завершить интеграцию в `tasks.py` (все error paths)
- [x] Обновить `views.py` для возврата структурированных ошибок
- [x] DRF throttle exception handler для `RATE_LIMIT`
- [x] Гарантия наличия `trace_id` во всех ошибках
- [ ] Добавить middleware для автоматического enrichment trace_id
- [ ] Интеграция с логированием (structured logging для grep/aggregation)
- [ ] Мониторинг метрик по `error_code` + `category`

### TODO (Phase 3)
- [ ] Frontend обновить для использования новых полей (`user_actions`, `allow_retry`)
- [ ] Добавить UI тесты для проверки retry логики
- [ ] A/B тест новых сообщений (`user_message` vs старые тексты)

---

## Ссылки

- Исходный код: [backend/apps/ai/error_contract.py](../apps/ai/error_contract.py)
- Frontend константы: [frontend/src/features/ai/model/constants.ts](../../frontend/src/features/ai/model/constants.ts)
- Issue tracker: GitHub Issues с тэгом `error-contract`

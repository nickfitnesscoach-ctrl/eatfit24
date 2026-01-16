# Debug Mode Test Checklist

## Цель
Проверить, что в debug режиме (`IS_DEBUG === true`) лимиты не блокируют работу с AI-пайплайном, но платежи остаются заблокированными.

---

## Frontend Tests (IS_DEBUG = true)

### ✅ Test 1: AI Processing без лимитов
**Шаги**:
1. Открыть `/food-log`
2. Загрузить 1 фото
3. Нажать "Анализировать"
4. Дождаться завершения обработки

**Ожидаемый результат**:
- ✅ Фото обработалось успешно
- ✅ Открылась модалка с результатами (`BatchResultsModal`)
- ✅ Можно закрыть модалку и вернуться на главную страницу
- ❌ Нет сообщений "Лимит исчерпан"

---

### ✅ Test 2: Batch Upload (10+ фото)
**Шаги**:
1. Открыть `/food-log`
2. Загрузить 10 фото
3. Нажать "Анализировать"
4. Дождаться завершения batch обработки

**Ожидаемый результат**:
- ✅ Все 10 фото обработались
- ✅ Кнопка "Анализировать" была активна всё время
- ❌ Не появилась `LimitReachedModal`
- ✅ `BatchResultsModal` показывает все результаты

---

### ✅ Test 3: Блокировка платежей в debug
**Шаги**:
1. Открыть `/subscription`
2. Нажать на любую кнопку "Купить PRO"

**Ожидаемый результат**:
- ✅ Показывается toast: "Платежи недоступны в режиме отладки"
- ❌ Нет редиректа на YooKassa
- ❌ Нет сетевых запросов к `/api/v1/billing/payments/create/`

---

### ✅ Test 4: UI не показывает лимиты
**Шаги**:
1. Открыть `/food-log`
2. Проверить нижний баннер с лимитами

**Ожидаемый результат**:
- ❌ Нет баннера "Лимит исчерпан" (красный фон)
- ✅ Показывается синий баннер "X / Y фото" (если не PRO)
- ✅ Или показывается "PRO активен" (если PRO)

---

## Backend Tests (DEBUG=True + X-Debug-Mode: true)

### ✅ Test 5: Backend bypass лимитов
**Шаги**:
1. Создать пользователя с исчерпанным лимитом (3/3 фото)
2. Отправить запрос к `/api/v1/ai/recognize/` с заголовком `X-Debug-Mode: true`

**Ожидаемый результат**:
- ✅ Backend принял запрос (202 Accepted)
- ❌ Backend НЕ вернул 429 Too Many Requests
- ❌ Backend НЕ вернул `DAILY_PHOTO_LIMIT_EXCEEDED`

---

### ✅ Test 6: Backend accounting в debug
**Шаги**:
1. Проверить `DailyUsage.photo_ai_requests` до debug запроса
2. Отправить debug запрос с `X-Debug-Mode: true`
3. Проверить `DailyUsage.photo_ai_requests` после

**Ожидаемый результат**:
- ✅ Usage инкрементился (это нормально: bypass check ≠ bypass accounting)
- ⚠️ Если нужна полная изоляция debug трафика — добавить проверку в `tasks.py`

---

## Production Tests (IS_DEBUG = false, DEBUG=False)

### ✅ Test 7: Лимиты работают в prod
**Шаги**:
1. Установить `IS_DEBUG = false` на фронте
2. Исчерпать лимит (загрузить 3/3 фото)
3. Попробовать загрузить ещё 1 фото

**Ожидаемый результат**:
- ✅ Кнопка "Анализировать" disabled
- ✅ Показывается `LimitReachedModal`
- ✅ Backend возвращает 429 + `DAILY_PHOTO_LIMIT_EXCEEDED`

---

### ✅ Test 8: Платежи работают в prod
**Шаги**:
1. Открыть `/subscription`
2. Нажать "Купить PRO Monthly"

**Ожидаемый результат**:
- ✅ Редирект на YooKassa checkout
- ✅ После оплаты пользователь получает PRO статус
- ✅ Лимиты убираются (daily_photo_limit = null)

---

## Security Tests

### ✅ Test 9: DEBUG=True запрещён в production.py
**Шаги**:
1. Установить `DEBUG=true` в `.env` на проде
2. Попробовать запустить Django с `DJANGO_SETTINGS_MODULE=config.settings.production`

**Ожидаемый результат**:
- ❌ Django НЕ запускается
- ✅ Ошибка: `RuntimeError: [SAFETY] DEBUG=True is forbidden in production.`

---

### ✅ Test 10: X-Debug-Mode работает только с DEBUG=True
**Шаги**:
1. Установить `DEBUG=false` на бэке
2. Отправить запрос с `X-Debug-Mode: true`

**Ожидаемый результат**:
- ✅ Backend игнорирует `X-Debug-Mode` (проверка лимитов активна)
- ✅ Логика: `is_debug_mode = settings.DEBUG and request.headers.get("X-Debug-Mode") == "true"`

---

## Чеклист "Готово к релизу"

- [ ] Test 1: AI Processing работает без блокировок
- [ ] Test 2: Batch Upload (10+ фото) работает
- [ ] Test 3: Платежи заблокированы в debug
- [ ] Test 4: UI не показывает лимиты в debug
- [ ] Test 5: Backend bypass лимитов в debug
- [ ] Test 7: Лимиты работают в prod
- [ ] Test 8: Платежи работают в prod
- [ ] Test 9: DEBUG=True запрещён в production.py
- [ ] Test 10: X-Debug-Mode игнорируется в prod

---

## Известные ограничения

### 1. Usage accounting в debug режиме
**Поведение**: В debug режиме usage счетчик `photo_ai_requests` всё равно инкрементится.

**Обоснование**:
- `bypass check` (не проверяем лимит) ≠ `bypass accounting` (не считаем usage)
- Это нормально для debug — мы хотим тестировать AI-пайплайн, но не хотим терять статистику

**Если нужна полная изоляция**:
- Добавить проверку `X-Debug-Mode` в `backend/apps/ai/tasks.py:441`
- Пропускать `increment_photo_ai_requests()` для debug запросов
- Или использовать отдельного `is_test_user` с фейковым планом

### 2. Double safety guards
**Поведение**: Проверка `!IS_DEBUG` есть и в `BillingContext`, и в `FoodLogPage`.

**Обоснование**:
- SSOT (Single Source of Truth) — это `BillingContext.isLimitReached`
- Проверки в `FoodLogPage` — "пояс безопасности" на первый релиз
- После стабилизации можно упростить до одной проверки в контексте

---

## Быстрая проверка (30 секунд)

```bash
# 1. Frontend: проверить константу
grep -r "IS_DEBUG =" frontend/src/shared/config/debug.ts
# Должно быть: export const IS_DEBUG = true (в dev)

# 2. Backend: проверить DEBUG guard
grep "DEBUG.*forbidden" backend/config/settings/production.py
# Должно быть: raise RuntimeError("[SAFETY] DEBUG=True is forbidden in production.")

# 3. Frontend: проверить BillingContext
grep "if (IS_DEBUG) return false" frontend/src/contexts/BillingContext.tsx
# Должно быть: строка с return false для isLimitReached

# 4. Backend: проверить debug bypass
grep "is_debug_mode.*X-Debug-Mode" backend/apps/ai/views.py
# Должно быть: is_debug_mode = settings.DEBUG and request.headers.get("X-Debug-Mode") == "true"
```

---

## Контакты для вопросов
- Frontend: `frontend/src/contexts/BillingContext.tsx`, `frontend/src/pages/FoodLogPage.tsx`
- Backend: `backend/apps/ai/views.py`, `backend/config/settings/production.py`
- Документация: `CLAUDE.md`, `DEBUG_MODE_TEST_CHECKLIST.md`

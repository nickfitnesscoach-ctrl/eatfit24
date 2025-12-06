# Browser Debug Mode для EatFit24

## Описание

**Browser Debug Mode** позволяет запускать и тестировать фронтенд EatFit24 в обычном браузере (Chrome/Edge/Firefox) без Telegram, только для отладки и тестирования.

**Важно:** Для обычных пользователей поведение не меняется — миниап по-прежнему будет показывать "Откройте через Telegram" при попытке открыть его напрямую в браузере.

## Как включить Browser Debug Mode

### 1. Настройка переменной окружения

В файле `frontend/.env.development` установите:

```env
VITE_WEB_DEBUG_ENABLED=true
```

**Важно:** В production-сборке (`frontend/.env.production`) эта переменная должна быть `false` для безопасности.

### 2. Использование URL-параметра

Откройте приложение в браузере с параметром `?web_debug=1` или `?debug=1`:

```
http://localhost:5173/app?web_debug=1
# или
http://localhost:5173/app?debug=1
# или на проде (если VITE_WEB_DEBUG_ENABLED=true в сборке)
https://eatfit24.ru/app?web_debug=1&date=2025-12-06
```

### 3. Запуск приложения

```bash
cd frontend
npm run dev
```

Откройте браузер и перейдите по URL с параметром debug.

## Что происходит в Browser Debug Mode

### Аутентификация

- Вместо реальной Telegram-авторизации используется фиктивный debug user:
  - **ID**: `999999999`
  - **Username**: `eatfit24_debug`
  - **Имя**: `Debug User`

### API-заголовки

При Browser Debug Mode отправляются специальные заголовки:

```
X-Debug-Mode: true
X-Debug-User-Id: 999999999
X-Telegram-ID: 999999999
X-Telegram-First-Name: Debug
X-Telegram-Username: eatfit24_debug
```

Backend должен распознать заголовок `X-Debug-Mode: true` и использовать debug-пользователя.

### UI-индикация

При включенном Browser Debug Mode отображается красный баннер вверху экрана:

```
⚠️ BROWSER DEBUG MODE • USER: eatfit24_debug • ID: 999999999
```

Это напоминание, что вы работаете в режиме отладки.

### Ограничения

1. **Платежи отключены** — кнопки оформления подписки PRO показывают сообщение "Платежи недоступны в режиме отладки браузера"
2. **Данные могут быть тестовыми** — в зависимости от настройки backend

## Как отключить Browser Debug Mode

1. Просто откройте приложение без параметра `?web_debug=1`
2. Или установите `VITE_WEB_DEBUG_ENABLED=false` в `.env.development`

## Логика определения режима

Режим активируется только если выполнены **все** условия:

1. `VITE_WEB_DEBUG_ENABLED === 'true'` в переменных окружения
2. В URL присутствует параметр `?web_debug=1` или `?debug=1`
3. Приложение **НЕ** запущено внутри Telegram (нет `window.Telegram?.WebApp?.initData`)

## Безопасность

- На продакшен-сборке **всегда** устанавливайте `VITE_WEB_DEBUG_ENABLED=false`
- Browser Debug Mode не работает, если приложение открыто в Telegram
- Режим предназначен **только** для разработчиков и тестирования

## Backend-интеграция

Backend должен обрабатывать заголовок `X-Debug-Mode: true`:

```python
# Пример Django middleware/authentication
def authenticate_debug_user(request):
    if request.headers.get('X-Debug-Mode') == 'true':
        debug_user_id = request.headers.get('X-Debug-User-Id')
        # Создать или получить debug-пользователя
        user, created = User.objects.get_or_create(
            telegram_id=debug_user_id,
            defaults={
                'username': 'eatfit24_debug',
                'first_name': 'Debug',
                'last_name': 'User'
            }
        )
        return user
    # Иначе обычная Telegram-авторизация
    return authenticate_telegram(request)
```

## Примеры использования

### Тестирование дневника питания

```
http://localhost:5173/app?web_debug=1&date=2025-12-06
```

### Тестирование анализа фото

1. Откройте `http://localhost:5173/app/log?web_debug=1`
2. Загрузите фото еды
3. Проверьте результаты анализа

### Тестирование профиля

```
http://localhost:5173/app/profile?web_debug=1
```

## Troubleshooting

### Проблема: "Откройте через Telegram" всё равно показывается

**Решение:**
- Проверьте, что `VITE_WEB_DEBUG_ENABLED=true` в `.env.development`
- Проверьте, что в URL есть `?web_debug=1`
- Перезапустите dev-сервер после изменения `.env`

### Проблема: Backend возвращает 401/403

**Решение:**
- Убедитесь, что backend поддерживает `X-Debug-Mode` заголовок
- Проверьте логи backend на наличие debug-user создания
- Проверьте, что backend получает правильные заголовки

### Проблема: Красный баннер не отображается

**Решение:**
- Проверьте, что `BrowserDebugBanner` импортирован в `ClientLayout.tsx`
- Убедитесь, что `isBrowserDebug` флаг установлен в `AuthContext`

## Файлы, модифицированные для поддержки Browser Debug Mode

1. `frontend/.env.development` — добавлена `VITE_WEB_DEBUG_ENABLED`
2. `frontend/.env.production` — `VITE_WEB_DEBUG_ENABLED=false`
3. `frontend/src/lib/telegram.ts` — логика определения режима, debug user, debug headers
4. `frontend/src/hooks/useTelegramWebApp.ts` — флаг `isBrowserDebug`
5. `frontend/src/contexts/AuthContext.tsx` — поддержка debug-пользователя
6. `frontend/src/pages/ClientDashboard.tsx` — пропуск заглушки в debug-режиме
7. `frontend/src/pages/FoodLogPage.tsx` — пропуск заглушки в debug-режиме
8. `frontend/src/pages/ProfilePage.tsx` — пропуск заглушки в debug-режиме
9. `frontend/src/pages/SubscriptionPage.tsx` — блокировка платежей в debug-режиме
10. `frontend/src/components/BrowserDebugBanner.tsx` — UI-индикация
11. `frontend/src/components/ClientLayout.tsx` — отображение баннера

---

**Авторы**: AntiGravity & Claude Code
**Дата**: Декабрь 2025

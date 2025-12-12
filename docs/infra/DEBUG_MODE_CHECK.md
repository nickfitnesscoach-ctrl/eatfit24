# Debug Mode Verification Guide

## Цель документа

Этот документ описывает процедуру проверки, что debug-режим работает **только в DEV-окружении** и **никогда не активируется на production**.

Debug-режим позволяет разработчикам тестировать приложение в обычном браузере (Chrome, Edge) без Telegram WebApp, но должен быть полностью отключён в production для безопасности.

---

## Архитектура Debug-режима

### Централизованная конфигурация

**Файл:** [`frontend/src/shared/config/debug.ts`](../../frontend/src/shared/config/debug.ts)

```typescript
export const IS_DEBUG = import.meta.env.DEV;
```

**Ключевые моменты:**
- `IS_DEBUG` зависит **только от** `import.meta.env.DEV` (встроенная переменная Vite)
- `import.meta.env.DEV = true` только при запуске `npm run dev`
- `import.meta.env.DEV = false` при production build (`npm run build`)
- **Нет жёстко закодированных** значений `true` или зависимости от env-переменных

### Telegram Integration

**Файл:** [`frontend/src/lib/telegram.ts`](../../frontend/src/lib/telegram.ts)

Debug-режим активируется только когда:
1. `IS_DEBUG === true` (DEV environment)
2. Telegram WebApp недоступен (обычный браузер)

**Debug-заголовки в `buildTelegramHeaders()`:**

```typescript
if (_isBrowserDebug) {
    return {
        'Content-Type': 'application/json',
        'X-Debug-Mode': 'true',                          // ← Маркер debug
        'X-Debug-User-Id': String(user.id),              // ← Debug user ID
        'X-Telegram-ID': String(user.id),                // ← Mock Telegram ID
        'X-Telegram-First-Name': '...',                  // ← Mock data
        'X-Telegram-Username': '...',                    // ← Mock data
    };
}
```

**Production заголовки** (без debug):

```typescript
return {
    'Content-Type': 'application/json',
    'X-Telegram-ID': String(user.id),                    // ← Real Telegram ID
    'X-Telegram-First-Name': '...',                      // ← Real data
    'X-Telegram-Username': '...',                        // ← Real data
    'X-Telegram-Init-Data': initData,                    // ← Real Telegram signature
};
```

### Защита платежей

**Файл:** [`frontend/src/hooks/useSubscriptionActions.ts`](../../frontend/src/hooks/useSubscriptionActions.ts:52-55)

```typescript
// Block payments in browser debug mode
if (isBrowserDebug || webAppBrowserDebug) {
    showToast('Платежи недоступны в режиме отладки браузера');
    return;
}
```

---

## Проверка #1: DEV-окружение

### Запуск DEV-сервера

```bash
cd frontend
npm run dev
```

### Проверка в браузере (вне Telegram)

1. Откройте `http://localhost:5173` в **Chrome/Edge** (НЕ в Telegram)

2. Откройте **DevTools → Network**

3. Выполните любой API-запрос (например, загрузите профиль)

4. **Проверьте заголовки запроса:**
   ```
   X-Debug-Mode: true           ← Должен присутствовать
   X-Debug-User-Id: 999999999   ← Debug user
   X-Telegram-ID: 999999999     ← Mock Telegram ID
   X-Telegram-First-Name: Debug
   X-Telegram-Username: eatfit24_debug
   ```

5. **Попробуйте оформить подписку:**
   - Должно появиться предупреждение: "Платежи недоступны в режиме отладки браузера"
   - Никакие платежи не должны проходить

### Проверка в консоли (опционально)

Можно временно добавить в [`frontend/src/App.tsx`](../../frontend/src/App.tsx) для проверки:

```typescript
import { getTelegramDebugInfo } from './lib/telegram';

useEffect(() => {
    console.log('Debug Info:', getTelegramDebugInfo());
}, []);
```

**Ожидаемый вывод:**

```javascript
{
    available: false,                // Telegram WebApp недоступен
    initialized: true,               // Telegram module инициализирован (в debug-режиме)
    browserDebugMode: true,          // ← Debug активен
    debugModeEnabled: true,          // ← IS_DEBUG = true
    shouldUseDebug: true,            // ← Debug должен быть использован
    initData: "debug_mode_init_data",
    user: { id: 999999999, ... }
}
```

**⚠️ ВАЖНО:** Удалите этот console.log после проверки!

---

## Проверка #2: Production Build (локально)

### Сборка production-версии

```bash
cd frontend
npm run build
```

### Проверка содержимого `.env.production`

```bash
cat .env.production
```

**Убедитесь, что НЕТ:**
- `VITE_DEBUG=true`
- `VITE_WEB_DEBUG_ENABLED=true`
- Любых других переменных, включающих debug

**Допустимо только:**
```env
VITE_API_URL=/api/v1
VITE_TELEGRAM_BOT_NAME=EatFit24_bot
VITE_WEBAPP_URL=https://t.me/EatFit24_bot/app
VITE_ENV=production
```

### Запуск preview

```bash
npm run preview
```

### Проверка в браузере

1. Откройте preview URL (обычно `http://localhost:4173`) в **Chrome/Edge**

2. Откройте **DevTools → Network**

3. Выполните любой API-запрос

4. **Проверьте заголовки запроса:**
   ```
   ✅ НЕТ X-Debug-Mode
   ✅ НЕТ X-Debug-User-Id
   ✅ Есть только реальные X-Telegram-* заголовки
   ```

5. **Если Telegram WebApp недоступен:**
   - Приложение должно показать экран "Откройте приложение через Telegram"
   - **НЕ должно** переключаться в debug-режим

### Проверка кода сборки (опционально)

```bash
# Проверка, что IS_DEBUG заменён на false в production build
grep -r "IS_DEBUG.*true" dist/ || echo "✅ No hardcoded IS_DEBUG=true found"
```

---

## Проверка #3: Production на сервере

### Подключение к production-серверу

```bash
ssh root@eatfit24.ru -p 22
cd /opt/EatFit24
```

### Проверка .env.production на сервере

```bash
cat frontend/.env.production
```

**Убедитесь:**
- Нет debug-переменных
- `VITE_ENV=production`

### Проверка Docker-образа

```bash
# Проверка текущего контейнера
docker ps | grep frontend

# Проверка переменных окружения в контейнере
docker exec eatfit24-frontend-1 cat /usr/share/nginx/html/app/assets/index-*.js | grep -o "IS_DEBUG.*true" || echo "✅ No IS_DEBUG=true in production bundle"
```

### Проверка в production через браузер

1. Откройте `https://eatfit24.ru/app` в **Chrome/Edge** (НЕ через Telegram)

2. Откройте **DevTools → Network**

3. Выполните любой API-запрос

4. **Проверьте заголовки:**
   ```
   ✅ НЕТ X-Debug-Mode
   ✅ НЕТ X-Debug-User-Id
   ✅ Есть только реальные X-Telegram-* (если открыто через Telegram)
   ```

5. **Проверка защиты:**
   - Приложение должно показать экран "Откройте через Telegram"
   - Debug-режим **не должен** активироваться ни при каких условиях

---

## Критерии успешной проверки

### ✅ DEV (localhost)

- [ ] `IS_DEBUG = true`
- [ ] Debug-заголовки (`X-Debug-Mode`) присутствуют в API-запросах
- [ ] Debug user (`999999999`) используется
- [ ] Платежи заблокированы с предупреждением
- [ ] Приложение работает в обычном браузере без Telegram

### ✅ Production Build

- [ ] `IS_DEBUG = false` (проверка через grep в dist/)
- [ ] `.env.production` не содержит debug-переменных
- [ ] Preview показывает экран "Откройте через Telegram" без debug
- [ ] Нет `X-Debug-Mode` в заголовках

### ✅ Production на сервере

- [ ] Docker-образ не содержит `IS_DEBUG=true` в бандле
- [ ] `.env.production` на сервере корректен
- [ ] Приложение требует открытие через Telegram
- [ ] Нет debug-заголовков в API-запросах
- [ ] Платежи работают только через Telegram WebApp

---

## Устранение проблем

### Проблема: Debug активен в production

**Симптомы:**
- `X-Debug-Mode: true` в production
- Платежи заблокированы на проде

**Решение:**

1. Проверьте [`frontend/src/shared/config/debug.ts`](../../frontend/src/shared/config/debug.ts:25):
   ```typescript
   // Должно быть:
   export const IS_DEBUG = import.meta.env.DEV;

   // НЕ должно быть:
   export const IS_DEBUG = true;
   ```

2. Проверьте `.env.production`:
   ```bash
   # Удалите любые debug-переменные:
   # VITE_DEBUG=...
   # VITE_WEB_DEBUG_ENABLED=...
   ```

3. Пересоберите с очисткой кеша:
   ```bash
   cd frontend
   rm -rf dist/ node_modules/.vite
   npm run build
   ```

4. Передеплойте на сервер:
   ```bash
   git add .
   git commit -m "fix: disable debug mode in production"
   git push origin main
   ```

### Проблема: Debug не работает в DEV

**Симптомы:**
- Нет `X-Debug-Mode` в localhost
- Требуется Telegram даже в DEV

**Решение:**

1. Проверьте, что используете `npm run dev` (НЕ `npm run build`)

2. Проверьте консоль браузера:
   ```javascript
   console.log(import.meta.env.DEV); // Должно быть true
   ```

3. Перезапустите dev-сервер:
   ```bash
   # Ctrl+C для остановки
   npm run dev
   ```

---

## Правила изменения debug-логики

1. **Никогда не изменяйте** `IS_DEBUG` на что-либо кроме `import.meta.env.DEV`

2. **Всегда проверяйте** `.env.production` перед коммитом:
   ```bash
   git diff frontend/.env.production
   ```

3. **Обязательно тестируйте** изменения по этому чеклисту:
   - [ ] DEV-режим работает (debug активен)
   - [ ] Production build (debug отключён)
   - [ ] Preview локально (debug отключён)

4. **Все новые фичи** с условной логикой по debug должны использовать:
   ```typescript
   import { IS_DEBUG } from '../shared/config/debug';

   if (IS_DEBUG) {
       // Debug-only logic
   }
   ```

5. **Для критичных операций** (платежи, данные) всегда проверяйте `isBrowserDebug`:
   ```typescript
   if (isBrowserDebug) {
       console.warn('Operation blocked in debug mode');
       return;
   }
   ```

---

## Последнее обновление

**Дата:** 2025-12-10
**Автор:** Audit и настройка debug-режима
**Статус:** ✅ Debug работает только в DEV, production защищён

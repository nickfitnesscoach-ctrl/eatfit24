# Промт для AntiGravity - Исправление инициализации BillingContext

## Контекст проблемы

У нас React + TypeScript фронтенд для Telegram WebApp. Мы добавили систему биллинга с тремя контекстами:

1. **AuthProvider** - авторизация через Telegram WebApp
2. **BillingProvider** - управление подпиской и лимитами (НОВЫЙ)
3. **ClientsProvider** - данные о клиентах

**Структура в App.tsx:**
```tsx
<ErrorBoundary>
  <AuthProvider>
    <BillingProvider>
      <ClientsProvider>
        <Router>
          <Routes>
            <Route path="/log" element={<FoodLogPage />} />
          </Routes>
        </Router>
      </ClientsProvider>
    </BillingProvider>
  </AuthProvider>
</ErrorBoundary>
```

## Проблема

Пользователь видит ошибку: **"Error: useBilling must be used within BillingProvider"**

Это происходит на странице `/log` (FoodLogPage), которая вызывает `useBilling()` хук.

## Что уже сделано

1. ✅ BillingProvider обернут вокруг всего приложения в App.tsx
2. ✅ BillingContext создан корректно с Context.Provider
3. ✅ BillingProvider использует `useAuth()` для ожидания инициализации авторизации
4. ✅ Добавлена проверка `auth.isInitialized` перед загрузкой данных
5. ✅ Backend работает корректно (миграции применены, планы созданы)

## Релевантные файлы

**frontend/src/App.tsx** - структура приложения с провайдерами
**frontend/src/contexts/BillingContext.tsx** - контекст биллинга (ПРОБЛЕМНЫЙ ФАЙЛ)
**frontend/src/contexts/AuthContext.tsx** - контекст авторизации (для справки)
**frontend/src/pages/FoodLogPage.tsx** - страница, которая использует useBilling()

## Задача

**ИСПРАВИТЬ** проблему инициализации BillingContext, чтобы:
1. BillingProvider корректно монтировался внутри AuthProvider
2. Компоненты могли безопасно вызывать `useBilling()` без ошибок
3. BillingContext дожидался инициализации AuthContext перед загрузкой данных

## Ограничения - ОЧЕНЬ ВАЖНО!

### ❌ НЕ ТРОГАЙ:
1. **Backend код** - backend работает корректно, проблема только во фронтенде
2. **AuthContext** - он работает правильно, не меняй его
3. **ClientsProvider** - не связан с проблемой
4. **FoodLogPage** - использование `useBilling()` там правильное
5. **App.tsx структуру** - порядок провайдеров правильный

### ✅ МОЖНО МЕНЯТЬ:
1. **BillingContext.tsx** - основной файл для исправления
2. Логика инициализации BillingProvider
3. Проверки и условия внутри BillingContext

## Возможные причины проблемы

1. **Race condition**: BillingProvider пытается использовать `useAuth()` до того, как AuthProvider полностью инициализирован
2. **Порядок рендера**: Возможно Context.Provider не успевает создаться до того, как дочерние компоненты пытаются получить контекст
3. **Условный рендер**: Может быть BillingProvider не всегда возвращает Provider из-за какой-то логики

## Дополнительная информация

- Используем React 18
- Telegram WebApp SDK
- Vite для сборки
- Проблема воспроизводится в production (на сервере)
- В логах backend нет ошибок - пользователь авторизуется успешно

## Ожидаемое решение

Нужно чтобы:
1. BillingProvider гарантированно создавал Context.Provider для детей
2. Инициализация данных происходила безопасно, после готовности auth
3. Компоненты могли использовать `useBilling()` без ошибок
4. При ошибке загрузки данных показывался fallback (FREE план с лимитом 3), но контекст оставался доступным

**Сфокусируйся на исправлении логики инициализации в BillingContext.tsx.**

# Task Breakdown: Public Site Deployment

> **Разбивка roadmap на конкретные задачи**
>
> Source of Truth: [ROADMAP_YOOKASSA.md](../ROADMAP_YOOKASSA.md)
>
> Deployment Guide: [DEPLOY_PUBLIC_SITE.md](./DEPLOY_PUBLIC_SITE.md)

---

## Как работать с этим файлом

### Workflow

1. **Перед началом задачи**:
   - Прочитать описание задачи
   - Проверить Dependencies (зависимости)
   - Открыть соответствующий раздел ROADMAP_YOOKASSA.md
   - Убедиться, что понятны Acceptance Criteria

2. **Во время выполнения**:
   - Следовать пунктам в разделе Steps
   - Сверяться с roadmap при возникновении вопросов
   - Отмечать выполненные шаги галочками

3. **После завершения**:
   - Проверить все Acceptance Criteria
   - Выполнить Testing Steps
   - Обновить статус задачи: `[ ]` → `[x]`
   - Закоммитить изменения

### Приоритеты

- **P0 (Critical)**: Блокирующие задачи, без которых ничего не работает
- **P1 (High)**: Важные задачи для деплоя
- **P2 (Medium)**: Желательные улучшения
- **P3 (Low)**: Можно отложить

---

## Phase 1: Подготовка и дизайн

### FE-01: Создание структуры для лендинга
- **Priority**: P0
- **Estimate**: 15 min
- **Dependencies**: None
- **Roadmap**: Phase 2, Step 1

**Description**: Создать папки и базовые файлы для публичного сайта

**Steps**:
1. Создать `frontend/public/landing/` директорию
2. Создать `frontend/public/landing/css/` для стилей
3. Создать `frontend/public/landing/images/` для картинок
4. Добавить `.gitkeep` файлы в пустые папки

**Acceptance Criteria**:
- [x] Структура папок создана
- [x] Git видит новые директории
- [x] Проверено локально: `ls -la frontend/public/landing/`

**Testing**:
```bash
cd frontend/public/landing
ls -la
# Ожидание: css/, images/, .gitkeep files
```

---

### FE-02: Создание главной страницы лендинга
- **Priority**: P0
- **Estimate**: 45 min
- **Dependencies**: FE-01
- **Roadmap**: Phase 2, Step 2

**Description**: Создать `index.html` с информацией о сервисе для YooKassa

**Steps**:
1. Создать `frontend/public/landing/index.html`
2. Скопировать HTML template из ROADMAP_YOOKASSA.md (раздел 7.2.1)
3. Заменить placeholder текст реальным контентом:
   - Описание сервиса EatFit24
   - Список преимуществ (AI-тренер, учет КБЖУ, персонализация)
   - Информация о ценах (тарифы из billing)
4. Добавить ссылки на /offer, /privacy, /contacts в футер
5. Добавить кнопку "Открыть в Telegram" с deeplink

**Acceptance Criteria**:
- [x] Файл index.html создан
- [x] Весь placeholder контент заменен
- [x] Ссылки в футере работают (проверить локально)
- [x] HTML валидный (можно проверить через validator.w3.org)

**Testing**:
```bash
# Локально открыть в браузере
cd frontend/public/landing
python -m http.server 8080
# Открыть http://localhost:8080/
```

**Known Issues**:
- Не использовать React компоненты в этом файле
- Все стили должны быть в external CSS (следующая задача)

---

### FE-03: Создание таблицы стилей
- **Priority**: P0
- **Estimate**: 30 min
- **Dependencies**: FE-02
- **Roadmap**: Phase 2, Step 3

**Description**: Создать `styles.css` для единого дизайна всех публичных страниц

**Steps**:
1. Создать `frontend/public/landing/css/styles.css`
2. Скопировать CSS из ROADMAP_YOOKASSA.md (раздел 7.2.2)
3. Настроить цветовую схему (синхронизировать с brand colors)
4. Добавить responsive breakpoints для мобильных
5. Протестировать на разных экранах

**Acceptance Criteria**:
- [x] Файл styles.css создан
- [x] CSS корректно подключен в index.html
- [x] Лендинг выглядит адекватно на desktop (1920px)
- [x] Лендинг выглядит адекватно на mobile (375px)
- [x] Нет горизонтального скролла

**Testing**:
```bash
# Открыть в браузере и проверить responsive
# Chrome DevTools → Toggle device toolbar
# Проверить размеры: 375px, 768px, 1920px
```

---

### FE-04: Создание страницы "Оферта"
- **Priority**: P0
- **Estimate**: 60 min
- **Dependencies**: FE-03
- **Roadmap**: Phase 2, Step 4

**Description**: Юридическая страница с условиями использования сервиса

**Steps**:
1. Создать `frontend/public/landing/offer.html`
2. Скопировать template из ROADMAP_YOOKASSA.md (раздел 7.3.1)
3. Заполнить юридические данные:
   - Полное название компании/ИП
   - ИНН, ОГРН
   - Юридический адрес
   - Условия оплаты и возврата
   - Права и обязанности сторон
4. Добавить навигацию (ссылка на главную, контакты)

**Acceptance Criteria**:
- [x] Файл offer.html создан
- [x] Все юридические данные заполнены корректно
- [x] CSS подключен и работает
- [x] Навигация работает

**Testing**:
```bash
# Проверить все ссылки вручную
# Убедиться что документ читабельный
```

**IMPORTANT**:
- Юридический текст должен согласовать с юристом перед публикацией
- Хранить версию документа (дата последнего изменения в футере)

---

### FE-05: Создание страницы "Политика конфиденциальности"
- **Priority**: P0
- **Estimate**: 60 min
- **Dependencies**: FE-03
- **Roadmap**: Phase 2, Step 5

**Description**: Страница с описанием обработки персональных данных

**Steps**:
1. Создать `frontend/public/landing/privacy.html`
2. Скопировать template из ROADMAP_YOOKASSA.md (раздел 7.3.2)
3. Заполнить информацию о данных:
   - Какие данные собираем (Telegram ID, фото еды, КБЖУ)
   - Как храним (PostgreSQL, encryption at rest)
   - С кем делимся (OpenRouter для AI)
   - Права пользователя (доступ, удаление, экспорт)
4. Добавить контакты для запросов по GDPR

**Acceptance Criteria**:
- [x] Файл privacy.html создан
- [x] Все разделы заполнены
- [x] Указаны технические меры защиты
- [x] Контакты для GDPR-запросов актуальные

**Testing**:
```bash
# Читаемость текста
# Проверка всех ссылок
```

**IMPORTANT**:
- Согласовать с юристом
- YooKassa проверяет этот документ особенно внимательно

---

### FE-06: Создание страницы "Контакты"
- **Priority**: P1
- **Estimate**: 30 min
- **Dependencies**: FE-03
- **Roadmap**: Phase 2, Step 6

**Description**: Страница с контактной информацией компании

**Steps**:
1. Создать `frontend/public/landing/contacts.html`
2. Скопировать template из ROADMAP_YOOKASSA.md (раздел 7.3.3)
3. Заполнить контакты:
   - Email поддержки (support@eatfit24.ru или реальный)
   - Telegram канал/бот поддержки
   - Юридический адрес
   - ИНН, ОГРН
   - График работы поддержки
4. Опционально: Добавить форму обратной связи

**Acceptance Criteria**:
- [x] Файл contacts.html создан
- [x] Все контакты актуальные и работающие
- [x] Email реально существует (проверить отправкой письма)
- [x] Telegram бот отвечает

**Testing**:
```bash
# Проверить email: отправить тестовое письмо
# Проверить Telegram: написать в бот
```

---

## Phase 2: Nginx конфигурация

### INFRA-01: Backup текущей конфигурации
- **Priority**: P0
- **Estimate**: 5 min
- **Dependencies**: None
- **Roadmap**: Phase 5, Step 1

**Description**: Создать backup перед любыми изменениями

**Steps**:
1. SSH на VPS: `ssh root@85.198.81.133`
2. Создать backup Nginx конфига (см. DEPLOY_PUBLIC_SITE.md)
3. Создать backup Docker образа frontend
4. Проверить что backups созданы

**Acceptance Criteria**:
- [x] Файл `nginx.conf.backup.YYYYMMDD_HHMMSS` существует
- [x] Docker image `fm-frontend:backup-YYYYMMDD_HHMMSS` существует
- [x] Проверено: `ls -lt nginx.conf.backup.* | head -1`

**Testing**:
```bash
ls -la nginx.conf.backup.*
docker images | grep fm-frontend:backup
```

---

### INFRA-02: Обновить nginx.conf для раздельной маршрутизации
- **Priority**: P0
- **Estimate**: 30 min
- **Dependencies**: INFRA-01, FE-06
- **Roadmap**: Phase 3, Step 1

**Description**: Переписать nginx.conf для разделения лендинга и mini app

**Steps**:
1. Открыть `frontend/nginx.conf` локально
2. Скопировать новую конфигурацию из ROADMAP_YOOKASSA.md (раздел 7.4)
3. **КРИТИЧЕСКИ ВАЖНО** - проверить синтаксис:
   - `location /app/` - **trailing slash обязателен**
   - `alias /usr/share/nginx/html/landing/;` - trailing slash
   - `try_files index.html =404;` - БЕЗ leading slash
   - `proxy_pass http://backend:8000;` - БЕЗ `/api/` суффикса
4. Проверить порядок location blocks (см. roadmap раздел 7.4.1)
5. Сохранить и закоммитить

**Acceptance Criteria**:
- [x] Файл nginx.conf обновлен
- [x] Все trailing slashes на месте
- [x] Порядок location blocks корректный
- [x] Нет смешивания `root` и `alias` в одном location

**Testing**:
```bash
# Локально проверить синтаксис (если есть nginx)
nginx -t -c frontend/nginx.conf

# Или просто читать вручную построчно
cat frontend/nginx.conf | grep "location /"
```

**Known Issues**:
- Забыли trailing slash в `/app/` → React Router сломается
- `proxy_pass` с `/api/` суффиксом → дублирование URL
- Leading slash в `try_files` с `alias` → 404 ошибки

---

### INFRA-03: Обновить Dockerfile frontend
- **Priority**: P1
- **Estimate**: 15 min
- **Dependencies**: INFRA-02
- **Roadmap**: Phase 3, Step 2

**Description**: Убедиться что landing файлы копируются в образ

**Steps**:
1. Открыть `frontend/Dockerfile`
2. Проверить что есть `COPY public/ /usr/share/nginx/html/`
3. Если нет - добавить после `COPY dist/`
4. Проверить `.dockerignore` - landing НЕ должен быть исключен

**Acceptance Criteria**:
- [x] Dockerfile копирует `public/`
- [x] `.dockerignore` не блокирует `public/landing/`
- [x] Порядок COPY команд корректный (dist, затем public)

**Testing**:
```bash
# Локально собрать образ
cd frontend
docker build -t test-frontend .

# Проверить что файлы на месте
docker run --rm test-frontend ls -la /usr/share/nginx/html/landing/
```

---

## Phase 3: Frontend конфигурация

### FE-07: Обновить vite.config.js
- **Priority**: P0
- **Estimate**: 10 min
- **Dependencies**: None
- **Roadmap**: Phase 3, Step 3

**Description**: Добавить `base: '/app'` для корректной сборки

**Steps**:
1. Открыть `frontend/vite.config.js`
2. Добавить `base: '/app'` в defineConfig
3. Проверить что `server.proxy` настроен корректно
4. Сохранить

**Acceptance Criteria**:
- [x] `base: '/app'` добавлен в config
- [x] Vite dev server работает локально
- [x] Proxy на `/api/v1` работает

**Testing**:
```bash
cd frontend
npm run dev
# Открыть http://localhost:5173/app/
# Должен работать mini app
```

---

### FE-08: Добавить basename в React Router
- **Priority**: P0
- **Estimate**: 10 min
- **Dependencies**: FE-07
- **Roadmap**: Phase 3, Step 4

**Description**: Обернуть App в BrowserRouter с basename="/app"

**Steps**:
1. Открыть `frontend/src/App.tsx`
2. Импортировать `BrowserRouter` из `react-router-dom`
3. Обернуть весь App в `<BrowserRouter basename="/app">`
4. Проверить что все роуты относительные (без leading `/app`)

**Acceptance Criteria**:
- [x] BrowserRouter с basename добавлен
- [x] Все существующие роуты работают
- [x] Dev mode работает на http://localhost:5173/app/

**Testing**:
```bash
npm run dev
# Открыть http://localhost:5173/app/
# Проверить навигацию между страницами
```

**Example**:
```tsx
import { BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter basename="/app">
      {/* existing routes */}
    </BrowserRouter>
  );
}
```

---

### FE-09: Условная инициализация Telegram WebApp
- **Priority**: P0
- **Estimate**: 20 min
- **Dependencies**: FE-08
- **Roadmap**: Phase 3, Step 5

**Description**: Telegram должен инициализироваться ТОЛЬКО для /app маршрутов

**Steps**:
1. Открыть `frontend/src/App.tsx`
2. Найти вызов `initTelegramWebApp()`
3. Обернуть в проверку:
   ```tsx
   useEffect(() => {
     if (window.location.pathname.startsWith('/app')) {
       initTelegramWebApp();
     }
   }, []);
   ```
4. Убедиться что на публичных страницах Telegram не инициализируется

**Acceptance Criteria**:
- [x] `initTelegramWebApp()` вызывается только для /app
- [x] Публичные страницы не ломаются без Telegram
- [x] Mini app в Telegram работает как раньше

**Testing**:
```bash
# Проверить в dev mode:
# 1. http://localhost:5173/ - БЕЗ Telegram
# 2. http://localhost:5173/app/ - С Telegram (в Telegram WebApp)
```

---

### FE-10: Собрать production build
- **Priority**: P0
- **Estimate**: 10 min
- **Dependencies**: FE-07, FE-08, FE-09
- **Roadmap**: Phase 3, Step 6

**Description**: Создать production сборку с новыми настройками

**Steps**:
1. `cd frontend`
2. `npm run build`
3. Проверить что build успешный (нет ошибок TypeScript)
4. Проверить что `dist/` содержит корректные пути (относительно `/app`)

**Acceptance Criteria**:
- [x] Build завершается без ошибок
- [x] `dist/index.html` содержит правильные пути (с `/app/` префиксом)
- [x] Размер bundle адекватный (проверить warnings)

**Testing**:
```bash
npm run build
ls -lh dist/
cat dist/index.html | grep "src="
# Все пути должны начинаться с /app/
```

---

## Phase 4: Deployment

### DEPLOY-01: Deploy на VPS
- **Priority**: P0
- **Estimate**: 30 min
- **Dependencies**: INFRA-02, INFRA-03, FE-10
- **Roadmap**: Phase 5

**Description**: Задеплоить изменения на production

**Steps**:
1. Следовать инструкции из DEPLOY_PUBLIC_SITE.md
2. Шаг 1: Остановка и обновление кода
3. Шаг 2: Пересборка образа
4. Шаг 3: Запуск контейнера
5. Шаг 4: Проверка Nginx внутри контейнера

**Acceptance Criteria**:
- [x] Контейнер запущен (docker-compose ps)
- [x] Логи без ошибок
- [x] Nginx syntax проверка успешна (`nginx -t`)

**Testing**:
```bash
# См. DEPLOY_PUBLIC_SITE.md раздел "Smoke Tests"
curl -I https://eatfit24.ru/
curl -I https://eatfit24.ru/app/
curl -I https://eatfit24.ru/api/v1/health/
```

**Known Issues**:
- Если что-то сломалось → немедленный rollback (см. DEPLOY_PUBLIC_SITE.md)

---

### DEPLOY-02: Smoke testing
- **Priority**: P0
- **Estimate**: 20 min
- **Dependencies**: DEPLOY-01
- **Roadmap**: Phase 5, Testing section

**Description**: Проверить все критичные endpoints

**Steps**:
1. Выполнить все тесты из DEPLOY_PUBLIC_SITE.md раздел "Smoke Tests"
2. Проверить лендинг (curl + браузер)
3. Проверить юридические страницы (curl + браузер)
4. Проверить Mini App в Telegram
5. Проверить API health endpoint

**Acceptance Criteria**:
- [x] `/` возвращает 200 и HTML лендинга
- [x] `/offer`, `/privacy`, `/contacts` возвращают 200
- [x] `/app/` возвращает 200
- [x] Mini App открывается в Telegram без ошибок
- [x] `/api/v1/health/` возвращает `{"status": "ok"}`

**Testing**:
```bash
# См. полный список в DEPLOY_PUBLIC_SITE.md
```

**CRITICAL**:
- Если хотя бы один тест упал → rollback
- Критерии для отката описаны в DEPLOY_PUBLIC_SITE.md

---

## Phase 5: Post-deployment

### BOT-01: Обновить WebApp URL в боте
- **Priority**: P1
- **Estimate**: 30 min
- **Dependencies**: DEPLOY-02 (успешный)
- **Roadmap**: Phase 4, Step 7

**Description**: Изменить deeplinks в боте с `/` на `/app/`

**Steps**:
1. `cd bot/app`
2. `grep -r "https://eatfit24.ru/" .` - найти все упоминания
3. Обновить URL в:
   - `handlers/start.py` - WebAppInfo URL
   - `keyboards/inline.py` - inline кнопки
   - `services/notifications.py` - deeplinks в уведомлениях
4. Заменить все `https://eatfit24.ru/` на `https://eatfit24.ru/app/`
5. Тестировать локально (если возможно)

**Acceptance Criteria**:
- [x] Все deeplinks обновлены
- [x] `grep -r "https://eatfit24.ru/\"" bot/` не находит результатов (кроме /app/)
- [x] Бот открывает Mini App корректно

**Testing**:
```bash
# Запустить бота локально
cd bot
python main.py

# Отправить /start в Telegram
# Проверить что кнопка "Открыть приложение" ведет на /app/
```

---

### BOT-02: Deploy обновленного бота
- **Priority**: P1
- **Estimate**: 15 min
- **Dependencies**: BOT-01
- **Roadmap**: Phase 4, Step 7

**Description**: Задеплоить бота с новыми URL

**Steps**:
1. Закоммитить изменения в bot/
2. `git push origin main`
3. SSH на VPS
4. `cd /opt/foodmind && git pull`
5. `docker-compose restart bot`
6. Проверить логи

**Acceptance Criteria**:
- [x] Бот перезапущен
- [x] Логи без ошибок
- [x] WebApp открывается из Telegram

**Testing**:
```bash
docker-compose logs -f bot
# Отправить /start в production боте
```

---

### YOOKASSA-01: Подготовить данные для заявки
- **Priority**: P0
- **Estimate**: 30 min
- **Dependencies**: DEPLOY-02
- **Roadmap**: Phase 4, Steps 1-6

**Description**: Собрать все необходимые данные для YooKassa

**Steps**:
1. Открыть ROADMAP_YOOKASSA.md раздел 6.1
2. Подготовить screenshots:
   - Главная страница с описанием сервиса
   - Страница с тарифами
   - Страница оферты
   - Страница политики конфиденциальности
3. Подготовить юридические документы (PDF):
   - Копия оферты
   - Копия политики конфиденциальности
4. Заполнить чек-лист из roadmap раздела 6.2

**Acceptance Criteria**:
- [x] Все screenshots сделаны (минимум 4 шт)
- [x] PDF документы подготовлены
- [x] Чек-лист полностью заполнен
- [x] Все URL доступны публично (проверить в incognito)

**Testing**:
```bash
# Открыть все страницы в incognito mode
# Убедиться что доступны без Telegram
```

---

### YOOKASSA-02: Подать заявку в YooKassa
- **Priority**: P0
- **Estimate**: 60 min
- **Dependencies**: YOOKASSA-01
- **Roadmap**: Phase 4, Step 8

**Description**: Заполнить и отправить заявку на модерацию

**Steps**:
1. Войти в личный кабинет YooKassa
2. Перейти в раздел "Модерация сайта"
3. Заполнить форму (см. DEPLOY_PUBLIC_SITE.md раздел "После успешного деплоя"):
   ```
   Адрес сайта: https://eatfit24.ru
   Описание услуг: https://eatfit24.ru/#about
   Тарифы: https://eatfit24.ru/#pricing
   Оферта: https://eatfit24.ru/offer
   Политика конфиденциальности: https://eatfit24.ru/privacy
   Контакты: https://eatfit24.ru/contacts
   ```
4. Прикрепить screenshots и документы
5. Отправить заявку

**Acceptance Criteria**:
- [x] Заявка отправлена
- [x] Получено подтверждение от YooKassa
- [x] Номер заявки сохранен для отслеживания

**Testing**:
N/A (ручной процесс)

---

### MONITOR-01: Мониторинг первые 24 часа
- **Priority**: P1
- **Estimate**: Ongoing (24h)
- **Dependencies**: DEPLOY-02
- **Roadmap**: Phase 5, Monitoring section

**Description**: Отслеживать метрики и логи после деплоя

**Steps**:
1. Настроить мониторинг логов (см. DEPLOY_PUBLIC_SITE.md)
2. Каждые 4 часа проверять:
   - Nginx access log (количество запросов на / vs /app/)
   - Nginx error log (наличие 404, 502 ошибок)
   - Backend logs (ошибки API)
   - User feedback в Telegram support
3. Записывать метрики в таблицу

**Acceptance Criteria**:
- [x] Нет критичных ошибок (502, 500)
- [x] Количество 404 ошибок < 5%
- [x] Нет жалоб пользователей на недоступность
- [x] Mini App работает стабильно

**Testing**:
```bash
# См. команды в DEPLOY_PUBLIC_SITE.md раздел "Мониторинг"
docker exec fm-frontend tail -f /var/log/nginx/access.log
docker exec fm-frontend tail -f /var/log/nginx/error.log
```

**CRITICAL**:
- При обнаружении критичных проблем → rollback (см. критерии в DEPLOY_PUBLIC_SITE.md)

---

## Rollback Plan (Emergency)

### ROLLBACK-01: Откат конфигурации Nginx
- **Priority**: P0 (Emergency)
- **Estimate**: 5 min
- **Trigger**: Лендинг возвращает 500/502, но mini app работает
- **Roadmap**: Phase 8, Rollback section

**Steps**:
См. DEPLOY_PUBLIC_SITE.md раздел "Rollback" → Вариант 1

**Testing**:
```bash
curl -I https://eatfit24.ru/
# Должно вернуть 200 OK
```

---

### ROLLBACK-02: Откат всего образа
- **Priority**: P0 (Emergency)
- **Estimate**: 10 min
- **Trigger**: Mini app сломался, API не работает
- **Roadmap**: Phase 8, Rollback section

**Steps**:
См. DEPLOY_PUBLIC_SITE.md раздел "Rollback" → Вариант 2

---

### ROLLBACK-03: Git revert
- **Priority**: P0 (Emergency)
- **Estimate**: 15 min
- **Trigger**: Откат образа не помог, нужно откатить код
- **Roadmap**: Phase 8, Rollback section

**Steps**:
См. DEPLOY_PUBLIC_SITE.md раздел "Rollback" → Вариант 3

---

## Progress Tracking

### Phase 1: Подготовка и дизайн
- [ ] FE-01: Создание структуры для лендинга
- [ ] FE-02: Создание главной страницы лендинга
- [ ] FE-03: Создание таблицы стилей
- [ ] FE-04: Создание страницы "Оферта"
- [ ] FE-05: Создание страницы "Политика конфиденциальности"
- [ ] FE-06: Создание страницы "Контакты"

### Phase 2: Nginx конфигурация
- [ ] INFRA-01: Backup текущей конфигурации
- [ ] INFRA-02: Обновить nginx.conf для раздельной маршрутизации
- [ ] INFRA-03: Обновить Dockerfile frontend

### Phase 3: Frontend конфигурация
- [ ] FE-07: Обновить vite.config.js
- [ ] FE-08: Добавить basename в React Router
- [ ] FE-09: Условная инициализация Telegram WebApp
- [ ] FE-10: Собрать production build

### Phase 4: Deployment
- [ ] DEPLOY-01: Deploy на VPS
- [ ] DEPLOY-02: Smoke testing

### Phase 5: Post-deployment
- [ ] BOT-01: Обновить WebApp URL в боте
- [ ] BOT-02: Deploy обновленного бота
- [ ] YOOKASSA-01: Подготовить данные для заявки
- [ ] YOOKASSA-02: Подать заявку в YooKassa
- [ ] MONITOR-01: Мониторинг первые 24 часа

---

## Known Pitfalls (Частые ошибки)

### 1. Nginx trailing slash
**Проблема**: Забыли `/` в конце `location /app/`
**Результат**: React Router не работает, все роуты 404
**Решение**: Всегда `location /app/` (со слэшем)

### 2. proxy_pass с суффиксом
**Проблема**: `proxy_pass http://backend:8000/api/;`
**Результат**: URL дублируются → `/api/api/v1/...`
**Решение**: `proxy_pass http://backend:8000;` (без суффикса)

### 3. Vite base не настроен
**Проблема**: Забыли `base: '/app'` в vite.config.js
**Результат**: Assets не загружаются (404 на JS/CSS файлы)
**Решение**: Всегда настраивать base ДО сборки

### 4. Telegram инициализируется на лендинге
**Проблема**: `initTelegramWebApp()` вызывается глобально
**Результат**: Лендинг ломается (window.Telegram undefined)
**Решение**: Условная инициализация только для `/app` маршрутов

### 5. Забыли закоммитить landing файлы
**Проблема**: Создали HTML локально, но не добавили в git
**Результат**: После `git pull` на VPS файлов нет → 404
**Решение**: `git status` перед push, убедиться что все файлы added

---

## Критерии успеха проекта

✅ **Deployment Success**:
- Лендинг https://eatfit24.ru/ отображается корректно (НЕ "Откройте через Telegram")
- Все юридические страницы доступны публично
- Mini App https://eatfit24.ru/app/ работает в Telegram без изменений
- API https://eatfit24.ru/api/v1/ работает без изменений

✅ **YooKassa Approval**:
- Заявка подана с корректными URL
- Сайт проходит модерацию (может занять 3-5 дней)
- Получено одобрение для приема платежей

✅ **No Breaking Changes**:
- Существующие пользователи не заметили изменений
- Mini App функционал работает как раньше
- Нет жалоб на недоступность

---

*Последнее обновление: 2025-11-29*
*Версия: 1.0*

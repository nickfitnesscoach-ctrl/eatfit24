# Runbook: Деплой публичного сайта и разделения с Mini App

> **⚠️ БОЕВОЙ ЧЕК-ЛИСТ** — используется непосредственно при деплое
>
> Полная документация: [ROADMAP_YOOKASSA.md](../ROADMAP_YOOKASSA.md)

---

## 🔒 Перед деплоем (обязательно!)

### 1. Backup

```bash
ssh root@85.198.81.133
cd /opt/foodmind

# Backup Nginx конфига
docker exec fm-frontend cat /etc/nginx/conf.d/default.conf > nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# Backup Docker образа
docker commit fm-frontend fm-frontend:backup-$(date +%Y%m%d_%H%M%S)
```

### 2. Проверка файлов на VPS

```bash
# Убедиться, что новые файлы есть
ls -la frontend/public/landing/
# Должно быть: index.html, offer.html, privacy.html, contacts.html, css/, images/

# Проверить nginx.conf локально
cat frontend/nginx.conf | grep "location /app/"
# Должен быть trailing slash: location /app/
```

---

## 🚀 Деплой (пошаговая инструкция)

### Шаг 1: Остановка и обновление кода

```bash
ssh root@85.198.81.133
cd /opt/foodmind

# Остановить frontend
docker-compose stop frontend

# Обновить код
git pull origin main

# Проверить, что всё на месте
ls frontend/public/landing/
```

### Шаг 2: Пересборка образа

```bash
# Пересобрать frontend (с новым nginx.conf и landing)
docker-compose build --no-cache frontend

# Проверить, что образ собрался
docker images | grep fm-frontend
```

### Шаг 3: Запуск контейнера

```bash
# Запустить обновлённый контейнер
docker-compose up -d frontend

# Проверить статус
docker-compose ps frontend
# Должно быть: State = Up

# Проверить логи (без ошибок)
docker-compose logs --tail=50 frontend
```

### Шаг 4: Проверка Nginx внутри контейнера

```bash
# Зайти в контейнер
docker exec -it fm-frontend sh

# Проверить файлы
ls -la /usr/share/nginx/html/ | head -20
# Ожидание: index.html, assets/, landing/

ls -la /usr/share/nginx/html/landing/
# Ожидание: index.html, offer.html, privacy.html, contacts.html, css/

# Проверить синтаксис Nginx
nginx -t
# Ожидание: syntax is ok, test is successful

exit
```

---

## ✅ Smoke Tests (обязательная проверка)

### 1. Публичный лендинг

```bash
curl -I https://eatfit24.ru/
# Ожидание: HTTP/1.1 200 OK (НЕ 404, НЕ 502)

curl https://eatfit24.ru/ | grep "EatFit24"
# Ожидание: найдено в HTML
```

### 2. Юридические страницы

```bash
curl -I https://eatfit24.ru/offer
# Ожидание: HTTP/1.1 200 OK

curl -I https://eatfit24.ru/privacy
# Ожидание: HTTP/1.1 200 OK

curl -I https://eatfit24.ru/contacts
# Ожидание: HTTP/1.1 200 OK
```

### 3. Mini App

```bash
curl -I https://eatfit24.ru/app
# Ожидание: HTTP/1.1 301 (редирект на /app/)

curl -I https://eatfit24.ru/app/
# Ожидание: HTTP/1.1 200 OK

curl https://eatfit24.ru/app/ | grep "EATFIT_FRONT_VERSION"
# Ожидание: найдено в HTML
```

### 4. API

```bash
curl -I https://eatfit24.ru/api/v1/health/
# Ожидание: HTTP/1.1 200 OK

curl https://eatfit24.ru/api/v1/health/
# Ожидание: {"status": "ok"}
```

### 5. Открыть в браузере (вручную)

- ✅ `https://eatfit24.ru/` → отображается лендинг (НЕ "Откройте через Telegram")
- ✅ `https://eatfit24.ru/offer` → отображается оферта
- ✅ `https://eatfit24.ru/app/` → через Telegram WebApp работает

---

## 🔄 Rollback (если что-то пошло не так)

### Вариант 1: Вернуть только Nginx конфиг (быстрый)

```bash
# Найти последний backup
ls -lt nginx.conf.backup.* | head -1

# Восстановить конфиг
cat nginx.conf.backup.YYYYMMDD_HHMMSS | docker exec -i fm-frontend sh -c 'cat > /etc/nginx/conf.d/default.conf'

# Перезагрузить Nginx
docker exec fm-frontend nginx -s reload

# Проверить
curl -I https://eatfit24.ru/
```

### Вариант 2: Вернуть весь образ (полный откат)

```bash
# Найти последний backup образ
docker images | grep fm-frontend:backup

# Остановить и удалить текущий контейнер
docker-compose stop frontend
docker rm fm-frontend

# Запустить из backup
docker run -d --name fm-frontend \
  --network foodmind_backend-net \
  -p 3000:80 \
  fm-frontend:backup-YYYYMMDD_HHMMSS

# Проверить
curl -I https://eatfit24.ru/
```

### Вариант 3: Git revert (крайний случай)

```bash
cd /opt/foodmind

# Откат коммита
git log --oneline | head -5  # Найти хеш до изменений
git reset --hard <COMMIT_HASH>

# Пересборка
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

---

## 📊 Мониторинг после деплоя (первые 24 часа)

### Логи Nginx

```bash
# Access log (запросы на сайт)
docker exec fm-frontend tail -f /var/log/nginx/access.log

# Error log (ошибки)
docker exec fm-frontend tail -f /var/log/nginx/error.log
```

### Метрики для отслеживания

```bash
# Количество запросов на лендинг vs mini app
docker exec fm-frontend tail -200 /var/log/nginx/access.log | grep -E "GET / |GET /app/" | wc -l

# Ошибки 404
docker exec fm-frontend tail -200 /var/log/nginx/access.log | grep " 404 " | wc -l

# Ошибки 502
docker exec fm-frontend tail -200 /var/log/nginx/access.log | grep " 502 " | wc -l
```

### Backend логи

```bash
docker-compose logs -f backend | grep ERROR
```

---

## 🔴 Критерии для НЕМЕДЛЕННОГО отката

Откатывать изменения если:

- ❌ Лендинг возвращает 500 или 502
- ❌ Mini App не открывается в Telegram (белый экран)
- ❌ API возвращает 404 на `/api/v1/health/`
- ❌ Более 10% пользователей жалуются в support

**НЕ откатывать** если:

- ⚠️ Мелкие CSS-баги на лендинге (можно поправить горячим фиксом)
- ⚠️ Кеш браузера у пользователей (попросить Ctrl+F5)

---

## 📝 После успешного деплоя

### 1. Обновить Telegram Bot WebApp URL

```bash
cd /opt/foodmind/bot

# Найти все упоминания старого URL
grep -r "https://eatfit24.ru/" app/

# Заменить на /app/ (вручную или через sed)
# Потом:
git add bot/
git commit -m "Update WebApp URL to /app/"
docker-compose restart bot
```

### 2. Отправить уведомление пользователям

Через Telegram Bot:

> 🔄 Обновление приложения
>
> Мы обновили наш сервис! Теперь приложение открывается по новой ссылке.
>
> Если видите старую версию — нажмите Ctrl+F5 для обновления.

### 3. Отправить URL в YooKassa

При заполнении заявки указать:

```
Адрес сайта: https://eatfit24.ru
Описание услуг: https://eatfit24.ru/#about
Тарифы: https://eatfit24.ru/#pricing
Оферта: https://eatfit24.ru/offer
Политика конфиденциальности: https://eatfit24.ru/privacy
Контакты: https://eatfit24.ru/contacts
```

---

## 🐛 Известные грабли (Lessons Learned)

### Грабля 1: Кеш браузера

**Проблема:** Пользователи видят старую версию после деплоя

**Решение:**
- Vite автоматически добавляет хеши к JS/CSS
- Для HTML используем `Cache-Control: no-cache`
- Попросить пользователей Ctrl+F5

### Грабля 2: Забыли trailing slash в `/app/`

**Проблема:** React Router ломается, все роуты показывают 404

**Решение:**
- Всегда проверять `location /app/` (со слэшем!)
- Nginx редирект `/app` → `/app/`

### Грабля 3: `proxy_pass http://backend:8000/api/`

**Проблема:** Nginx дублирует `/api/` в URL → `/api/api/v1/...`

**Решение:**
- Правильно: `proxy_pass http://backend:8000;` (без `/api/`)

---

## 📞 Контакты для экстренной связи

- **DevOps/Backend:** [ВАШ КОНТАКТ]
- **Frontend:** [ВАШ КОНТАКТ]
- **VPS доступ:** root@85.198.81.133 (SSH key)

---

*Последнее обновление: 2025-11-29*
*Версия runbook: 1.0*

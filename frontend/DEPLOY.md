# 🚀 Деплой FoodMind AI Frontend через Docker

## Быстрый старт

### 1. Сборка Docker образа

```bash
cd d:/NICOLAS/1_PROJECTS/_IT_Projects/_25-20-11_FoodMind_Ai_Front
docker build -t foodmind-frontend .
```

### 2. Запуск контейнера

```bash
docker run -d -p 8080:80 --name foodmind_frontend foodmind-frontend
```

Или через docker-compose:

```bash
docker-compose up -d
```

### 3. Проверка

Откройте в браузере: `http://85.198.81.133:8080`

---

## Деплой на сервер

### Вариант 1: Через Docker Compose (рекомендуется)

1. Скопируйте файлы на сервер:
```bash
scp -r d:/NICOLAS/1_PROJECTS/_IT_Projects/_25-20-11_FoodMind_Ai_Front/* root@85.198.81.133:/opt/foodmind-frontend/
```

2. Подключитесь к серверу:
```bash
ssh root@85.198.81.133
```

3. Перейдите в директорию и запустите:
```bash
cd /opt/foodmind-frontend
docker-compose up -d --build
```

### Вариант 2: Через Docker напрямую

На сервере:
```bash
cd /opt/foodmind-frontend
docker build -t foodmind-frontend .
docker run -d -p 8080:80 --restart unless-stopped --name foodmind_frontend foodmind-frontend
```

---

## Обновление приложения

1. Остановите старый контейнер:
```bash
docker-compose down
# или
docker stop foodmind_frontend && docker rm foodmind_frontend
```

2. Пересоберите и запустите:
```bash
docker-compose up -d --build
# или
docker build -t foodmind-frontend . && docker run -d -p 8080:80 --restart unless-stopped --name foodmind_frontend foodmind-frontend
```

---

## Полезные команды

### Просмотр логов
```bash
docker logs -f foodmind_frontend
# или
docker-compose logs -f
```

### Остановка
```bash
docker stop foodmind_frontend
# или
docker-compose stop
```

### Перезапуск
```bash
docker restart foodmind_frontend
# или
docker-compose restart
```

### Удаление
```bash
docker stop foodmind_frontend && docker rm foodmind_frontend
# или
docker-compose down
```

---

## Настройка Bot для использования

После деплоя обновите `.env` бота:

```env
WEB_APP_URL=http://85.198.81.133:8080
```

**Важно:** Для Telegram Mini App нужен HTTPS. Варианты:

1. **Nginx reverse proxy с SSL** (рекомендуется)
2. **Cloudflare** (бесплатный SSL)
3. **Let's Encrypt** + Certbot

---

## Конфигурация портов

- Frontend: `8080` (можно изменить в docker-compose.yml)
- Django Backend: `8001` (уже запущен)

---

## Troubleshooting

### Контейнер не запускается
```bash
docker logs foodmind_frontend
```

### Порт занят
Измените порт в `docker-compose.yml`:
```yaml
ports:
  - "8081:80"  # Изменили с 8080 на 8081
```

### Нет подключения к API
Проверьте, что Django backend запущен:
```bash
curl http://85.198.81.133:8001/api/v1/telegram/applications/
```

---

Готово! После деплоя фронтенд будет доступен по адресу:
**http://85.198.81.133:8080**

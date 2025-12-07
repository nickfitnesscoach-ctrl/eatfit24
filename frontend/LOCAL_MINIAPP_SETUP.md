# Запуск проекта локально как Telegram Mini App

## Способ 1: Использование ngrok (рекомендуется)

### Установка ngrok
1. Скачайте ngrok с https://ngrok.com/download
2. Распакуйте и добавьте в PATH
3. Зарегистрируйтесь на ngrok.com и получите authtoken
4. Выполните: `ngrok config add-authtoken YOUR_TOKEN`

### Запуск

1. **Запустите backend** (в отдельном терминале):
```bash
cd backend
python manage.py runserver
```

2. **Запустите frontend** (в отдельном терминале):
```bash
cd frontend
npm run dev:host
```

3. **Запустите ngrok** (в третьем терминале):
```bash
ngrok http 5173
```

4. **Получите HTTPS URL**:
   - Ngrok покажет URL вида: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`
   - Скопируйте этот URL

5. **Настройте Telegram Bot**:
   - Откройте @BotFather в Telegram
   - Найдите своего бота `@Fit_Coach_bot`
   - Выполните команду: `/newapp`
   - Выберите вашего бота
   - Введите название: `FitCoach Local`
   - Введите описание
   - Загрузите иконку (512x512 px)
   - **Введите URL**: `https://your-ngrok-url.ngrok-free.app/app`
   - Получите ссылку вида: `https://t.me/Fit_Coach_bot/fitcoach_local`

6. **Откройте Mini App**:
   - Нажмите на полученную ссылку в Telegram
   - Приложение откроется через ngrok туннель

## Способ 2: Локальный дебаг в браузере

Для быстрого тестирования без Telegram:

1. Убедитесь что в `.env.development` установлено:
```
VITE_WEB_DEBUG_ENABLED=true
```

2. Запустите проект:
```bash
npm run dev
```

3. Откройте в браузере:
```
http://localhost:5173/app?web_debug=1
```

Это позволит тестировать UI без Telegram WebApp, но без реального Telegram контекста.

## Способ 3: Использование локального IP

Если вы хотите протестировать на телефоне в той же сети:

1. Запустите проект с `--host`:
```bash
npm run dev:host
```

2. Найдите локальный IP:
```bash
ipconfig  # Windows
ifconfig  # Linux/Mac
```

3. Откройте на телефоне: `http://YOUR_IP:5173/app`

**Примечание**: Telegram Mini Apps требуют HTTPS, поэтому для реального тестирования в Telegram используйте ngrok (Способ 1).

## Решение проблем

### CORS ошибки
Убедитесь что backend запущен и прокси настроен в `vite.config.js`.

### Telegram WebApp не загружается
- Проверьте что ngrok URL правильный и доступен
- URL должен заканчиваться на `/app`
- Убедитесь что используется HTTPS

### Backend недоступен
Проверьте что Django сервер запущен на порту 8000:
```bash
cd backend
python manage.py runserver
```

## Полезные команды

```bash
# Запуск всего стека (frontend + backend) одной командой
# В корне проекта можно создать скрипт start.sh или start.bat

# Windows (start.bat):
start cmd /k "cd backend && python manage.py runserver"
start cmd /k "cd frontend && npm run dev:host"
start cmd /k "ngrok http 5173"

# Linux/Mac (start.sh):
cd backend && python manage.py runserver &
cd frontend && npm run dev:host &
ngrok http 5173
```

Проект root: /fitness-app

Структура:
- /bot — Telegram-бот на aiogram 3 (Python)
- /backend — Django + DRF, REST API для бота и фронта
- /frontend — React (Telegram WebApp мини-ап)

Главный источник правды:
- БД и модели: /backend
- Бизнес-логика бота: /bot
- UI и Telegram WebApp: /frontend

При изменениях:
- Сначала обновляем backend (сериализаторы, вьюхи, схемы).
- Потом бот (API-клиент к backend).
- Потом фронт (запросы к backend).

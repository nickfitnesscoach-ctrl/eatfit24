# Многоступенчатая сборка для оптимизации размера образа

# Этап 1: Сборка приложения
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходный код
COPY . .

# Принимаем build args для Vite (переданы из docker-compose.yml)
ARG VITE_API_URL=/api/v1
ARG VITE_TELEGRAM_BOT_NAME=EatFit24_bot
ARG VITE_TRAINER_INVITE_LINK=https://t.me/EatFit24_bot

# Делаем их доступными как environment variables для npm run build
# Vite подхватит их автоматически благодаря префиксу VITE_
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TELEGRAM_BOT_NAME=$VITE_TELEGRAM_BOT_NAME
ENV VITE_TRAINER_INVITE_LINK=$VITE_TRAINER_INVITE_LINK

# Собираем production build
# Vite встроит значения VITE_* переменных в JS bundle
RUN npm run build

# Этап 2: Production образ с nginx
FROM nginx:alpine

# Копируем собранное React приложение в подпапку /app
COPY --from=builder /app/dist /usr/share/nginx/html/app

# Копируем лендинг (статические HTML страницы)
COPY public/landing /usr/share/nginx/html/landing

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]

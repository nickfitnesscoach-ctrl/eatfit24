#!/bin/bash

echo "========================================="
echo "  FoodMind AI Frontend - Deploy Script"
echo "========================================="
echo ""

# Переменные
SERVER="root@85.198.81.133"
REMOTE_DIR="/opt/foodmind-frontend"
LOCAL_DIR="."

echo "🔨 Шаг 1: Создание директории на сервере..."
ssh $SERVER "mkdir -p $REMOTE_DIR"

echo ""
echo "📦 Шаг 2: Копирование файлов на сервер..."
# Создаём архив локально, исключая ненужные файлы
tar --exclude='node_modules' --exclude='.git' --exclude='dist' -czf /tmp/foodmind-frontend.tar.gz .
scp /tmp/foodmind-frontend.tar.gz $SERVER:$REMOTE_DIR/
rm /tmp/foodmind-frontend.tar.gz

echo ""
echo "🐳 Шаг 3: Сборка и запуск Docker контейнера на сервере..."
ssh $SERVER << 'ENDSSH'
cd /opt/foodmind-frontend

echo "Extracting files..."
tar -xzf foodmind-frontend.tar.gz
rm foodmind-frontend.tar.gz

echo "Stopping old container (if exists)..."
docker compose down 2>/dev/null || true

echo "Building new image..."
docker compose build

echo "Starting container..."
docker compose up -d

echo ""
echo "Checking container status..."
docker compose ps

echo ""
echo "Checking logs..."
docker compose logs --tail=20
ENDSSH

echo ""
echo "========================================="
echo "  ✅ Деплой завершен!"
echo "========================================="
echo ""
echo "Frontend доступен: http://85.198.81.133:3000"
echo ""
echo "Полезные команды на сервере:"
echo "  ssh $SERVER 'cd $REMOTE_DIR && docker compose logs -f'"
echo "  ssh $SERVER 'cd $REMOTE_DIR && docker compose restart'"
echo ""

# Multi-Photo Meals (Мультифото для приёмов пищи)

## Что это?

Теперь пользователь может загрузить **несколько фотографий** для одного приёма пищи. Например, сфотографировать салат, основное блюдо и десерт — и все фото будут объединены в один завтрак/обед/ужин.

## Как работает

### Для пользователя

1. Выбираешь несколько фото еды
2. Выбираешь тип приёма пищи (завтрак/обед/ужин/перекус)
3. Нажимаешь "Распознать"
4. Все фото обрабатываются и объединяются в **одну запись** в дневнике

### В дневнике

- Карточка приёма пищи показывает **галерею фото** (до 3 превью + "+N")
- При открытии — полноэкранная галерея со стрелками и точками навигации
- Калории суммируются со всех фото

## Технические детали

### Группировка фотографий

Фотографии объединяются в один приём пищи если:
- Одинаковый тип приёма (breakfast/lunch/dinner/snack)
- Одна и та же дата
- Загружены в пределах **10 минут**

### Статусы обработки

Каждое фото имеет свой статус:
- `PENDING` — ожидает обработки
- `PROCESSING` — распознаётся AI
- `SUCCESS` — успешно распознано
- `FAILED` — ошибка распознавания

**Важно:** если одно фото не распознано — остальные всё равно сохранятся.

### Статусы приёма пищи

- `DRAFT` — ещё принимает новые фото
- `PROCESSING` — идёт обработка
- `COMPLETE` — все фото обработаны

## API

### Запрос распознавания

```
POST /api/v1/ai/recognize/
Content-Type: multipart/form-data

image: <file>
meal_type: breakfast
date: 2024-12-28
meal_id: 123  # опционально — для добавления к существующему приёму
```

### Ответ

```json
{
  "task_id": "abc-123",
  "meal_id": 123,
  "meal_photo_id": 456,
  "status": "processing"
}
```

### Структура приёма пищи

```json
{
  "id": 123,
  "meal_type": "breakfast",
  "status": "COMPLETE",
  "photos": [
    {
      "id": 456,
      "image_url": "/media/meals/photo1.jpg",
      "status": "SUCCESS"
    },
    {
      "id": 457,
      "image_url": "/media/meals/photo2.jpg",
      "status": "SUCCESS"
    }
  ],
  "photo_url": "/media/meals/photo1.jpg",  // backward compatibility
  "photo_count": 2,
  "items": [
    {"name": "Овсянка", "calories": 150, ...},
    {"name": "Банан", "calories": 90, ...}
  ]
}
```

## База данных

### Новая модель: MealPhoto

```
MealPhoto
├── meal (FK → Meal)
├── image (ImageField)
├── status (PENDING/PROCESSING/SUCCESS/FAILED)
├── recognized_data (JSON)
├── error_message (Text)
└── created_at (DateTime)
```

### Изменения в Meal

```
Meal
├── ... существующие поля ...
└── status (DRAFT/PROCESSING/COMPLETE)  # NEW
```

## Миграции

- `0004_meal_status_mealphoto.py` — добавляет MealPhoto и Meal.status
- `0005_migrate_existing_photos.py` — переносит старые Meal.photo в MealPhoto

## Frontend компоненты

| Компонент | Описание |
|-----------|----------|
| `MealPhotoGallery` | Галерея с навигацией (стрелки, точки) |
| `MealPhotoStrip` | Компактная полоска фото для карточек |

## Совместимость

- Старые приёмы пищи с одним фото работают как раньше
- `photo_url` остаётся для обратной совместимости (возвращает первое фото)
- Существующие данные автоматически мигрируют в MealPhoto

## Деплой

### Первый раз (миграция media)

```bash
# 1. На сервере: мигрировать файлы из Docker volume в bind mount
./scripts/migrate-media-to-bind-mount.sh

# 2. Обновить nginx конфиг
sudo cp nginx/eatfit24.ru /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx

# 3. Деплой контейнеров
docker compose up -d --build

# 4. Применить миграции Django
docker exec eatfit24-backend python manage.py migrate
```

### Проверка

```bash
# Проверить что media файлы доступны
curl -I https://eatfit24.ru/media/uploads/users/...

# Должно вернуть 200 OK с Cache-Control: public
```

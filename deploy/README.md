# Deployment Configuration

## Nginx Configuration

### Production Server (eatfit24.ru)

**File:** `nginx-eatfit24.ru.conf`

Конфигурация для production сервера с SSL сертификатами Let's Encrypt.

#### Установка:

```bash
# Скопировать конфигурацию на сервер
scp deploy/nginx-eatfit24.ru.conf root@85.198.81.133:/etc/nginx/sites-available/eatfit24.ru

# Создать symlink (если еще не создан)
ssh root@85.198.81.133 "ln -sf /etc/nginx/sites-available/eatfit24.ru /etc/nginx/sites-enabled/eatfit24.ru"

# Проверить конфигурацию
ssh root@85.198.81.133 "nginx -t"

# Перезагрузить nginx
ssh root@85.198.81.133 "systemctl reload nginx"
```

#### Важные настройки:

1. **Таймауты для AI-распознавания:**
   ```nginx
   proxy_connect_timeout 150s;
   proxy_send_timeout 150s;
   proxy_read_timeout 150s;
   ```
   AI-распознавание может занимать до 70-80 секунд, поэтому таймауты увеличены до 150 секунд.

2. **SSL/TLS:**
   - Используются сертификаты Let's Encrypt
   - Автоматическая переадресация с HTTP на HTTPS
   - Поддержка TLS 1.2 и 1.3

3. **Размер загружаемых файлов:**
   ```nginx
   client_max_body_size 10M;
   ```

## History Log

### 2025-11-30: Исправление таймаутов для AI-распознавания

**Проблема:** Пользователи получали ошибку 504 Gateway Timeout при загрузке фото блюда.

**Причина:** Nginx прерывал запросы через 60 секунд (дефолтный `proxy_read_timeout`), но AI-распознавание занимало ~70-73 секунды.

**Решение:** Увеличены таймауты до 150 секунд для маршрута `/api/`.

**Логи:**
- Nginx error log показывал: `upstream timed out (110: Connection timed out)`
- Django logs показывали успешный ответ от AI Proxy через 72.68 секунд
- Nginx прерывал соединение в 14:52:07, а backend отвечал в 14:52:20

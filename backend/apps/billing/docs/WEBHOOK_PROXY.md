# Webhook за Reverse Proxy (Nginx + Docker)

## Проблема

Когда приложение работает в Docker за nginx reverse proxy, webhook'и от YooKassa блокируются из-за неправильного определения IP адреса отправителя.

### Архитектура

```
YooKassa (185.71.76.0/24)
    ↓
Nginx (передаёт X-Forwarded-For)
    ↓
Docker Network Gateway (172.23.0.1)
    ↓
Django Backend (видит REMOTE_ADDR=172.23.0.1)
```

### Что происходит

1. **YooKassa отправляет webhook** с реального IP (например, `185.71.76.23`)
2. **Nginx принимает запрос** и добавляет заголовки:
   ```
   X-Forwarded-For: 185.71.76.23
   X-Real-IP: 185.71.76.23
   ```
3. **Docker network** передаёт запрос в контейнер, но заменяет `REMOTE_ADDR` на `172.23.0.1` (docker gateway)
4. **Django видит**:
   - `REMOTE_ADDR = 172.23.0.1` (внутренний Docker IP)
   - `X-Forwarded-For = 185.71.76.23` (реальный IP YooKassa)
5. **Webhook handler проверяет** `REMOTE_ADDR` по allowlist YooKassa:
   - `172.23.0.1` НЕ в списке разрешённых IP YooKassa
   - ❌ **Webhook блокируется с 403 Forbidden**

## Решение

### 1. Включить доверие к X-Forwarded-For

Но **ТОЛЬКО** если запрос пришёл от доверенного прокси (nginx/docker gateway).

### 2. Настройка Nginx

Убедитесь что в `/etc/nginx/sites-enabled/eatfit24.ru` есть:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
}
```

**Важные заголовки:**
- `X-Real-IP` - один IP адрес клиента
- `X-Forwarded-For` - цепочка IP (может содержать несколько через запятую)
- `X-Forwarded-Proto` - протокол (http/https)

### 3. Настройка Django

В `.env` добавьте:

```bash
# Доверять X-Forwarded-For (ТОЛЬКО для production за nginx)
WEBHOOK_TRUST_XFF=true

# Список доверенных прокси (nginx, docker gateway)
# 127.0.0.1 - nginx на localhost
# 172.23.0.0/16 - docker network subnet
WEBHOOK_TRUSTED_PROXIES=127.0.0.1,172.23.0.0/16
```

### 4. Как это работает

```python
def _get_client_ip_secure(request):
    remote_addr = request.META.get("REMOTE_ADDR")  # 172.23.0.1 (docker gateway)

    if WEBHOOK_TRUST_XFF:
        # Проверяем, что запрос от доверенного прокси
        if _is_trusted_proxy(remote_addr):  # 172.23.0.1 in 172.23.0.0/16 ? ✅
            # Берём первый IP из X-Forwarded-For
            xff = request.META.get("HTTP_X_FORWARDED_FOR")  # "185.71.76.23"
            return xff.split(",")[0].strip()  # ✅ Вернём 185.71.76.23

    return remote_addr  # ❌ Вернули бы 172.23.0.1
```

## Безопасность

### ⚠️ Почему нельзя просто доверять X-Forwarded-For?

Клиент может **подделать** этот заголовок:

```bash
curl -H "X-Forwarded-For: 185.71.76.23" https://eatfit24.ru/api/v1/billing/webhooks/yookassa
```

Если мы слепо доверяем XFF, злоумышленник сможет подделать IP и обойти allowlist.

### ✅ Правильный подход

1. **Доверяем XFF только от trusted proxies**:
   - Проверяем `REMOTE_ADDR` (его нельзя подделать)
   - Если `REMOTE_ADDR ∈ WEBHOOK_TRUSTED_PROXIES` → используем XFF
   - Если `REMOTE_ADDR ∉ WEBHOOK_TRUSTED_PROXIES` → игнорируем XFF

2. **WEBHOOK_TRUSTED_PROXIES содержит**:
   - `127.0.0.1` - nginx на localhost
   - `172.23.0.0/16` - docker network (только наш gateway, не интернет)

3. **Результат**:
   - Запросы от nginx/docker → используем XFF (реальный IP YooKassa)
   - Прямые запросы из интернета → используем REMOTE_ADDR (нельзя подделать)

## Диагностика

### Проверить Docker network

```bash
docker network inspect eatfit24_backend-net | grep -E "Subnet|Gateway"
```

Вывод:
```json
"Subnet": "172.23.0.0/16",
"Gateway": "172.23.0.1"
```

### Проверить nginx конфигурацию

```bash
nginx -t
cat /etc/nginx/sites-enabled/eatfit24.ru | grep -A 3 "proxy_set_header"
```

### Проверить логи webhook

```bash
docker compose logs backend | grep WEBHOOK
```

Успешный webhook:
```
[WEBHOOK] Using X-Forwarded-For IP: 185.71.76.23 (from trusted proxy 172.23.0.1)
[WEBHOOK_RECEIVED] Event: payment.succeeded, Payment: 2d2f8b0f-...
```

Заблокированный webhook:
```
[WEBHOOK_BLOCKED] IP=172.23.0.1 не в allowlist YooKassa
```

### Симуляция webhook от nginx

Можно протестировать изнутри контейнера:

```bash
docker compose exec backend curl -X POST \
  http://localhost:8000/api/v1/billing/webhooks/yookassa \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 185.71.76.23" \
  -d '{"test": "data"}'
```

- Если `WEBHOOK_TRUST_XFF=false` → 403 (не доверяем XFF от localhost)
- Если `WEBHOOK_TRUST_XFF=true` + `127.0.0.1 ∈ TRUSTED_PROXIES` → обработается с IP=185.71.76.23

## Checklist для Production

- [ ] Nginx передаёт `X-Forwarded-For` и `X-Real-IP`
- [ ] Docker network subnet определён (обычно `172.X.0.0/16`)
- [ ] `.env` содержит `WEBHOOK_TRUST_XFF=true`
- [ ] `.env` содержит `WEBHOOK_TRUSTED_PROXIES` с docker subnet
- [ ] Webhook проходит без 403 ошибки
- [ ] Логи показывают реальный IP YooKassa, а не docker gateway

## FAQ

**Q: Можно ли добавить `0.0.0.0/0` в TRUSTED_PROXIES?**
A: ❌ НЕТ! Это сделает систему уязвимой - любой сможет подделать IP через XFF.

**Q: Нужно ли включать WEBHOOK_TRUST_XFF в development?**
A: Зависит от архитектуры:
- Docker Compose БЕЗ nginx → `false` (используем REMOTE_ADDR)
- Docker Compose С nginx → `true` (нужен XFF)

**Q: Что делать если docker subnet изменился?**
A: Обновить `WEBHOOK_TRUSTED_PROXIES` в `.env` и перезапустить контейнер.

**Q: Webhook всё равно блокируется с TRUST_XFF=true**
A: Проверьте:
1. `REMOTE_ADDR` находится в `TRUSTED_PROXIES`?
2. Nginx передаёт `X-Forwarded-For`?
3. Перезапущен контейнер после изменения `.env`?

## См. также

- [RECURRING_SWITCH.md](./RECURRING_SWITCH.md) - Включение/выключение recurring payments
- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) - Известные ограничения биллинга
- [YooKassa IP Allowlist](https://yookassa.ru/developers/using-api/webhooks#ip) - Официальный список IP

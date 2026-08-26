# Перенос системы на Timeweb Cloud (с обходом блокировок Supabase)

Схема повторяет инструкцию для `unvrsm.ru`, но адаптирована под наш стек: приложение —
не статический SPA, а SSR на TanStack Start (Node), поэтому контейнер `app` запускает
Node-сервер, а весь nginx (SPA-прокси + прокси на Supabase + заглушка) живёт в контейнере `edge`.

```text
Браузер (РФ) ─► https://<домен>            ─┐
              https://api.<домен>          ─┤ Timeweb SSL → :8082
                                            ▼
                       edge (nginx, всегда онлайн)
                         • /__edge_health → 200 ok
                         • 502/503/504 от app → maintenance.html (503, Retry-After: 900)
                         • server api.<домен> → https://<ref>.supabase.co (SNI + CORS + WS)
                                            │ http://app:8080
                                            ▼
                       app (Node, TanStack Start SSR + server functions)
```

## Файлы

| Файл | Назначение |
|------|------------|
| `Dockerfile` | Сборка Vite/Nitro (`NITRO_PRESET=node_server`) + запуск `.output/server/index.mjs` на 8080 |
| `edge/Dockerfile` | nginx:alpine, HEALTHCHECK на `/__edge_health` |
| `edge/nginx.conf.template` | Шаблон (подставляются `APP_DOMAIN`, `API_DOMAIN`, `SUPABASE_UPSTREAM`) |
| `edge/maintenance.html` | Страница «Обновляем систему» |
| `docker-compose.yml` | `edge` (`8082:8080`) и `app` (только `expose: 8080`) |
| `.env.deploy.example` | Список всех переменных окружения |

## Шаги деплоя

1. Запушить ветку с этими файлами в репозиторий.
2. Timeweb Cloud → создать приложение типа **Docker Compose**, указать репозиторий и ветку.
3. Внешний порт приложения → **8082** (это `edge`). Контейнер `app` наружу не публикуется.
4. Переменные окружения — из `.env.deploy.example` (обязательно `APP_DOMAIN`, `API_DOMAIN`,
   `SUPABASE_UPSTREAM`, все `VITE_SUPABASE_*`, а также `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`
   и, если нужны админ-операции, `SUPABASE_SERVICE_ROLE_KEY`).
5. Healthcheck: `GET /__edge_health` → `200 ok`.
6. DNS: `A <домен>`, `A www.<домен>`, `A api.<домен>` → IP Timeweb (без `api.` обхода не будет).
7. SSL Let's Encrypt — на оба домена: корневой и `api.`.
8. Deploy. Первый билд ~6–10 минут.

## Настройки авторизации в бэкенде

- Site URL: `https://<домен>`
- Redirect URLs: `https://<домен>/*`, `https://www.<домен>/*`, `http://localhost:8080/*`
- JWT issuer менять не нужно.

## Проверка после деплоя

```bash
curl -s  https://<домен>/__edge_health                 # ok
curl -sI https://<домен>/ | head -1                    # HTTP/2 200
curl -sI https://api.<домен>/auth/v1/health            # 200
curl -sI -X OPTIONS https://api.<домен>/auth/v1/token \
  -H "Origin: https://<домен>" -H "Access-Control-Request-Method: POST"   # 204, один ACAO
```

Локально то же самое: `docker compose --env-file .env.deploy up --build`, потом
`http://localhost:8082`. Имитация деплоя: `docker compose restart app` — в это время
должна показываться заглушка.

Ручной режим обслуживания:

```bash
docker exec <edge> touch /etc/nginx/flags/maintenance.enabled   # включить
docker exec <edge> rm    /etc/nginx/flags/maintenance.enabled   # выключить
```

## Чек-лист

- [ ] В коде нет прямых ссылок на `*.supabase.co` (`rg -n "supabase\.co" src/`) — сейчас чисто
- [ ] `VITE_SUPABASE_URL` = `https://api.<домен>`, не `*.supabase.co`
- [ ] `SUPABASE_UPSTREAM` = реальный ref проекта
- [ ] Внешний порт Timeweb = 8082, healthcheck = `/__edge_health`
- [ ] SSL на корневом и `api.` домене
- [ ] Логин проходит, Realtime показывает `101 Switching Protocols`, загрузка файлов > 1 МБ работает

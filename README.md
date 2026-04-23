# blanko

Whiteboard-приложение: дашборд досок + бесконечный канвас на tldraw.

## Стек

- **backend** — Go, PostgreSQL, Redis, миграции в `backend/app/migration/`
- **dashboard** — React + TypeScript (Vite), `apps/dashboard/`
- **canvas** — tldraw через esm.sh, статический HTML в `backend/app/static/canvas/`
- **infra** — Docker Compose, Traefik, Keycloak (OIDC)

## Структура

```
apps/dashboard/        # UI списка досок
backend/app/           # Go-сервер, API, статика
  migration/           # SQL-миграции
  static/canvas/       # tldraw-канвас (без build-шага)
deploy/                # docker-compose + конфиг Keycloak
```

## Запуск

Требуется Docker и pnpm.

```sh
make up       # собрать фронт + поднять все контейнеры
make down     # остановить
make deps     # только pnpm install
```

`make up SKIP_FRONTEND=1` — поднять без пересборки фронта.

## Доступ

- `http://localhost/app/dashboard` — список досок (логин через Keycloak)
- `http://localhost/app/b/<uid>` — канвас конкретной доски

Тестовый юзер задан в `deploy/keycloak/realm-blanko.json`.

## Разработка

```sh
pnpm --filter @blanko/dashboard dev    # фронт в dev-режиме
cd backend/app && go build ./...        # сборка бекенда
```

Канвас (`backend/app/static/canvas/index.html`) редактируется напрямую, сборки не требует. Бекенд подставляет `%%BOARD_TITLE%%` и инжектит `window.APP_UID` при отдаче.

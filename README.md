# Blanko

Веб-приложение для командной работы с досками: дашборд команд и досок + бесконечный канвас.

**Задача.** Дать команде общее место для визуальной работы: завести доску, разложить доски по командам, быстро найти нужную и открыть её для рисования. Минимальный аналог Miro/FigJam.

**Пользователь.** Участник команды. Входит через SSO (OIDC), видит доски своих команд, создаёт новые, отмечает звёздочкой, открывает канвас.

**Что разработано в этой работе:**

- Go-сервис: REST API аккаунтов, команд и досок, ролевая модель команд (`owner` / `admin` / `member`), серверный рендер страниц дашборда и доски, собственный runner SQL-миграций;
- React-дашборд: списки команд и досок, звёзды, настройки команды и профиля;
- схема БД (15 таблиц) и интеграционная обвязка Traefik → oauth2-proxy → Keycloak → backend.

**Взято готовым:** канвас — [tldraw](https://tldraw.dev) (подключён с CDN, без своего билд-шага), аутентификация — Keycloak и oauth2-proxy, маршрутизация — Traefik.

**Демонстрация.** Публичного стенда нет — система разворачивается локально одной командой, см. [Быстрый старт](#быстрый-старт).

**Критерий успешного запуска.** После `make up` на `http://app.localhost/app/dashboard` открывается форма входа Keycloak; после входа тестовым пользователем виден дашборд, на нём создаётся команда и доска, доска открывается, нарисованная на ней фигура переживает перезагрузку страницы.

## Состав системы

| Компонент | Технологии | Где |
|---|---|---|
| Дашборд | React 19, TypeScript, Vite 5 | `frontend/dashboard/` |
| Канвас | tldraw 3.15.3 + React 18 через esm.sh, без билд-шага | `backend/app/static/canvas/` |
| Backend | Go 1.25, gorilla/mux, pgx v5 | `backend/app/` |
| БД | PostgreSQL 17, SQL-миграции | `backend/app/migration/` |
| Кэш | Redis 7.2 — поднимается, приложением пока не используется | — |
| Аутентификация | Keycloak 26.0.5 (OIDC) + oauth2-proxy 7.7.1 | `deploy/keycloak/` |
| Маршрутизация | Traefik 3.1 | `deploy/docker-compose.yml` |

Весь внешний трафик идёт через Traefik на oauth2-proxy; неаутентифицированный запрос редиректится в Keycloak. Backend наружу не публикуется и доверяет заголовкам `X-Forwarded-Email` / `X-Forwarded-Preferred-Username`, которые проставляет oauth2-proxy.

## Требования

| Инструмент | Версия | Зачем |
|---|---|---|
| Docker + Compose v2 | — | поднимает все сервисы |
| pnpm | 10.x | сборка дашборда (проверено на 10.24) |
| Node.js | 20+ | нужен для pnpm и Vite (проверено на 25.2) |
| GNU Make | — | точка входа `make up` |
| Go | 1.25+ | **необязательно**: только для сборки бэкенда вне Docker |

Проверено на macOS 26 (arm64). Занимаемые порты: **80** (Traefik) и **5433** (PostgreSQL приложения, открыт наружу для отладки).

### Разрешение имён

Traefik маршрутизирует по заголовку `Host`, поэтому приложение доступно как `app.localhost`, а не `localhost`. На macOS и в большинстве Linux-дистрибутивов любой `*.localhost` резолвится в `127.0.0.1` автоматически — настраивать ничего не нужно. Если имя не резолвится (обычно Windows), добавьте в hosts-файл:

```
127.0.0.1 app.localhost keycloak.localhost
```

## Быстрый старт

```sh
git clone git@github.com:dvsnin/blanko.git
cd blanko
make up
```

`make up` создаёт `deploy/.env` из `deploy/.env.example`, ставит зависимости pnpm, собирает дашборд, собирает образы и поднимает контейнеры. Миграции применяются автоматически при старте бэкенда — отдельной команды не нужно.

Конфигурацию можно подготовить и вручную, до запуска:

```sh
cp deploy/.env.example deploy/.env    # при необходимости отредактировать
```

Открыть **http://app.localhost/app/dashboard** и войти тестовым пользователем:

```
логин:  test
пароль: qwerty1234
```

Пользователь импортируется в Keycloak из `deploy/keycloak/realm-blanko.json`, строка в таблице `account` создаётся автоматически при первом входе.

```sh
make down                                             # остановить
make up SKIP_FRONTEND=1                               # перезапустить без пересборки фронта
docker compose -f deploy/docker-compose.yml down -v    # остановить и стереть данные
```

После правки `backend/app/static/canvas/` нужна пересборка образа: Dockerfile копирует статику на этапе сборки.

## Адреса

| Адрес | Что |
|---|---|
| `http://app.localhost/app/dashboard` | дашборд: команды и доски |
| `http://app.localhost/app/board/<public_id>` | канвас конкретной доски |
| `http://app.localhost/app/api/v1/...` | REST API |
| `http://keycloak.localhost` | админка Keycloak (`admin` / `admin`) |

`http://localhost/...` вернёт 404 — Traefik принимает только хост `app.localhost`.

## Конфигурация и секреты

Параметры стенда живут в `deploy/.env`. Он не хранится в Git; шаблон со всеми переменными и значениями по умолчанию — `deploy/.env.example`.

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `APP_POSTGRES_USER` / `_PASSWORD` / `_DB` | `postgres` / `postgres` / `app` | БД приложения |
| `APP_POSTGRES_PORT` | `5433` | порт БД приложения на хосте (для отладки) |
| `KC_POSTGRES_USER` / `_PASSWORD` / `_DB` | `keycloak` ×3 | БД Keycloak |
| `KEYCLOAK_ADMIN` / `_PASSWORD` | `admin` / `admin` | админка на `keycloak.localhost` |
| `OIDC_CLIENT_SECRET` | `super-secret-pass` | секрет клиента oauth2-proxy |
| `OAUTH2_PROXY_COOKIE_SECRET` | 32-байтовая строка | подпись сессионной cookie |

> **Секреты.** Значения в `.env.example` — учебные, они рассчитаны только на локальный запуск и намеренно не являются тайной. Для публичного развёртывания заменить нужно каждое: `OAUTH2_PROXY_COOKIE_SECRET` генерируется как `openssl rand -base64 32 | tr -- '+/' '-_'`, а `OIDC_CLIENT_SECRET` обязан совпадать с полем `secret` клиента `blanko` в `deploy/keycloak/realm-blanko.json` — иначе логин перестанет работать. Реальных секретов и персональных данных в репозитории нет.

Backend читает окружение (`backend/app/internal/config/config.go`):

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `POSTGRES_DSN` | — (**обязательна**) | подключение к PostgreSQL |
| `HTTP_ADDR` | `:8080` | адрес HTTP-сервера |
| `MIGRATIONS_DIR` | `migration` | каталог с SQL-миграциями |
| `RUN_MIGRATIONS` | `true` | применять миграции при старте |

Эти четыре переменные проставляет `docker-compose.yml`; править их вручную нужно только при запуске бэкенда вне Docker.

## Структура репозитория

```
frontend/dashboard/         # React-приложение дашборда (pnpm-workspace @blanko/dashboard)
backend/app/                # Go-сервис: API, серверный рендер, статика
  internal/handler/         #   HTTP-слой и middleware аутентификации
  internal/service/         #   бизнес-логика и права
  internal/repository/      #   доступ к PostgreSQL
  migration/                #   SQL-миграции
  static/canvas/            #   tldraw-канвас (правится напрямую, без сборки)
  static/dashboard/         #   сюда Vite кладёт сборку (в Git не хранится)
backend/collab, backend/ws  # заготовки будущих сервисов, пока заглушки
deploy/                     # docker-compose и конфигурация Keycloak
  .env.example              #   шаблон конфигурации стенда
Makefile                    # make up / down / deps
```

## База данных и миграции

- Схему создают миграции из `backend/app/migration/`. Формат goose-совместимый (`-- +goose Up` / `-- +goose Down`), применяет их собственный runner (`internal/database/database.go`), журнал применённого — в таблице `schema_migrations`.
- Миграции запускаются при каждом старте бэкенда, уже применённые пропускаются. Отключаются через `RUN_MIGRATIONS=false`.
- Отдельный seed не нужен: тестовый пользователь приходит из realm-импорта Keycloak, аккаунт в БД создаётся при первом входе.
- Сброс состояния — `docker compose -f deploy/docker-compose.yml down -v` (удаляет тома PostgreSQL и Redis).
- Дампов и реальных персональных данных в репозитории нет.

## API

Все прикладные эндпоинты — `POST /app/api/v1/<ресурс>/<действие>`, тело и ответ в JSON.

```
/account/get    /account/update
/team/list      /team/create   /team/update   /team/delete
/team/leave     /team/star     /team/unstar
/board/list     /board/create  /board/update  /board/delete
/board/star     /board/unstar
```

Аутентификация: `AuthMiddleware` берёт identity из заголовков oauth2-proxy; клиент дополнительно передаёт в теле `accountId`, сервер сверяет его с сессией и отвечает `403 account_mismatch` при расхождении. Ошибки возвращаются как `{"error": "<код>", "message": "..."}` со статусами 400/401/403/404/500.

Описания OpenAPI пока нет — контракт задают `internal/handler/` на сервере и `frontend/dashboard/src/api/client.ts` на клиенте.

## Разработка

```sh
pnpm --filter @blanko/dashboard build   # собрать дашборд в backend/app/static/dashboard
pnpm --filter @blanko/dashboard dev     # Vite с HMR на :5173
cd backend/app && go build ./...        # сборка бэкенда
```

Vite dev-сервер отдаёт только UI: `window.dashData` инжектит бэкенд при рендере страницы, а запросы к API требуют cookie oauth2-proxy. Поэтому дашборд с данными проверяется через `make up`, а `pnpm dev` полезен для вёрстки.

Канвас (`backend/app/static/canvas/index.html`) правится напрямую, сборки не требует. Бэкенд подставляет в него `%%BOARD_TITLE%%` и инжектит `window.APP_UID` вместе с `window.dashData`.

## Тесты и CI

Автотестов и CI-пайплайна в проекте нет. Основной сценарий проверяется вручную по критерию из начала README: вход → создание команды и доски → рисование на канвасе → перезагрузка страницы.

## Известные ограничения

- **Нет совместного редактирования в реальном времени.** Содержимое канваса хранится в IndexedDB браузера (`persistenceKey` = id доски) и на сервер не отправляется: другой пользователь той же доски чужих фигур не увидит. `backend/collab` и `backend/ws` — заготовки под это, сейчас заглушки.
- Нет автотестов, CI и описания OpenAPI.
- Запуск только локальный, через `*.localhost` и HTTP без TLS; production-конфигурации нет.
- Redis поднимается, но приложением пока не используется.
- Часть таблиц схемы (`notification`, `board_share_token`, `organization`, `board_event_journal`) создана на вырост и API пока не покрыта. Панель уведомлений в дашборде — вёрстка без источника данных.

Об ошибке можно сообщить в [Issues](https://github.com/dvsnin/blanko/issues).

## Лицензия

Код распространяется по лицензии MIT — см. [LICENSE](LICENSE).

tldraw используется по его публичной лицензии, которая требует сохранять видимым watermark «Made with tldraw» на канвасе. Скрывать его (через CSS или переопределение `components`) без коммерческой лицензии tldraw нельзя.

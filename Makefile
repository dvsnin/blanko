DOCKER_COMPOSE = docker compose -f deploy/docker-compose.yml

FRONTEND_FILTERS = @blanko/dashboard @blanko/canvas

# Конфигурация стенда. deploy/.env не хранится в Git - создаётся из примера.
ENV_FILE = deploy/.env
ENV_EXAMPLE = deploy/.env.example

.PHONY: up down build-frontend deps env test-backend presets-sql

# Поднять все сервисы с пересборкой (по умолчанию собирает фронтенд перед билдом контейнеров)
up: prebuild_check env
	@if [ -z "$(SKIP_FRONTEND)" ]; then \
		$(MAKE) build-frontend || exit $$?; \
	else \
		echo "SKIP_FRONTEND set - пропускаем сборку фронтенда"; \
	fi
	$(DOCKER_COMPOSE) up -d --build

# Остановить и удалить контейнеры
down: env
	$(DOCKER_COMPOSE) down

# deploy/.env из примера, если его ещё нет; для публичного развёртывания значения заменить.
env:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "==> $(ENV_FILE) не найден - создаю из $(ENV_EXAMPLE)"; \
		cp $(ENV_EXAMPLE) $(ENV_FILE); \
	fi

# Проверка окружения до сборки (например, pnpm установлен)
prebuild_check:
	@command -v go >/dev/null 2>&1 || echo "go: not found in PATH (если нужен для локальной сборки backend, установите Go)"
	@command -v docker >/dev/null 2>&1 || echo "docker: not found in PATH (нужен для сборки контейнеров)"
	@command -v docker-compose >/dev/null 2>&1 || true

# Сборка фронтенда для всех приложений (вызовется перед подъемом контейнеров)
# Можно пропустить, задав SKIP_FRONTEND=1 при вызове make
build-frontend:
	@echo "==> Building frontend apps..."
	@command -v pnpm >/dev/null 2>&1 || (echo "pnpm not found. Install pnpm: npm i -g pnpm" && exit 1)
	@echo "Installing workspace dependencies (pnpm -w install)..."
	pnpm -w install
	@echo "Building frontend packages from FRONTEND_FILTERS: $(FRONTEND_FILTERS)"
	@for pkg in $(FRONTEND_FILTERS); do \
		echo "-> Building $$pkg"; \
		pnpm --filter $$pkg build || exit $$?; \
	done
	@echo "Frontend build finished."

# Тесты бэкенда: Postgres стенда и база app_test (создаётся init-скриптом при первом старте). DSN из deploy/.env
# или свой: make test-backend TEST_POSTGRES_DSN=...
envval = $(shell grep -E '^$(1)=' $(ENV_FILE) | head -1 | cut -d= -f2-)
TEST_POSTGRES_DSN ?= postgres://$(call envval,APP_POSTGRES_USER):$(call envval,APP_POSTGRES_PASSWORD)@localhost:$(call envval,APP_POSTGRES_PORT)/app_test?sslmode=disable
test-backend: env
	cd backend/app && TEST_POSTGRES_DSN="$(TEST_POSTGRES_DSN)" go test -race ./...

# Если нужно только установить зависимости в monorepo
deps:
	@command -v pnpm >/dev/null 2>&1 || (echo "pnpm not found. Install pnpm: npm i -g pnpm" && exit 1)
	pnpm -w install
# Миграция со строками готовых шаблонов генерируется из каталога internal/preset.
presets-sql:
	cd backend/app && go run ./cmd/presetsql > migration/20261025180100_presets.sql

DOCKER_COMPOSE = docker compose -f deploy/docker-compose.yml

# list of frontend apps to build (adjust package names or paths if needed)
FRONTEND_FILTERS = @blanko/dashboard @blanko/canvas

.PHONY: up down build-frontend deps

# Поднять все сервисы с пересборкой (по умолчанию собирает фронтенд перед билдом контейнеров)
up: prebuild_check
	@if [ -z "$(SKIP_FRONTEND)" ]; then \
		$(MAKE) build-frontend || exit $$?; \
	else \
		echo "SKIP_FRONTEND set — пропускаем сборку фронтенда"; \
	fi
	$(DOCKER_COMPOSE) up -d --build

# Остановить и удалить контейнеры
down:
	$(DOCKER_COMPOSE) down

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

# Если нужно только установить зависимости в monorepo
deps:
	@command -v pnpm >/dev/null 2>&1 || (echo "pnpm not found. Install pnpm: npm i -g pnpm" && exit 1)
	pnpm -w install
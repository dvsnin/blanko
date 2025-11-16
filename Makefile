DOCKER_COMPOSE = docker compose -f deploy/docker-compose.yml

# Поднять все сервисы с пересборкой
up:
	$(DOCKER_COMPOSE) up -d --build

# Остановить и удалить контейнеры
down:
	$(DOCKER_COMPOSE) down

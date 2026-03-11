COMPOSE = docker compose -f docker-compose.local.yml

up:
	$(COMPOSE) up

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) down && $(COMPOSE) build && $(COMPOSE) up

rebuild-frontend:
	$(COMPOSE) build frontend && $(COMPOSE) up --no-deps frontend

rebuild-agent:
	$(COMPOSE) build employee-marketing-manager && $(COMPOSE) up --no-deps employee-marketing-manager

rebuild-config-api:
	$(COMPOSE) build config-api && $(COMPOSE) up --no-deps config-api

logs:
	$(COMPOSE) logs -f

logs-agent:
	docker logs -f employee-marketing-manager

logs-frontend:
	docker logs -f frontend

logs-config-api:
	docker logs -f config-api

restart-agent:
	docker restart employee-marketing-manager

.PHONY: up down build rebuild rebuild-frontend rebuild-agent rebuild-config-api logs logs-agent logs-frontend logs-config-api restart-agent

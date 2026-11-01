COMPOSE      = docker compose --env-file ../.env -f docker-compose.local.yml
COMPOSE_DEV  = docker compose --env-file ../.env -f docker-compose.dev.yml

# ── Main (port 3000) ──────────────────────────────────────────────────────────

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

# ── Dev (port 3001) ───────────────────────────────────────────────────────────

dev-up:
	$(COMPOSE_DEV) up

dev-down:
	$(COMPOSE_DEV) down

dev-build:
	$(COMPOSE_DEV) build

dev-rebuild:
	$(COMPOSE_DEV) down && $(COMPOSE_DEV) build && $(COMPOSE_DEV) up

dev-rebuild-frontend:
	$(COMPOSE_DEV) build dev-frontend && $(COMPOSE_DEV) up --no-deps dev-frontend

dev-rebuild-meeting-agent:
	$(COMPOSE_DEV) build dev-meeting-agent && $(COMPOSE_DEV) up --no-deps dev-meeting-agent

dev-rebuild-config-api:
	$(COMPOSE_DEV) build dev-config-api && $(COMPOSE_DEV) up --no-deps dev-config-api

dev-logs:
	$(COMPOSE_DEV) logs -f

dev-logs-meeting:
	docker logs -f dev-meeting-agent

dev-logs-frontend:
	docker logs -f dev-frontend

dev-logs-config-api:
	docker logs -f dev-config-api

.PHONY: up down build rebuild rebuild-frontend rebuild-agent rebuild-config-api \
        logs logs-agent logs-frontend logs-config-api restart-agent \
        dev-up dev-down dev-build dev-rebuild dev-rebuild-frontend \
        dev-rebuild-meeting-agent dev-rebuild-config-api \
        dev-logs dev-logs-meeting dev-logs-frontend dev-logs-config-api

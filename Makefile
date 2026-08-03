# OpenMeter UI + Docker quickstart
#
# Usage (from the repo root):
#
#   OpenMeter backend (Docker):
#     make up          start OpenMeter in production mode
#     make dev         start OpenMeter with dev tools (kafka-ui, ch-ui)
#     make down        stop containers (keep data)
#     make clean       stop containers and remove volumes/data
#     make logs        tail logs from all services
#     make status      show running services
#     make restart     restart the OpenMeter stack
#     make pull        pull the latest images
#
#   UI (npm):
#     make install     install npm dependencies
#     make ui          run the OpenMeter UI in dev mode (npm run dev)
#     make build       build the UI for production
#     make preview     preview the production build
#
#   Everything:
#     make start       docker up + UI dev server

COMPOSE_DIR := docker
COMPOSE := docker compose --project-directory $(COMPOSE_DIR) -f $(COMPOSE_DIR)/docker-compose.yaml
DEV_PROFILE ?= dev

.PHONY: help up dev down clean logs status restart pull install ui build preview start

help:
	@echo "OpenMeter UI + Docker quickstart"
	@echo ""
	@echo "OpenMeter backend (Docker):"
	@echo "  make up        Start OpenMeter in production mode"
	@echo "  make dev       Start OpenMeter with dev tools --profile $(DEV_PROFILE)"
	@echo "  make down      Stop containers (data is kept)"
	@echo "  make clean     Stop containers and remove volumes (-v)"
	@echo "  make logs      Tail logs from all services"
	@echo "  make status    Show service status"
	@echo "  make restart   Restart the stack"
	@echo "  make pull      Pull the latest images"
	@echo ""
	@echo "UI (npm):"
	@echo "  make install   Install npm dependencies"
	@echo "  make ui        Run the UI dev server (npm run dev)"
	@echo "  make build     Build the UI for production"
	@echo "  make preview   Preview the production build"
	@echo ""
	@echo "  make start     Start OpenMeter (Docker) + run the UI dev server"
	@echo ""
	@echo "Examples:"
	@echo "  make dev && make ui"

# --- OpenMeter backend (Docker) ---

# Production: OpenMeter + dependencies (kafka, clickhouse, redis, postgres, svix, workers)
up:
	$(COMPOSE) up -d

# Development: everything in `up` plus kafka-ui and ch-ui (dev tools)
dev:
	$(COMPOSE) --profile $(DEV_PROFILE) up -d

down:
	$(COMPOSE) down

clean:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f

status:
	$(COMPOSE) ps

restart:
	$(COMPOSE) restart

pull:
	$(COMPOSE) pull

# --- UI (npm) ---

install:
	npm install

ui:
	npm run dev

build:
	npm run build

preview:
	npm run preview

# --- Everything ---

start:
	$(COMPOSE) --profile $(DEV_PROFILE) up -d
	npm run dev

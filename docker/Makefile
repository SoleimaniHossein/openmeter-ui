# OpenMeter Docker quickstart
#
# Usage (run from this directory, or from the repo root with `make -C docker ...`):
#   make up        # start OpenMeter in production mode
#   make dev       # start OpenMeter with dev tools (kafka-ui, ch-ui)
#   make down      # stop containers (keep data)
#   make clean     # stop containers and remove volumes/data
#   make logs      # tail logs from all services
#   make status    # show running services
#   make restart   # restart the OpenMeter stack
#   make pull      # pull the latest images

COMPOSE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
COMPOSE := cd $(COMPOSE_DIR) && docker compose
DEV_PROFILE ?= dev

.PHONY: help up dev down clean logs status restart pull

help:
	@echo "OpenMeter Docker quickstart"
	@echo ""
	@echo "  make up        Start OpenMeter in production mode (docker compose up -d)"
	@echo "  make dev       Start OpenMeter with dev tools --profile $(DEV_PROFILE)"
	@echo "  make down      Stop containers (data is kept)"
	@echo "  make clean     Stop containers and remove volumes (-v)"
	@echo "  make logs      Tail logs from all services"
	@echo "  make status    Show service status"
	@echo "  make restart   Restart the stack"
	@echo "  make pull      Pull the latest images"
	@echo ""
	@echo "Example: make dev"

# Production: OpenMeter + dependencies (kafka, clickhouse, redis, postgres, svix, workers)
up:
	$(COMPOSE) up -d

# Development: everything in `up` plus kafka-ui and ch-ui (dev tools)
dev:
	$(COMPOSE) --profile $(DEV_PROFILE) up -d

down:
	$(COMPOSE) --profile $(DEV_PROFILE) down

clean:
	$(COMPOSE) --profile $(DEV_PROFILE) down -v

logs:
	$(COMPOSE) logs -f

status:
	$(COMPOSE) ps

restart:
	$(COMPOSE) restart

pull:
	$(COMPOSE) pull

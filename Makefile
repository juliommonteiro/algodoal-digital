.PHONY: up down logs migrate revision seed test lint fmt front

up:            ## Sobe API + PostgreSQL
	docker compose up -d --build
down:
	docker compose down
logs:
	docker compose logs -f api
migrate:       ## Aplica migrações
	docker compose exec api alembic upgrade head
revision:      ## make revision m="cria tabela places"
	docker compose exec api alembic revision --autogenerate -m "$(m)"
seed:          ## Popula o banco com dados fictícios (make seed args="--reset")
	docker compose exec api python -m scripts.seed $(args)
test:
	docker compose exec api pytest
lint:
	docker compose exec api ruff check . && docker compose exec api ruff format --check .
fmt:
	docker compose exec api ruff format . && docker compose exec api ruff check --fix .
front:         ## Frontend em modo dev (fora do Docker)
	cd frontend && npm install && npm run dev

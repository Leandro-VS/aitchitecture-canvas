.PHONY: up down logs migrate seed test types revision

up: ## sobe a stack completa
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api worker

migrate:
	docker compose exec api alembic upgrade head

revision: ## make revision m="mensagem" — autogenerate a partir dos models
	docker compose exec api alembic revision --autogenerate -m "$(m)"

seed: migrate ## arquétipos + usuário dev
	docker compose exec api python -m blueprint.seed

test: ## backend no host (uv, rápido — imagem da api não tem deps de dev); web no container
	cd apps/api && uv run pytest --cov=blueprint
	docker compose exec web pnpm test

types: ## gera apps/web/src/types a partir dos schemas Pydantic
	docker compose exec api python -m blueprint.schemas.export --out /tmp/schemas
	docker cp $$(docker compose ps -q api):/tmp/schemas/. ./packages/schemas/
	docker compose exec web pnpm types

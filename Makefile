.PHONY: dev-backend dev-frontend dev-all prod prod-down migrate migrate-rollback seed test test-backend test-frontend test-unit lint lint-fix build logs db-shell

# === Development (inside Dev Container) ===

dev-backend:
	cd backend && pnpm dev

dev-frontend:
	cd frontend && pnpm dev --host

dev-all:
	@echo "Avvia backend e frontend in terminali separati:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"

# === Production (Docker) ===

prod:
	docker-compose -f docker/docker-compose.prod.yml up --build -d

prod-down:
	docker-compose -f docker/docker-compose.prod.yml down

# === Database ===

migrate:
	cd backend && pnpm migrate

migrate-rollback:
	cd backend && pnpm migrate:rollback

seed:
	cd backend && pnpm seed

db-shell:
	docker exec -it $$(docker ps -qf "name=postgres") psql -U officino_user -d officino

# === Testing & Linting ===

# Esegue ENTRAMBE le suite. Il target eseguiva solo il backend, e per questo i
# test del frontend — che esistono da tempo — non venivano mai lanciati: hanno
# smesso di passare senza che nessuno se ne accorgesse.
test: test-backend test-frontend

test-backend:
	cd backend && pnpm test

test-frontend:
	cd frontend && pnpm test

test-unit:
	cd backend && pnpm test -- --testPathPattern='tests/unit'

lint:
	cd backend && pnpm lint && cd ../frontend && pnpm lint

lint-fix:
	cd backend && pnpm lint:fix && cd ../frontend && pnpm lint:fix

build:
	cd frontend && pnpm build

# === Logs ===

logs:
	docker-compose -f docker/docker-compose.prod.yml logs -f

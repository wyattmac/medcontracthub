# MedContractHub Docker Management Makefile
.PHONY: help dev staging prod build clean logs status backup shell test

# Default target
help: ## Show this help message
	@echo "MedContractHub Docker Management"
	@echo "================================"
	@echo ""
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development commands
dev: ## Start development environment
	@echo "🔥 Starting development environment..."
	./docker-scripts.sh start dev

dev-build: ## Build development environment
	@echo "🔨 Building development environment..."
	./docker-scripts.sh build dev

dev-logs: ## View development logs
	./docker-scripts.sh logs dev

dev-shell: ## Open shell in development container
	./docker-scripts.sh shell dev

# Staging commands
staging: ## Start staging environment
	@echo "🧪 Starting staging environment..."
	./docker-scripts.sh start staging

staging-build: ## Build staging environment
	@echo "🔨 Building staging environment..."
	./docker-scripts.sh build staging

staging-logs: ## View staging logs
	./docker-scripts.sh logs staging

staging-shell: ## Open shell in staging container
	./docker-scripts.sh shell staging

# Production commands
prod: ## Start production environment
	@echo "🚀 Starting production environment..."
	./docker-scripts.sh start prod

prod-build: ## Build production environment
	@echo "🔨 Building production environment..."
	./docker-scripts.sh build prod

prod-logs: ## View production logs
	./docker-scripts.sh logs prod

prod-shell: ## Open shell in production container
	./docker-scripts.sh shell prod

# General commands
build: ## Build all environments
	@echo "🔨 Building all environments..."
	./docker-scripts.sh build all

clean: ## Clean all environments (removes containers and volumes)
	@echo "🧹 Cleaning all environments..."
	./docker-scripts.sh clean all

status: ## Check status of all environments
	@echo "📊 Checking environment status..."
	./docker-scripts.sh status all

logs: ## View logs for all running containers
	@echo "📋 Viewing all logs..."
	docker-compose -f docker-compose.multi-env.yml logs -f

stop: ## Stop all environments
	@echo "🛑 Stopping all environments..."
	./docker-scripts.sh stop all

restart: ## Restart all environments
	@echo "🔄 Restarting all environments..."
	./docker-scripts.sh stop all
	./docker-scripts.sh start all

# Database commands
backup-dev: ## Backup development database
	./docker-scripts.sh backup dev

backup-staging: ## Backup staging database
	./docker-scripts.sh backup staging

backup-prod: ## Backup production database
	./docker-scripts.sh backup prod

migrate-dev: ## Run migrations on development
	./docker-scripts.sh migrate dev

migrate-staging: ## Run migrations on staging
	./docker-scripts.sh migrate staging

migrate-prod: ## Run migrations on production (with confirmation)
	./docker-scripts.sh migrate prod

# Testing commands
test: ## Run all environment tests
	@echo "🧪 Running environment tests..."
	./easy-docker.sh

test-build: ## Test production build without starting
	@echo "🔧 Testing production build..."
	docker-compose -f docker-compose.multi-env.yml build prod-app

# Quick commands
quick-dev: ## Quick start development (most common)
	@echo "⚡ Quick starting development..."
	./easy-docker.sh

quick-test: ## Quick test all environments
	@echo "⚡ Quick testing all environments..."
	./test-all-docker.sh

# Maintenance commands
update: ## Update and rebuild all images
	@echo "📦 Updating all images..."
	docker-compose -f docker-compose.multi-env.yml pull
	docker-compose -f docker-compose.multi-env.yml build --no-cache

prune: ## Clean up unused Docker resources
	@echo "🧹 Pruning unused Docker resources..."
	docker system prune -f
	docker volume prune -f

# Security scan (if needed)
security-scan: ## Run security scan on production image
	@echo "🔒 Running security scan..."
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		-v $(pwd):/tmp/trivy-ci-test:ro \
		aquasec/trivy image medcontracthub_prod-app:latest

# Health check
health-check: ## Check health of all running services
	@echo "🏥 Checking service health..."
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep medcontract || echo "No containers running"
	@echo ""
	@echo "Testing endpoints:"
	@curl -f http://localhost:3000/api/health 2>/dev/null && echo "✅ Dev: http://localhost:3000" || echo "❌ Dev: Not responding"
	@curl -f http://localhost:3001/api/health 2>/dev/null && echo "✅ Staging: http://localhost:3001" || echo "❌ Staging: Not responding"
	@curl -f http://localhost:3002/api/health 2>/dev/null && echo "✅ Production: http://localhost:3002" || echo "❌ Production: Not responding"
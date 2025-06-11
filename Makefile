# MedContractHub Docker & Kubernetes Management Makefile
.PHONY: help dev staging prod build clean logs status backup shell test
.PHONY: k8s-setup k8s-dev k8s-staging k8s-prod k8s-status k8s-logs k8s-shell k8s-forward k8s-clean k8s-test

# Default target
help: ## Show this help message
	@echo "MedContractHub Docker & Kubernetes Management"
	@echo "============================================="
	@echo ""
	@echo "🐳 Docker Commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / && !/^k8s-/ {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "☸️  Kubernetes Commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^k8s-[a-zA-Z_-]+:.*?## / {printf "  \033[35m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

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

# ====================================
# Kubernetes Commands
# ====================================

# Kubernetes setup and deployment
k8s-setup: ## Complete Kubernetes setup (namespaces, ingress, secrets, etc.)
	@echo "☸️  Running complete Kubernetes setup..."
	@chmod +x k8s/scripts/setup-complete-k8s.sh
	@./k8s/scripts/setup-complete-k8s.sh

k8s-dev: ## Deploy to Kubernetes development environment
	@echo "☸️  Deploying to Kubernetes development..."
	kubectl apply -k k8s/overlays/dev/
	@echo "⏳ Waiting for deployments..."
	kubectl wait --for=condition=available --timeout=300s deployment --all -n medcontracthub
	@echo "✅ Development deployment complete!"

k8s-staging: ## Deploy to Kubernetes staging environment
	@echo "☸️  Deploying to Kubernetes staging..."
	kubectl apply -k k8s/overlays/staging/
	kubectl wait --for=condition=available --timeout=300s deployment --all -n medcontract-staging
	@echo "✅ Staging deployment complete!"

k8s-prod: ## Deploy to Kubernetes production environment
	@echo "☸️  Deploying to Kubernetes production..."
	@echo "⚠️  This will deploy to PRODUCTION. Are you sure? [y/N]"
	@read -p "" -n 1 -r; echo; if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		kubectl apply -k k8s/overlays/prod/; \
		kubectl wait --for=condition=available --timeout=600s deployment --all -n medcontract-prod; \
		echo "✅ Production deployment complete!"; \
	else \
		echo "❌ Production deployment cancelled."; \
	fi

# Kubernetes management
k8s-status: ## Show Kubernetes cluster status
	@echo "☸️  Kubernetes Cluster Status"
	@echo "============================"
	@echo "📊 Nodes:"
	@kubectl get nodes
	@echo ""
	@echo "📦 Deployments (all namespaces):"
	@kubectl get deployments -A | grep medcontract
	@echo ""
	@echo "🚀 Pods (all namespaces):"
	@kubectl get pods -A | grep medcontract
	@echo ""
	@echo "🌐 Services (all namespaces):"
	@kubectl get services -A | grep medcontract
	@echo ""
	@echo "🔗 Ingresses:"
	@kubectl get ingress -A | grep medcontract

k8s-logs: ## Tail logs from Kubernetes pods (usage: make k8s-logs SERVICE=ai-service)
	@if [ -z "$(SERVICE)" ]; then \
		echo "☸️  Tailing all logs in medcontracthub namespace..."; \
		kubectl logs -f -n medcontracthub --all-containers=true --prefix=true --tail=50; \
	else \
		echo "☸️  Tailing logs for $(SERVICE)..."; \
		kubectl logs -f -n medcontracthub -l app=$(SERVICE) --all-containers=true --prefix=true --tail=100; \
	fi

k8s-shell: ## Open shell in Kubernetes pod (usage: make k8s-shell POD=ai-service-xxx)
	@if [ -z "$(POD)" ]; then \
		echo "☸️  Available pods:"; \
		kubectl get pods -n medcontracthub; \
		echo ""; \
		echo "Usage: make k8s-shell POD=<pod-name>"; \
	else \
		echo "☸️  Opening shell in $(POD)..."; \
		kubectl exec -it -n medcontracthub $(POD) -- /bin/sh; \
	fi

k8s-forward: ## Port forward Kubernetes service (usage: make k8s-forward SERVICE=ai-service PORT=8200)
	@if [ -z "$(SERVICE)" ] || [ -z "$(PORT)" ]; then \
		echo "☸️  Port forwarding options:"; \
		echo "  make k8s-forward SERVICE=medcontracthub-app PORT=3000"; \
		echo "  make k8s-forward SERVICE=ai-service PORT=8200"; \
		echo "  make k8s-forward SERVICE=analytics-service PORT=8300"; \
		echo "  make k8s-forward SERVICE=realtime-service PORT=8400"; \
		echo "  make k8s-forward SERVICE=kong-proxy PORT=8080"; \
		echo "  make k8s-forward SERVICE=grafana PORT=3000 NAMESPACE=monitoring"; \
	else \
		NAMESPACE=$${NAMESPACE:-medcontracthub}; \
		echo "☸️  Forwarding localhost:$(PORT) -> $(SERVICE):$(PORT) in $$NAMESPACE..."; \
		kubectl port-forward -n $$NAMESPACE svc/$(SERVICE) $(PORT):$(PORT); \
	fi

k8s-clean: ## Clean up Kubernetes resources
	@echo "☸️  Cleaning up Kubernetes resources..."
	@echo "⚠️  This will DELETE all resources. Are you sure? [y/N]"
	@read -p "" -n 1 -r; echo; if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		kubectl delete -k k8s/overlays/dev/ --ignore-not-found=true; \
		kubectl delete -k k8s/overlays/staging/ --ignore-not-found=true; \
		echo "✅ Kubernetes cleanup complete!"; \
	else \
		echo "❌ Cleanup cancelled."; \
	fi

# ====================================
# Security Commands
# ====================================

security-setup: ## Set up all security components (OPA, Falco, PSS, etc.)
	@echo "🔒 Setting up security components..."
	@chmod +x k8s/scripts/setup-security.sh
	@./k8s/scripts/setup-security.sh

security-scan: ## Run security scans on the cluster
	@echo "🔍 Running security scans..."
	@echo "📊 Vulnerability scan:"
	@kubectl get vulnerabilityreports -A
	@echo ""
	@echo "🚨 OPA Policy violations:"
	@kubectl get constraints -A
	@echo ""
	@echo "🔐 Pod Security violations:"
	@kubectl get events -A | grep -i "violates PodSecurity" || echo "No violations found"

security-audit: ## Run security audit and compliance checks
	@echo "📋 Running security audit..."
	@kubectl apply -f k8s/scripts/security-audit-job.yaml
	@kubectl wait --for=condition=complete job/security-audit --timeout=300s
	@kubectl logs job/security-audit
	@kubectl delete job security-audit

falco-logs: ## View Falco security alerts
	@echo "🚨 Falco Security Alerts (last 100 lines):"
	@kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=100 | grep -E "Warning|Error|Critical" || echo "No alerts found"

compliance-check: ## Check HIPAA and FedRAMP compliance status
	@echo "✅ Checking compliance status..."
	@echo ""
	@echo "🏥 HIPAA Compliance:"
	@kubectl get configmaps -l compliance=hipaa --sort-by='.metadata.creationTimestamp' | tail -5
	@echo ""
	@echo "🏛️ FedRAMP Compliance:"
	@kubectl get configmaps -l compliance=fedramp --sort-by='.metadata.creationTimestamp' | tail -5

security-incident: ## Open security incident response runbook
	@echo "📖 Opening security incident response runbook..."
	@cat k8s/runbooks/security-incident-response.md | less

k8s-test: ## Test Kubernetes deployment health
	@echo "☸️  Testing Kubernetes deployment..."
	@./k8s/scripts/test-k8s-deployment.sh

# Kubernetes utilities
k8s-scale: ## Scale Kubernetes deployment (usage: make k8s-scale DEPLOYMENT=ai-service REPLICAS=5)
	@if [ -z "$(DEPLOYMENT)" ] || [ -z "$(REPLICAS)" ]; then \
		echo "Usage: make k8s-scale DEPLOYMENT=<name> REPLICAS=<count>"; \
	else \
		echo "☸️  Scaling $(DEPLOYMENT) to $(REPLICAS) replicas..."; \
		kubectl scale deployment/$(DEPLOYMENT) --replicas=$(REPLICAS) -n medcontracthub; \
	fi

k8s-restart: ## Restart Kubernetes deployment (usage: make k8s-restart DEPLOYMENT=ai-service)
	@if [ -z "$(DEPLOYMENT)" ]; then \
		echo "☸️  Restarting all deployments..."; \
		kubectl rollout restart deployment -n medcontracthub; \
	else \
		echo "☸️  Restarting $(DEPLOYMENT)..."; \
		kubectl rollout restart deployment/$(DEPLOYMENT) -n medcontracthub; \
	fi
	@echo "⏳ Waiting for rollout to complete..."
	@kubectl rollout status deployment/$(DEPLOYMENT) -n medcontracthub

k8s-describe: ## Describe Kubernetes resource (usage: make k8s-describe TYPE=pod NAME=ai-service-xxx)
	@if [ -z "$(TYPE)" ] || [ -z "$(NAME)" ]; then \
		echo "Usage: make k8s-describe TYPE=<pod|service|deployment> NAME=<resource-name>"; \
	else \
		kubectl describe $(TYPE)/$(NAME) -n medcontracthub; \
	fi

k8s-events: ## Show recent Kubernetes events
	@echo "☸️  Recent Kubernetes events:"
	kubectl get events -n medcontracthub --sort-by='.lastTimestamp' | tail -20

k8s-top: ## Show resource usage for pods
	@echo "☸️  Resource usage:"
	kubectl top nodes
	@echo ""
	kubectl top pods -n medcontracthub

# Skaffold development
skaffold-dev: ## Start Skaffold development mode with hot reload
	@echo "🔥 Starting Skaffold development mode..."
	skaffold dev --port-forward

skaffold-run: ## Deploy with Skaffold (one-time)
	@echo "☸️  Deploying with Skaffold..."
	skaffold run

skaffold-delete: ## Delete Skaffold deployment
	@echo "☸️  Deleting Skaffold deployment..."
	skaffold delete

# Production setup commands
k8s-setup-harbor: ## Set up Harbor container registry
	@echo "🚢 Setting up Harbor container registry..."
	@chmod +x k8s/scripts/setup-harbor.sh
	@./k8s/scripts/setup-harbor.sh

k8s-setup-eso: ## Set up External Secrets Operator
	@echo "🔐 Setting up External Secrets Operator..."
	@chmod +x k8s/scripts/setup-external-secrets.sh
	@./k8s/scripts/setup-external-secrets.sh

k8s-setup-prod-tls: ## Set up production TLS certificates
	@echo "🔒 Setting up production TLS..."
	kubectl apply -f k8s/base/cert-manager/cluster-issuer-prod.yaml
	kubectl apply -f k8s/base/ingress/production-ingress.yaml
	@echo "✅ Production TLS configuration applied!"

k8s-prod-readiness: ## Check production readiness
	@echo "🔍 Checking production readiness..."
	@chmod +x k8s/scripts/check-prod-readiness.sh
	@./k8s/scripts/check-prod-readiness.sh

k8s-migrate-images: ## Migrate images to production registry
	@echo "📦 Migrating images to production registry..."
	@chmod +x k8s/scripts/migrate-images.sh
	@./k8s/scripts/migrate-images.sh

# Monitoring and observability
k8s-setup-monitoring: ## Set up complete monitoring stack (Prometheus, Grafana, ELK, Jaeger)
	@echo "📊 Setting up monitoring stack..."
	@chmod +x k8s/scripts/setup-monitoring.sh
	@./k8s/scripts/setup-monitoring.sh

k8s-port-forward-grafana: ## Access Grafana locally
	@echo "🔗 Port forwarding Grafana..."
	kubectl port-forward -n monitoring svc/prometheus-stack-grafana 3030:80

k8s-port-forward-kibana: ## Access Kibana locally
	@echo "🔗 Port forwarding Kibana..."
	kubectl port-forward -n logging svc/kibana-kibana 5601:5601

k8s-check-alerts: ## Check active Prometheus alerts
	@echo "🚨 Active alerts:"
	@kubectl exec -it -n monitoring deployment/prometheus-stack-kube-prom-prometheus -- \
		promtool query instant 'ALERTS{alertstate="firing"}'

k8s-logs-structured: ## View structured logs from all services
	@echo "📋 Structured logs:"
	@kubectl logs -n medcontracthub -l app.kubernetes.io/part-of=medcontracthub --tail=50 | jq

# CI/CD and GitOps
k8s-setup-argocd: ## Set up ArgoCD for GitOps
	@echo "🚀 Setting up ArgoCD..."
	@chmod +x k8s/scripts/setup-argocd.sh
	@./k8s/scripts/setup-argocd.sh

k8s-run-tests: ## Run comprehensive Kubernetes test suite
	@echo "🧪 Running Kubernetes tests..."
	@chmod +x k8s/scripts/run-k8s-tests.sh
	@./k8s/scripts/run-k8s-tests.sh

k8s-test-contracts: ## Run API contract tests
	@echo "📝 Running contract tests..."
	kubectl apply -f tests/k8s/contract-test.yaml
	kubectl wait --for=condition=complete job/contract-tests -n test --timeout=300s
	kubectl logs job/contract-tests -n test

k8s-test-load: ## Run load tests with K6
	@echo "📊 Running load tests..."
	kubectl apply -f tests/k8s/load-test.yaml
	kubectl wait --for=condition=complete job/k6-load-test -n test --timeout=1200s
	kubectl logs job/k6-load-test -n test

k8s-test-chaos: ## Run chaos engineering tests
	@echo "🌪️  Running chaos tests..."
	kubectl apply -f tests/k8s/chaos-test.yaml
	@echo "Monitor chaos experiments in Litmus dashboard"

argocd-sync: ## Sync all ArgoCD applications
	@echo "🔄 Syncing ArgoCD applications..."
	argocd app sync medcontracthub-platform --prune

argocd-list: ## List all ArgoCD applications
	@echo "📋 ArgoCD applications:"
	argocd app list

argocd-rollback: ## Rollback ArgoCD application (usage: make argocd-rollback APP=app-name)
	@if [ -z "$(APP)" ]; then \
		echo "Usage: make argocd-rollback APP=<app-name>"; \
	else \
		echo "↩️  Rolling back $(APP)..."; \
		argocd app rollback $(APP); \
	fi
# CLAUDE.md - AI Assistant Reference Guide

This document provides essential information for AI assistants working with the MedContractHub Hybrid Intelligence Platform.

## Project Overview

**MedContractHub** is an enterprise-scale hybrid intelligence platform combining human expertise with AI/ML for federal contracting. The system features microservices architecture, event-driven processing, and multi-model AI orchestration.

### Tech Stack
- **Architecture**: Microservices with Kubernetes orchestration
- **Service Mesh**: Istio for communication and observability
- **Event Streaming**: Kafka for distributed messaging
- **AI/ML**: Multi-model system (Claude, GPT, Mistral, Llama)
- **Databases**: PostgreSQL, Redis Cluster, Weaviate, ClickHouse
- **Frontend**: Next.js 15, TypeScript, React, Tailwind CSS
- **Infrastructure**: Kubernetes, Docker, Helm Charts

## ☸️ Kubernetes Setup & Configuration

### Critical Kubernetes Setup Steps

**⚠️ IMPORTANT**: Follow these steps EXACTLY to deploy the hybrid intelligence platform:

#### 1. **Cluster Prerequisites**
```bash
# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Create namespaces
kubectl create namespace medcontract-dev
kubectl create namespace medcontract-staging
kubectl create namespace medcontract-prod

# Enable Istio injection
kubectl label namespace medcontract-dev istio-injection=enabled
```

#### 2. **Deploy Core Infrastructure**
```bash
# Deploy databases
helm install postgresql bitnami/postgresql -n medcontract-dev -f k8s/values/postgresql.yaml
helm install redis bitnami/redis-cluster -n medcontract-dev -f k8s/values/redis.yaml
helm install kafka bitnami/kafka -n medcontract-dev -f k8s/values/kafka.yaml

# Deploy observability stack
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
helm install jaeger jaegertracing/jaeger -n monitoring
```

#### 3. **Deploy Microservices**
```bash
# Apply all service deployments
kubectl apply -f k8s/services/ -n medcontract-dev

# Verify deployments
kubectl get deployments -n medcontract-dev
kubectl get pods -n medcontract-dev
```

#### 4. **Verify Platform Health**
```bash
# Check API Gateway
kubectl port-forward svc/kong-proxy 8080:80 -n medcontract-dev
curl http://localhost:8080/health | jq .

# Verify all services are ready
kubectl get pods -n medcontract-dev -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,READY:.status.conditions[?(@.type=="Ready")].status
```

### Common Kubernetes Issues & Solutions

#### Pod CrashLoopBackOff
**Problem**: Service pods failing to start  
**Solution**: 
```bash
# Check pod logs
kubectl logs <pod-name> -n medcontract-dev --previous

# Verify secrets are mounted
kubectl get secrets -n medcontract-dev
kubectl describe pod <pod-name> -n medcontract-dev

# Check resource limits
kubectl describe node
```

#### Service Mesh Communication Failures
**Problem**: 503 errors between services  
**Solution**:
```bash
# Verify Istio sidecar injection
kubectl get pods -n medcontract-dev -o jsonpath='{.items[*].spec.containers[*].name}' | tr ' ' '\n' | grep istio-proxy

# Check DestinationRules
kubectl get destinationrule -n medcontract-dev

# Debug with Kiali
kubectl port-forward svc/kiali 20001:20001 -n istio-system
```

#### Kafka Event Processing Issues
**Problem**: Events not being consumed  
**Solution**:
```bash
# Check consumer groups
kubectl exec -it kafka-0 -- kafka-consumer-groups.sh --bootstrap-server kafka:9092 --list

# Monitor lag
kubectl exec -it kafka-0 -- kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group <consumer-group>

# Verify topic exists
kubectl exec -it kafka-0 -- kafka-topics.sh --bootstrap-server kafka:9092 --list
```

### Microservices Architecture

**Core Services:**
- `api-gateway` - Kong API Gateway (port 8080)
- `ocr-service` - Document processing with Mistral (port 8100)
- `ai-service` - ML model orchestration (port 8200)
- `analytics-service` - Real-time analytics (port 8300)
- `realtime-service` - WebSocket collaboration (port 8400)
- `worker-service` - Background job processing

**Data Services:**
- `postgresql-primary` - Main database with replicas
- `redis-cluster` - 6-node Redis cluster
- `weaviate` - Vector database cluster
- `kafka-cluster` - Event streaming (3 brokers)
- `clickhouse` - Time-series analytics

### Checking Docker Logs

#### Container Logs
```bash
# Use the Docker logs helper script (recommended for WSL)
./docker-logs.sh app          # Show app logs
./docker-logs.sh postgres     # Show database logs
./docker-logs.sh redis        # Show Redis logs
./docker-logs.sh all          # Show all service logs
./docker-logs.sh follow       # Follow all logs in real-time

# Direct Docker commands (requires DOCKER_HOST export in WSL)
export DOCKER_HOST=unix:///var/run/docker.sock
docker-compose logs -f app         # Application logs
docker-compose logs -f postgres    # Database logs
docker-compose logs -f redis       # Redis logs
docker-compose logs -f worker      # Worker logs

# View all logs
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100 app

# View logs with timestamps
docker-compose logs -t app
```

#### Log Files
```bash
# Check startup logs
cat docker-startup.log

# Check development server logs
cat dev-server.log
cat dev-server-e2e.log

# Helper scripts for logs
./check-docker-logs.sh     # Shows all container logs
./check-docker-status.sh   # Shows container status and health
./docker-logs.sh           # WSL-friendly Docker logs viewer
```

#### WSL Docker Configuration
The project includes a WSL configuration helper at `.bashrc.docker` that sets up Docker aliases.

For persistent Docker access in WSL, add to your `~/.bashrc`:
```bash
export DOCKER_HOST=unix:///var/run/docker.sock
```

#### Available Helper Scripts
- **`./docker-logs.sh`** - WSL-friendly log viewer with automatic Docker host configuration
- **`./check-docker-logs.sh`** - Comprehensive log checker with issue detection
- **`./check-docker-status.sh`** - Container status and health checker
- **`./easy-docker.sh`** - Quick start script for development
- **`.bashrc.docker`** - WSL Docker configuration helper

### Kubernetes Development Commands

#### Multi-Environment Kubernetes Setup

MedContractHub uses namespace-based environment isolation:
- **Development** (medcontract-dev): Hot reload, full observability
- **Staging** (medcontract-staging): Production configs, testing
- **Production** (medcontract-prod): Full scale, multi-region

#### Managing Kubernetes Deployments
```bash
# Deploy to specific environment
make deploy-dev      # Deploy to development
make deploy-staging  # Deploy to staging
make deploy-prod     # Deploy to production

# Kubernetes operations
kubectl get all -n medcontract-dev          # View all resources
kubectl rollout restart deployment/ai-service -n medcontract-dev  # Restart service
kubectl scale deployment/ocr-service --replicas=5 -n medcontract-dev  # Scale service

# View logs
kubectl logs -f deployment/api-gateway -n medcontract-dev
kubectl logs -f pod/ai-service-0 -c ai-service -n medcontract-dev

# Access services locally
kubectl port-forward svc/api-gateway 8080:80 -n medcontract-dev
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

#### Stopping Services
```bash
docker-compose down                  # Stop all services
docker-compose down --volumes        # Stop and remove volumes
docker-compose down --remove-orphans # Clean up orphan containers
```

#### Troubleshooting
```bash
# Check container status
docker-compose ps

# Restart a specific service
docker-compose restart app

# Rebuild containers
docker-compose up -d --build

# Clean up everything
docker system prune -a --volumes

# Test Docker access
./test-docker-access.sh
./test-docker-env.sh
```

## Environment Configuration

### Required Setup
1. Copy `.env.consolidated` to `.env.local`
2. All development API keys are pre-configured
3. Critical setting for OCR testing: `DEVELOPMENT_AUTH_BYPASS=true`

### Port Mappings
- **Development**: 
  - App: 3000
  - PostgreSQL: 5432
  - Redis: 6379
  - Bull Dashboard: 3003
- **Staging**: 
  - App: 3001
  - PostgreSQL: 5433
  - Redis: 6380
- **Production**: 
  - App: 3002 (internal)
  - Nginx: 80/443 (public)
  - Redis: 6381

## Key Features & Workflows

### Hybrid Intelligence Proposal Generation
1. User clicks "Mark for Proposal" on an opportunity
2. Microservices orchestration begins:
   - OCR Service processes documents in parallel
   - AI Service analyzes requirements with multi-model ensemble
   - Analytics Service tracks processing metrics
3. Event-driven workflow via Kafka:
   - DocumentProcessed event triggers AI analysis
   - RequirementsExtracted event updates UI in real-time
   - ProposalGenerated event saves to multiple databases
4. Human-in-the-loop validation for low confidence results
5. Continuous learning from proposal outcomes

### Testing Commands
```bash
# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Run specific test suites
npm run test:unit
npm run test:integration

# Run Puppeteer tests
npm run test:puppeteer
```

### Database Commands
```bash
# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d medcontracthub

# Run migrations
npm run db:migrate

# Check database state
npm run scripts:check-db-state
```

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow existing patterns in the codebase
- No unnecessary comments
- Maintain consistent error handling

### File Organization
- Features in `/features` directory
- Core domain logic in `/core`
- Shared utilities in `/lib`
- UI components in `/components`

### Security Considerations
- Never commit secrets to the repository
- Use environment variables for sensitive data
- Validate and sanitize all user inputs
- Follow RLS policies in Supabase

### Performance Guidelines
- Use Redis caching for expensive operations
- Implement pagination for large datasets
- Optimize database queries with proper indexes
- Monitor with Sentry and performance tools

## Common Issues & Solutions

### Docker Issues
- **Orphan containers**: Run `docker-compose down --remove-orphans`
- **Port conflicts**: Check for services using the same ports
- **Volume permissions**: Ensure proper ownership of mounted volumes

### Database Issues
- **Connection errors**: Check if PostgreSQL container is healthy
- **Migration failures**: Verify database state before running migrations

### Development Issues
- **Module not found**: Run `npm install` or rebuild containers
- **TypeScript errors**: Check for missing type definitions
- **API rate limits**: Monitor quota usage in the dashboard

## Quick Reference

### Docker Setup (First Time)
```bash
# 1. WSL users only
echo 'export DOCKER_HOST=unix:///var/run/docker.sock' >> ~/.bashrc
source ~/.bashrc

# 2. All users - create BOTH environment files
cp .env.consolidated .env.local
cp .env.consolidated .env

# 3. Start Docker
./easy-docker.sh  # Choose option 1

# 4. Verify (wait ~60 seconds first)
curl http://localhost:3000/api/health | jq .
```

### Essential Scripts
```bash
# Development
./easy-docker.sh              # Start everything
docker-compose up -d          # Alternative start
docker restart medcontract-dev # Restart app only

# Testing
npm test                      # Run all tests
./run-critical-journey-test.sh # Run E2E critical path

# Database
npm run scripts:check-db-state # Check database health
npm run db:migrate            # Run migrations

# Monitoring
docker logs medcontract-dev   # View app logs
./docker-logs.sh app          # WSL-friendly logs
./check-docker-status.sh      # Check container health
```

### API Endpoints
- Health Check: `GET /api/health`
- Opportunities: `GET /api/opportunities/search`
- Proposals: `POST /api/proposals`
- Analytics: `GET /api/analytics`

### Environment Variables Reference
See `.env.consolidated` for the complete list of required environment variables.

## Working with Three-Stage Docker Environments

### How Claude Code Interacts with Each Stage

#### 1. Development Stage (Default)
```bash
# Start development environment
./docker-manage.sh start dev

# Claude Code can:
- Make code changes that hot-reload instantly
- Debug with detailed logs
- Test features with local database
- Access at http://localhost:3000

# Common Claude Code commands for dev:
./docker-logs.sh app          # Check application logs
./docker-manage.sh status dev # Verify all services running
docker exec -it medcontract-dev-app npm test  # Run tests in container
```

#### 2. Staging Stage (Testing)
```bash
# Start staging environment
./docker-manage.sh start staging

# Claude Code can:
- Test production builds
- Verify worker processes
- Run integration tests
- Access at http://localhost:3001

# Common Claude Code commands for staging:
./docker-manage.sh logs staging  # View all staging logs
docker exec -it medcontract-staging-app npm run test:e2e  # E2E tests
```

#### 3. Production Stage (Deployment)
```bash
# Start production environment
./docker-manage.sh start prod

# Claude Code can:
- Verify production optimizations
- Check nginx configuration
- Monitor resource usage
- Access at http://localhost (port 80)

# Common Claude Code commands for prod:
./docker-manage.sh status prod   # Check production health
docker stats                     # Monitor resource usage
```

### Claude Code Workflow Examples

#### Example 1: Implementing a New Feature
```bash
# 1. Start in development
./docker-manage.sh start dev

# 2. Make changes (Claude Code will see hot-reload)
# 3. Test the feature
curl http://localhost:3000/api/your-new-endpoint

# 4. Check logs if issues
./docker-logs.sh app

# 5. Once working, test in staging
./docker-manage.sh stop dev
./docker-manage.sh start staging

# 6. Verify production build works
curl http://localhost:3001/api/your-new-endpoint
```

#### Example 2: Debugging an Issue
```bash
# Claude Code can check logs across stages
./docker-manage.sh logs dev      # Development logs
./docker-manage.sh logs staging  # Staging logs
./docker-manage.sh logs prod     # Production logs

# Or use the Docker logs helper
./docker-logs.sh all             # See all service logs
./docker-logs.sh follow          # Follow logs in real-time
```

#### Example 3: Database Operations
```bash
# Development database (local)
docker exec -it medcontract-dev-postgres psql -U postgres -d medcontracthub

# Staging database (isolated)
docker exec -it medcontract-staging-postgres psql -U postgres -d medcontracthub

# Production uses external Supabase (no local container)
```

### Best Practices for Claude Code

1. **Default to Development**: Always start with `dev` unless specifically testing staging/prod features
2. **Check Logs Frequently**: Use `./docker-logs.sh app` to understand what's happening
3. **Verify Changes**: After code changes, always check the health endpoint:
   ```bash
   curl http://localhost:3000/api/health | jq .  # Dev
   curl http://localhost:3001/api/health | jq . # Staging
   curl http://localhost:3002/api/health | jq . # Prod
   ```

4. **Switch Environments Cleanly**:
   ```bash
   ./docker-manage.sh stop dev
   ./docker-manage.sh start staging
   ```

5. **Use Environment-Specific Testing**:
   - Dev: Quick iteration, debugging
   - Staging: Integration tests, performance checks
   - Prod: Final verification, load testing

### Quick Reference for Claude Code

```bash
# See what's running
./docker-manage.sh status dev

# Follow logs while coding
./docker-logs.sh follow

# Quick health check
curl http://localhost:3000/api/health | jq .

# Access container shell
docker exec -it medcontract-dev-app sh

# Run commands in container
docker exec medcontract-dev-app npm run lint
docker exec medcontract-dev-app npm test
```

## Notes for AI Assistants

1. **Always check existing patterns** before implementing new features
2. **Use the TodoWrite tool** for complex multi-step tasks
3. **Reference line numbers** when discussing code (e.g., `file.ts:42`)
4. **Run tests** after making changes
5. **Check Docker logs** when debugging issues
6. **Follow security best practices** - never expose secrets
7. **Maintain the 7-document rule** - don't create new documentation files
8. **Default to development stage** unless specifically asked to work with staging/production
9. **Always verify services are healthy** before testing changes

## Last Updated
This document was created to provide a centralized reference for AI assistants working with the MedContractHub codebase. It should be updated as the project evolves.
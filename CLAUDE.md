# CLAUDE.md - AI Assistant Reference Guide

This document provides essential information for AI assistants working with the MedContractHub codebase.

## Project Overview

**MedContractHub** is a medical equipment sourcing platform that helps suppliers find and respond to government contracts. The system is 99% production-ready with 23,300+ live opportunities.

### Tech Stack
- **Frontend**: Next.js 15, TypeScript, React, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis
- **Infrastructure**: Docker, Docker Compose
- **Architecture**: Clean Architecture + Domain-Driven Design

## Docker Commands Reference

### Docker Log Visibility for Claude Code

✅ **Confirmed**: Claude Code can successfully read Docker logs in WSL environments. This includes:
- Application logs (Next.js, API requests, errors)
- Database logs (PostgreSQL operations)
- Redis logs (cache operations)
- Container health status and startup logs

### Checking Docker Logs

#### Important WSL Setup
When using Docker on WSL (Windows Subsystem for Linux), you need to set the Docker host:
```bash
export DOCKER_HOST=unix:///var/run/docker.sock
```

For permanent configuration, add this line to your `~/.bashrc` file.

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

### Docker Development Commands

#### Three-Stage Docker Environment

MedContractHub uses a consolidated three-stage Docker setup:
- **Development** (Port 3000): Hot reload, local database, debugging tools
- **Staging** (Port 3001): Production build, test database, worker processes
- **Production** (Port 3002 + nginx 80/443): Optimized build, external database, load balancing

#### Managing Docker Environments
```bash
# Primary management script (WSL-optimized)
./docker-manage.sh [command] [environment]

# Commands:
./docker-manage.sh start dev      # Start development environment
./docker-manage.sh start staging  # Start staging environment
./docker-manage.sh start prod     # Start production environment
./docker-manage.sh stop dev       # Stop development environment
./docker-manage.sh logs staging   # View staging logs
./docker-manage.sh status prod    # Check production status
./docker-manage.sh clean dev      # Remove dev containers and volumes

# Quick start for development
./easy-docker.sh                  # Interactive menu for Docker operations
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

### OCR-Enhanced Proposals
1. User clicks "Mark for Proposal" on an opportunity
2. System processes attachments using Mistral AI OCR
3. Extracted data auto-fills proposal forms
4. User reviews and submits proposal

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

### Essential Scripts
```bash
# Development
./easy-docker.sh              # Start everything
npm run dev                   # Start Next.js dev server

# Testing
npm test                      # Run all tests
./run-critical-journey-test.sh # Run E2E critical path

# Database
npm run scripts:check-db-state # Check database health
npm run db:migrate            # Run migrations

# Monitoring
./check-docker-logs.sh        # View all logs
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
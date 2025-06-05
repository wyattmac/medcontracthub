# MedContractHub Docker Production Guide

## 🚀 Complete Docker Setup with Build Optimizations

This guide covers the complete Docker setup for MedContractHub with optimizations for build timeouts, memory issues, and production deployment.

## 📋 Overview

**Fixed Issues:**
- ✅ Build timeout issues with OpenTelemetry/Sentry warnings
- ✅ Memory allocation for large Next.js builds (8GB)
- ✅ Standalone output for optimized Docker images
- ✅ Health checks and resource limits
- ✅ Multi-environment isolation

**Environments:**
- **Development**: Port 3000 (hot-reload, debugging)
- **Staging**: Port 3001 (production build, testing)
- **Production**: Port 3002 (optimized, secure)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │     Staging     │    │   Production    │
│   localhost:3000│    │  localhost:3001 │    │  localhost:3002 │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Hot reload    │    │ • Nginx proxy   │    │ • Nginx + SSL   │
│ • Debug ports   │    │ • Resource lim  │    │ • Rate limiting │
│ • Dev database  │    │ • Health checks │    │ • Monitoring    │
│ • Volume mounts │    │ • SSL ready     │    │ • Auto-restart  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Using Makefile (Recommended)
```bash
# Development
make dev              # Start development
make dev-logs         # View logs
make dev-shell        # Open shell

# Staging  
make staging          # Start staging
make staging-build    # Build staging

# Production
make prod             # Start production
make prod-build       # Build production

# Management
make status           # Check all environments
make backup-dev       # Backup databases
make health-check     # Test all endpoints
```

### Using Scripts
```bash
# Easy GUI menu
./easy-docker.sh

# Advanced management
./docker-scripts.sh start dev
./docker-scripts.sh logs staging
./docker-scripts.sh shell prod
```

## 🔧 Build Optimizations

### Memory & Timeout Fixes
All Dockerfiles now include:
```dockerfile
# Increase Node.js memory for large builds
ENV NODE_OPTIONS="--max-old-space-size=8192"

# Increase npm timeout for dependencies
RUN npm config set timeout 600000
```

### Standalone Output
Next.js config updated for optimized Docker builds:
```javascript
const nextConfig = {
  output: 'standalone',  // Optimized for Docker
  // ... other config
}
```

### Multi-stage Builds
- **Development**: Single stage with hot-reload
- **Staging/Production**: Multi-stage for minimal final image
- **Health checks**: Built-in with wget

## 🐳 Docker Compose Features

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### Data Isolation
- Separate networks: dev-network, staging-network, prod-network
- Separate volumes: dev-redis-data, staging-redis-data, prod-redis-data
- Separate databases: medcontracthub_dev, medcontracthub_staging

## 🌐 Nginx Configuration

### Staging (nginx/staging.conf)
- HTTP only for internal testing
- API rate limiting: 10 req/sec
- Static asset caching: 1 day

### Production (nginx/production.conf)
- SSL/TLS termination
- HSTS and security headers
- Strict rate limiting: 5 req/sec
- Long-term asset caching: 30 days
- CSP headers for security

## 🔒 Security Features

### Container Security
- Non-root user (nextjs:1001)
- Minimal Alpine Linux base
- dumb-init for proper signal handling
- Security headers via Nginx

### Rate Limiting
```nginx
# API endpoints
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Login endpoints  
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
```

### Content Security Policy
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; ...";
```

## 📊 Monitoring & Health

### Health Endpoints
- `/api/health` - Application health
- `/health` - Nginx proxy health

### Logging
```bash
# Real-time logs
make logs

# Specific environment
make dev-logs
make staging-logs  
make prod-logs
```

### Status Monitoring
```bash
# Quick status check
make status

# Detailed health check
make health-check
```

## 💾 Backup & Recovery

### Automated Backups
```bash
# Manual backups
make backup-dev
make backup-staging
make backup-prod

# Automated backup script
./scripts/backup-automation.sh
```

### Backup Features
- Automatic compression (gzip)
- Integrity verification
- 30-day retention policy
- Detailed backup reports

## 🚀 Production Deployment

### Prerequisites
```bash
# 1. Environment variables
cp .env.example .env.production
# Configure production values

# 2. SSL certificates (for production)
mkdir -p ssl/
# Add your certificates

# 3. Database setup
# Configure Supabase production instance
```

### Step-by-Step Deployment

1. **Build and Test Locally**
   ```bash
   make prod-build
   make test-build
   ```

2. **Deploy to Server**
   ```bash
   # Copy files to production server
   rsync -av . user@server:/app/medcontracthub/
   
   # Start production
   make prod
   ```

3. **Verify Deployment**
   ```bash
   make health-check
   make prod-logs
   ```

### Zero-Downtime Updates
```bash
# Build new image
make prod-build

# Rolling update
docker-compose -f docker-compose.multi-env.yml up -d --force-recreate prod-app

# Verify health
make health-check
```

## 📈 Performance Optimizations

### Docker Optimizations
- Multi-stage builds minimize image size
- Standalone Next.js output reduces runtime dependencies
- Alpine Linux base (minimal footprint)
- BuildKit for faster builds

### Runtime Optimizations
- Connection pooling with keepalive
- Gzip compression via Nginx
- Static asset caching
- Resource limits prevent resource exhaustion

### Build Cache
```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
make build
```

## 🛠️ Troubleshooting

### Build Timeout Issues
```bash
# If builds still timeout, increase memory further
ENV NODE_OPTIONS="--max-old-space-size=16384"
```

### Memory Issues
```bash
# Check container memory usage
docker stats

# Increase Docker Desktop memory allocation
# Settings > Resources > Memory: 8GB+
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :3000
lsof -i :3001  
lsof -i :3002

# Stop conflicting services
make stop
```

### Container Issues
```bash
# Reset everything
make clean
make build
make dev

# Check container health
docker ps
make health-check
```

## 📋 Maintenance

### Regular Tasks
```bash
# Weekly cleanup
make prune

# Monthly updates
make update

# Security scans
make security-scan
```

### Backup Schedule
```bash
# Add to crontab for automated backups
0 2 * * * /app/medcontracthub/scripts/backup-automation.sh
```

## 🔗 Useful Commands

```bash
# Quick development start
make quick-dev

# Test all environments
make quick-test

# Emergency stop
make stop

# View all logs
make logs

# System cleanup
make prune

# Complete rebuild
make clean && make build && make dev
```

## 📞 Support

For issues:
1. Check logs: `make logs`
2. Verify health: `make health-check`
3. Review this guide
4. Check Docker Desktop settings (8GB+ memory)
5. Ensure all environment variables are set

The setup is now optimized for production with proper security, monitoring, and zero-downtime deployments! 🚀
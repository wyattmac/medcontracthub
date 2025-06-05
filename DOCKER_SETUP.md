# MedContractHub Docker Setup

## 🚀 Quick Start

This setup provides a complete Docker solution for your Next.js 15.3.3 application with all build issues resolved.

### Development (with Hot Reload)
```bash
# Start development environment
./docker-dev.sh start-dev

# View logs
./docker-dev.sh logs

# Stop environment
./docker-dev.sh stop-dev
```

### Production
```bash
# Build production image
./docker-dev.sh build-prod

# Start production environment
./docker-dev.sh start-prod

# Stop production environment
./docker-dev.sh stop-prod
```

## 🔧 Issues Fixed

### ✅ Build Issues Resolved

1. **useAuth Context Error**: Fixed by adding `AuthProvider` to the main providers chain in `lib/providers.tsx`
2. **OpenTelemetry Warnings**: Suppressed via webpack `ignoreWarnings` in `next.config.js`
3. **Standalone Output**: Working correctly with `output: 'standalone'` in Next.js config
4. **Memory Issues**: Handled with `NODE_OPTIONS="--max-old-space-size=8192"` in all Docker stages

### ✅ Docker Optimizations

1. **Multi-stage builds** for minimal production images
2. **Memory optimization** for large Next.js builds
3. **Health checks** for all services
4. **Hot-reload** support in development
5. **Security** with non-root user and dumb-init

## 📁 Files Created/Updated

### Core Files
- `Dockerfile` - Optimized production build
- `Dockerfile.dev` - Development with hot-reload
- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` - Production environment
- `.dockerignore` - Optimized build context
- `docker-dev.sh` - Helper script for Docker operations

### Configuration Updates
- `lib/providers.tsx` - Added AuthProvider to fix context issues
- `next.config.js` - Added webpack warning suppression
- `nginx/production.conf` - Updated upstream server name

## 🏗️ Architecture

### Development Environment
```
┌─────────────────┐
│   Next.js App   │ ← Hot reload via volume mounts
│   localhost:3000│
└─────────────────┘
         │
┌─────────────────┐
│   PostgreSQL    │ ← Development database
│   localhost:5432│
└─────────────────┘
         │
┌─────────────────┐
│     Redis       │ ← Cache & sessions
│   localhost:6379│
└─────────────────┘
         │
┌─────────────────┐
│  Bull Dashboard │ ← Job queue monitoring
│   localhost:3001│
└─────────────────┘
```

### Production Environment
```
┌─────────────────┐
│     Nginx       │ ← SSL, caching, rate limiting
│   localhost:80  │
└─────────────────┘
         │
┌─────────────────┐
│   Next.js App   │ ← Standalone build
│   (internal)    │
└─────────────────┘
         │
┌─────────────────┐
│     Redis       │ ← Production cache
│   (internal)    │
└─────────────────┘
         │
┌─────────────────┐
│     Worker      │ ← Background jobs
│   (internal)    │
└─────────────────┘
```

## 🛠️ Dockerfile Features

### Production Dockerfile
- **Node.js 20 Alpine** for latest features and security
- **Multi-stage build** (deps → builder → runner)
- **Memory optimization** with 8GB Node.js heap
- **Standalone output** for minimal runtime image
- **Security** with non-root user and dumb-init
- **Health checks** with curl
- **Build caching** for faster rebuilds

### Development Dockerfile
- **Hot-reload support** via volume mounts
- **Memory optimization** for development builds
- **Health checks** for development monitoring
- **Easy debugging** with full dev dependencies

## 🐳 Docker Compose Features

### Development (docker-compose.yml)
- **Hot-reload** with source code volume mounts
- **PostgreSQL 15** with schema initialization
- **Redis 7** with persistence
- **Bull Dashboard** for job monitoring
- **Health checks** for all services
- **Custom network** for service isolation

### Production (docker-compose.prod.yml)
- **Resource limits** for production stability
- **Nginx reverse proxy** with SSL support
- **Redis optimization** with memory limits
- **Background worker** for job processing
- **Production security** and monitoring

## ⚡ Performance Optimizations

### Build Optimizations
- **Memory allocation**: 8GB for Node.js builds
- **Dependency caching**: Separate layer for package.json
- **Build context**: Optimized with .dockerignore
- **Multi-stage builds**: Minimal final image size

### Runtime Optimizations
- **Standalone output**: No unnecessary dependencies
- **Gzip compression**: Via Nginx
- **Resource limits**: CPU and memory constraints
- **Connection pooling**: Redis and database connections

## 🔒 Security Features

### Container Security
- **Non-root user**: nextjs:1001
- **Minimal base image**: Alpine Linux
- **Signal handling**: dumb-init for proper process management
- **Health checks**: Automatic container restart on failure

### Network Security
- **Custom networks**: Isolated service communication
- **Rate limiting**: Nginx-based API protection
- **Security headers**: CSP, HSTS, and more
- **SSL/TLS**: Production HTTPS support

## 📊 Monitoring & Health

### Health Checks
- **Application**: `/api/health` endpoint
- **PostgreSQL**: `pg_isready` check
- **Redis**: `PING` command
- **Nginx**: Health endpoint proxy

### Logging
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f app

# Production logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🚀 Deployment Commands

### Quick Development
```bash
./docker-dev.sh start-dev
```

### Production Deployment
```bash
# 1. Build and test locally
./docker-dev.sh build-prod

# 2. Test production build
./docker-dev.sh start-prod

# 3. Deploy to server
docker save medcontracthub:latest | gzip > medcontracthub.tar.gz
scp medcontracthub.tar.gz server:/app/
ssh server "cd /app && docker load < medcontracthub.tar.gz"
ssh server "cd /app && docker-compose -f docker-compose.prod.yml up -d"
```

## 🛡️ Environment Variables

### Required for Production
```env
# Next.js
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# External APIs
SAM_GOV_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Security
CSRF_SECRET=

# Monitoring
SENTRY_DSN=

# Production Infrastructure
REDIS_URL=
REDIS_PASSWORD=
```

## 🐛 Troubleshooting

### Build Issues
```bash
# Clear build cache
docker builder prune -f

# Rebuild without cache
docker build --no-cache -t medcontracthub:latest .

# Check memory limits
docker system df
docker stats
```

### Runtime Issues
```bash
# Check container health
docker ps
docker inspect <container_id>

# View detailed logs
docker logs <container_id> --details

# Shell into container
docker exec -it <container_id> sh
```

### Common Problems

1. **Build timeout**: Increase Docker Desktop memory to 8GB+
2. **Permission errors**: Ensure Docker daemon is running
3. **Port conflicts**: Stop other services using ports 3000, 5432, 6379
4. **Memory issues**: Check Docker Desktop resource allocation

## 🎯 Next Steps

1. **Start Docker Desktop** and ensure 8GB+ memory allocation
2. **Run development environment**: `./docker-dev.sh start-dev`
3. **Test the application**: Visit http://localhost:3000
4. **Monitor logs**: `./docker-dev.sh logs`
5. **For production**: Update environment variables and run `./docker-dev.sh start-prod`

Your Next.js 15.3.3 application is now fully containerized with all build issues resolved! 🚀
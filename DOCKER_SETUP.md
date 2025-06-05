# Docker Multi-Environment Setup

This setup provides three isolated environments for safe feature development without affecting stable builds.

## 🚀 Quick Start

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Make sure Docker is running

2. **Copy environment variables**
   ```bash
   cp .env.docker.example .env
   # Edit .env with your actual values
   ```

3. **Start an environment**
   ```bash
   # Start development environment
   ./docker-scripts.sh start dev

   # Start staging environment
   ./docker-scripts.sh start staging

   # Start production environment
   ./docker-scripts.sh start prod
   ```

## 🎯 Three-Level Environment Setup

### 1. Development Environment (Port 3000)
- **Purpose**: Active feature development with Claude Code
- **Features**:
  - Hot reload enabled
  - Volume mounting for instant code changes
  - Local PostgreSQL database
  - Separate Redis instance
  - All dev tools available

```bash
# Start development
./docker-scripts.sh start dev

# View logs
./docker-scripts.sh logs dev

# Open shell for debugging
./docker-scripts.sh shell dev
```

### 2. Staging Environment (Port 3001)
- **Purpose**: Testing features before production
- **Features**:
  - Production build
  - Separate database for testing
  - Isolated from development changes
  - Performance testing ready

```bash
# Start staging
./docker-scripts.sh start staging

# Run tests
docker-compose -f docker-compose.multi-env.yml exec staging-app npm test
```

### 3. Production Environment (Port 3002)
- **Purpose**: Stable release version
- **Features**:
  - Optimized production build
  - Security hardened
  - Connected to production Supabase
  - Performance monitoring enabled

```bash
# Start production
./docker-scripts.sh start prod

# Check health
curl http://localhost:3002/api/health
```

## 🛠️ Working with Claude Code

### Safe Feature Development Workflow

1. **Always work in dev environment**
   ```bash
   ./docker-scripts.sh start dev
   ```

2. **Make changes with Claude Code**
   - Your code changes will hot reload automatically
   - Database is isolated from staging/production

3. **Test in staging when ready**
   ```bash
   # Build and deploy to staging
   ./docker-scripts.sh build staging
   ./docker-scripts.sh start staging
   ```

4. **Deploy to production after testing**
   ```bash
   # Only after thorough testing
   ./docker-scripts.sh build prod
   ./docker-scripts.sh start prod
   ```

## 📊 Environment URLs

| Environment | App URL | Redis | Database |
|------------|---------|-------|----------|
| Development | http://localhost:3000 | localhost:6379 | localhost:5432 |
| Staging | http://localhost:3001 | localhost:6380 | localhost:5433 |
| Production | http://localhost:3002 | localhost:6381 | Supabase Cloud |

## 🔧 Common Commands

```bash
# Check status of all environments
./docker-scripts.sh status all

# Stop all environments
./docker-scripts.sh stop all

# Restart an environment
./docker-scripts.sh restart dev

# View real-time logs
./docker-scripts.sh logs dev

# Open shell in container
./docker-scripts.sh shell dev

# Run database migrations
./docker-scripts.sh migrate dev

# Backup database
./docker-scripts.sh backup staging

# Clean up environment (removes data)
./docker-scripts.sh clean dev
```

## 🗄️ Database Management

### Local Development Database
```bash
# Connect to dev database
docker-compose -f docker-compose.multi-env.yml exec dev-db psql -U postgres medcontracthub_dev

# Run migrations
docker-compose -f docker-compose.multi-env.yml exec dev-app npm run migrate
```

### Staging Database
```bash
# Connect to staging database
docker-compose -f docker-compose.multi-env.yml exec staging-db psql -U postgres medcontracthub_staging
```

## 🔍 Debugging

### View container logs
```bash
# All logs for an environment
docker-compose -f docker-compose.multi-env.yml logs dev-app dev-redis dev-db

# Follow logs in real-time
./docker-scripts.sh logs dev
```

### Check container health
```bash
docker-compose -f docker-compose.multi-env.yml ps
```

### Access container shell
```bash
# Development
docker-compose -f docker-compose.multi-env.yml exec dev-app sh

# Run commands inside container
docker-compose -f docker-compose.multi-env.yml exec dev-app npm run lint
```

## 🚨 Important Notes

1. **Data Isolation**: Each environment has its own database and Redis instance
2. **Port Conflicts**: Make sure ports 3000-3002, 5432-5433, 6379-6381 are free
3. **Resource Usage**: Running all three environments uses significant resources
4. **Production Safety**: Production environment connects to real Supabase - be careful!

## 🆘 Troubleshooting

### Port already in use
```bash
# Find process using port
lsof -i :3000

# Or stop all containers
docker-compose -f docker-compose.multi-env.yml down
```

### Permission issues
```bash
# Fix permissions
sudo chown -R $USER:$USER .
```

### Build failures
```bash
# Clean build cache
docker system prune -a
./docker-scripts.sh build dev
```

### Can't connect to database
```bash
# Check if database is running
docker-compose -f docker-compose.multi-env.yml ps dev-db

# View database logs
docker-compose -f docker-compose.multi-env.yml logs dev-db
```

## 🎯 Best Practices

1. **Development First**: Always develop features in the dev environment
2. **Test in Staging**: Thoroughly test in staging before production
3. **Backup Before Deploy**: Always backup production before updates
4. **Monitor Resources**: Use `docker stats` to monitor container resources
5. **Clean Regularly**: Run `docker system prune` weekly to free space

## 🔄 Updating Dependencies

```bash
# Update in development first
docker-compose -f docker-compose.multi-env.yml exec dev-app npm update

# Test thoroughly, then update staging
docker-compose -f docker-compose.multi-env.yml exec staging-app npm update

# Finally update production after verification
docker-compose -f docker-compose.multi-env.yml exec prod-app npm update
```

Now you can safely develop new features with Claude Code without worrying about breaking your stable builds!
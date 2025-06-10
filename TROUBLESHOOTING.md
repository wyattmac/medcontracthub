# Troubleshooting Guide

**Essential bug fixes and solutions for MedContractHub development**

---

## 🔧 Code Quality & Build Issues

### **TypeScript Errors**

**Missing Export Errors:**
```bash
# Error: Module has no exported member 'QuotaExceededError'
# Fix: Add missing exports to lib/errors/types.ts
export class QuotaExceededError extends AppError { ... }
```

**Implicit 'any' Type Errors:**
```bash
# Error: Parameter 'opp' implicitly has an 'any' type
# Fix: Add proper type annotations
function processOpp(opp: OpportunityData) { ... }
```

**Route Handler Type Errors:**
```bash
# Error: 'monitoring' is not assignable to rate limit type
# Fix: Add to enhanced-route-handler.ts
rateLimit?: 'api' | 'auth' | 'search' | 'sync' | 'ai' | 'monitoring'

# Error: Property 'body' does not exist on RouteContext
# Fix: Use sanitizedBody instead
async ({ sanitizedBody }) => { const { action } = sanitizedBody }
```

### **Quick Fix Commands**
```bash
npm run lint -- --fix           # Auto-fix formatting
npm run type-check              # Check TypeScript errors
npm run lint && npm run type-check && npm test  # Pre-commit check
```

---

## 🐳 Docker Issues

### **Environment Variables Not Loading (Most Common Issue)**
```bash
# Problem: "Missing Supabase configuration" errors
# Root Cause: Docker Compose reads .env.local but may need .env as fallback

# Solution 1: Create BOTH environment files (recommended)
cp .env.consolidated .env.local  # Primary file
cp .env.consolidated .env        # Fallback file
docker-compose down && docker-compose up -d --build

# Solution 2: Quick restart if files already exist
docker restart medcontract-dev

# Verify variables loaded correctly:
docker exec medcontract-dev env | grep SUPABASE
# Should show URLs and keys with actual values, not empty

# Solution 3: Force rebuild if still failing
docker-compose down
rm -rf .next node_modules  # Clear caches
cp .env.consolidated .env.local
cp .env.consolidated .env
docker-compose up -d --build
```

### **Container Shows "Unhealthy" Status**
```bash
# Problem: Health check failing
# Common causes: Environment vars missing, Next.js still compiling

# Solution:
# 1. Wait 60-90 seconds for Next.js compilation
# 2. Check logs for specific errors:
docker logs medcontract-dev --tail=100 | grep -i error

# 3. Test health endpoint manually:
curl http://localhost:3000/api/health

# 4. If "Missing Supabase configuration", see above section
# 5. If timeout errors, increase health check start_period in docker-compose.yml
```

### **Port Conflicts**
```bash
# Problem: "Port 3000 already in use"
# Solutions:
lsof -i :3000                   # Find what's using port
kill -9 $(lsof -t -i:3000)     # Kill process using port
make staging                    # Use port 3001 instead
docker-compose down             # Stop containers first
```

### **Container Build Failures**
```bash
# Nuclear solution:
docker-compose down -v          # Stop and remove volumes
docker system prune -f          # Clean Docker cache
docker-compose up --build      # Fresh build
```

### **WSL-Specific Docker Issues**
```bash
# Problem: "Failed to initialize: protocol not available"
# Solution: Set Docker host
export DOCKER_HOST=unix:///var/run/docker.sock
# Add to ~/.bashrc for permanent fix

# Problem: Can't connect to Docker daemon
# Solution: Ensure Docker Desktop is running and WSL integration enabled
```

---

## 🔧 Recent Critical Fixes (December 2024)

### **Next.js Headers Import Issue**
**File**: `lib/sam-gov/quota-manager.ts`
**Problem**: Server-side imports causing client-side execution errors

```typescript
// ❌ Before (caused crashes)
const supabase = createServiceClient()

// ✅ After (safe execution)
if (typeof window === 'undefined') {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = createServiceClient()
}
```

### **Redis Client Import Issue**
**File**: `lib/security/security-monitor.ts`
**Problem**: Using undefined `redisClient` variable

```typescript
// ❌ Before
if (!redisClient || !redisClient.isReady) return

// ✅ After  
const redis = await getRedisClient()
if (!redis || !redis.isReady) return
```

### **API Route Type Errors**
**Files**: `app/api/monitoring/*`
**Problem**: Missing rate limit types and incorrect context usage

```typescript
// ✅ Fixed route handler options
{
  rateLimit: 'monitoring',  // Added to allowed types
  requireAuth: false
}

// ✅ Fixed context usage
async ({ sanitizedBody, sanitizedQuery }) => {
  const { action } = sanitizedBody  // Not 'body'
  const param = sanitizedQuery?.param  // Not 'searchParams'
}
```

---

## 📊 Quick Diagnostic Commands

```bash
# Health Checks
curl http://localhost:3000/api/health     # API health
docker ps                                # Container status
make health-check                        # All services

# Code Quality
npm run lint                             # ESLint check
npm run type-check                       # TypeScript check
npm test                                 # Test suite

# Docker Debug
docker logs medcontract-dev              # App logs
docker exec medcontract-dev env | grep API  # Environment vars
docker stats                             # Resource usage

# Development Server
make dev                                 # Start Docker (port 3000)
make staging                            # Alternative (port 3001)
npm run dev                             # Local server (fallback)
```

---

## 🐳 Docker Setup Checklist

**Quick troubleshooting checklist for Docker issues:**

1. **Environment Files**
   - [ ] Both `.env.local` AND `.env` exist
   - [ ] Both contain Supabase credentials
   - [ ] `DEVELOPMENT_AUTH_BYPASS=true` is set

2. **WSL Setup (Windows only)**
   - [ ] `export DOCKER_HOST=unix:///var/run/docker.sock` is set
   - [ ] Added to `~/.bashrc` for persistence

3. **Container Status**
   - [ ] All containers running: `docker ps`
   - [ ] App container healthy (wait 60s first)
   - [ ] Redis container running

4. **Verification**
   - [ ] Health check passes: `curl http://localhost:3000/api/health | jq .`
   - [ ] Opportunities loaded: `curl http://localhost:3000/api/opportunities/count | jq .`
   - [ ] No errors in logs: `docker logs medcontract-dev --tail=50`

5. **If Still Failing**
   ```bash
   # Complete reset
   docker-compose down -v
   rm -rf .next node_modules
   cp .env.consolidated .env.local
   cp .env.consolidated .env
   docker-compose up -d --build
   ```

---

**Last Updated**: June 2025 | **Focus**: Docker setup and current development blockers
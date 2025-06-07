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

### **Environment Variables Not Loading**
```bash
# Problem: "Missing Supabase configuration" errors
# Solution: Create .env file for Docker Compose
cp .env.consolidated .env
docker-compose down && docker-compose up --build

# Verify variables loaded:
docker exec medcontract-dev env | grep SUPABASE
```

### **Port Conflicts**
```bash
# Problem: "Port 3000 already in use"
# Solutions:
lsof -i :3000                   # Find what's using port
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

**Last Updated**: December 2024 | **Focus**: Current development blockers only
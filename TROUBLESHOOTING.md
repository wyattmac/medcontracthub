# Troubleshooting Guide

**Bug fixes, solutions, and operational knowledge for MedContractHub**

> 🔧 **Quick Fix Reference** | 🗄️ **Database Schema** | ⚡ **Performance Solutions** | 🛡️ **Security Patterns**

---

## 🎯 Overview

This guide consolidates all known issues, their solutions, and operational knowledge to prevent regression and accelerate problem resolution. Use this as your first reference when encountering development or production issues.

---

## 🔧 Recent Critical Fixes (December 2024)

### **Next.js Headers Import Issue - SAM.gov Quota Manager**
**Issue**: Server-side imports causing client-side execution errors in Edge runtime
- **File**: `lib/sam-gov/quota-manager.ts:145-153`
- **Error**: Mixed server/client execution contexts in Next.js 15
- **Impact**: Application crashes with database operation failures

**Root Cause**: Server-side Supabase client imported on client-side causing hydration mismatches.

**Solution**:
```typescript
// ❌ Before (caused crashes)
const supabase = createServiceClient()
await supabase.from('sam_api_usage').insert(...)

// ✅ After (safe execution)
if (typeof window === 'undefined') {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()
    await supabase.from('sam_api_usage').insert(...)
  } catch (error) {
    apiLogger.warn('Failed to record SAM API usage in database', error)
  }
}
```

**Prevention Pattern**:
- Always wrap server-side imports in `typeof window === 'undefined'` checks
- Use dynamic imports for server-only modules
- Include error handling for graceful degradation

---

### **API Performance Optimization**
**Issue**: Opportunities API responding in 17+ seconds
- **Endpoint**: `/api/opportunities/public-search`
- **Problem**: Complex queries with inefficient joins and processing
- **User Impact**: Page timeouts and poor user experience

**Performance Results**:
- **Before**: 17,500ms average response time
- **After**: 426ms average response time  
- **Improvement**: 97% performance gain

**Solutions Applied**:
1. **Query Optimization**: Simplified database queries with selective field loading
2. **Redis Caching**: Implemented intelligent caching with 5-minute TTL
3. **Endpoint Consolidation**: Used existing optimized endpoint instead of creating new complexity
4. **Background Processing**: Moved heavy operations to worker processes

**Lesson**: Don't over-optimize working systems during launch preparation phases.

---

### **Database Schema Discovery & Correction**
**Issue**: New optimized endpoints returning zero results due to incorrect field assumptions

**Actual Database Schema** (verified):
```sql
-- ✅ Correct field names (confirmed in production)
SELECT 
  title,
  agency,              -- Not 'department'
  naics_code,          -- Not 'primary_naics_code'  
  status,              -- Values: 'active', not 'Yes'
  place_of_performance_state  -- Not nested 'office_address'
FROM opportunities;
```

**Common Schema Mistakes**:
```sql
-- ❌ Wrong assumptions that caused failures
SELECT 
  department,          -- Field doesn't exist
  primary_naics_code,  -- Wrong field name
  active,              -- Wrong field name
  office_address       -- Wrong structure
FROM opportunities;
```

**Verification Commands**:
```bash
# Check actual schema structure
curl -s "http://localhost:3000/api/opportunities/public-search?limit=1" | jq '.opportunities[0] | keys'

# Verify record count
curl -s "http://localhost:3000/api/opportunities/count" | jq '.count'
```

**Prevention**: Always verify actual database schema before writing queries.

---

### **Row Level Security (RLS) Authentication**
**Issue**: Enhanced route handlers blocking database access in development
- **Problem**: RLS policies preventing data access with development authentication
- **Symptom**: API endpoints returning zero results despite database containing 23,300+ records
- **Root Cause**: Authentication context not properly passed through enhanced route handler

**Solution**: Used service role client for system operations:
```typescript
// For system operations that bypass RLS
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Best Practice**: Test database access patterns before implementing new authentication layers.

---

## 🗄️ Database Reference

### **Opportunities Table Schema** (Production Verified)
```typescript
interface Opportunity {
  id: string
  title: string
  description: string
  notice_id: string
  agency: string                    // ✅ Not 'department'
  sub_agency: string
  office: string
  naics_code: string               // ✅ Not 'primary_naics_code'  
  naics_description: string
  response_deadline: string
  posted_date: string
  contract_type: string
  set_aside_type: string           // ✅ Not 'set_aside_description'
  status: string                   // ✅ Values: 'active', 'closed', etc.
  award_amount: number
  estimated_value_min: number
  estimated_value_max: number
  place_of_performance_city: string
  place_of_performance_state: string  // ✅ Not nested 'office_address'
  primary_contact_name: string
  primary_contact_email: string
  primary_contact_phone: string
  sam_url: string
  solicitation_number: string
  created_at: string
  updated_at: string
  
  // Computed fields (added by application)
  matchScore?: number              // NAICS-based matching score
  isSaved?: boolean               // User's saved status
}
```

### **Query Performance Patterns**
```sql
-- ✅ Optimized query pattern
SELECT id, title, agency, naics_code, status, posted_date
FROM opportunities 
WHERE status = 'active' 
  AND posted_date > NOW() - INTERVAL '30 days'
ORDER BY posted_date DESC
LIMIT 25 OFFSET 0;

-- ❌ Avoid expensive operations
SELECT * FROM opportunities 
WHERE description ILIKE '%medical%'  -- Full table scan
ORDER BY RANDOM();                   -- Expensive randomization
```

---

## ⚡ Performance Debugging

### **API Response Time Testing**
```bash
# Single endpoint performance test
start=$(date +%s%3N)
curl -s "http://localhost:3000/api/opportunities/public-search?limit=5" > /dev/null
end=$(date +%s%3N)
echo "Response time: $((end - start))ms"

# Expected benchmarks
# ✅ Good: <500ms
# ⚠️ Acceptable: 500-1000ms  
# ❌ Poor: >1000ms
```

### **Database Query Analysis**
```bash
# Check database connectivity
curl -s "http://localhost:3000/api/opportunities/count" | jq '.count'

# Verify record existence
curl -s "http://localhost:3000/api/health" | jq '.database.status'

# Test specific filters
curl -s "http://localhost:3000/api/opportunities/public-search?status=active&limit=1" | jq '.opportunities | length'
```

### **Memory & Resource Monitoring**
```bash
# Docker container resource usage
docker stats medcontract-dev

# Node.js memory usage
curl -s "http://localhost:3000/api/health" | jq '.memory'

# Redis cache status (if available)
docker exec medcontract-redis redis-cli info memory
```

---

## 🛡️ Security Issue Resolution

### **CSRF Token Implementation**
**Issue**: Missing CSRF protection on state-changing operations
**Solution**: Mandatory CSRF validation on all mutations
```typescript
// API route with CSRF protection
export const POST = enhancedRouteHandler.POST(
  async ({ user, supabase, sanitizedBody }) => {
    // CSRF automatically validated by enhanced route handler
    // Implementation here
  },
  { 
    requireAuth: true,
    requireCSRF: true,  // Enforces CSRF token validation
    rateLimit: 'api'
  }
)
```

### **Input Sanitization Patterns**
```typescript
// Client-side sanitization
import DOMPurify from 'dompurify'

const sanitizedContent = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['p', 'strong', 'em'],
  ALLOWED_ATTR: []
})

// Server-side validation with Zod
const inputSchema = z.object({
  title: z.string().max(200).min(1),
  description: z.string().max(5000).min(1)
})
```

---

## 🔄 Development Environment Issues

### **Docker Container Problems**

#### **Container Won't Start**
```bash
# Diagnosis commands
docker ps -a                           # Check container status
docker logs medcontract-dev            # View container logs
make health-check                      # Verify all services

# Common fixes
docker system prune -f                 # Clean up resources
docker-compose down && make dev        # Fresh container start
```

#### **Port Conflicts**
```bash
# Check port usage
lsof -i :3000
netstat -tulpn | grep :3000

# Alternative ports
make staging    # Port 3001
make prod      # Port 3002
```

### **Authentication & Development User**
```bash
# Create development user (bypasses onboarding)
npm run dev-setup

# Verify user creation
curl -s "http://localhost:3000/api/health" | jq '.auth.user'

# Clear development session
curl -s -X POST "http://localhost:3000/api/auth/logout"
```

### **Environment Variable Issues**
```bash
# Validate environment configuration
npm run validate-env

# Check loaded environment
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"

# Common missing variables
CSRF_SECRET=your_32_character_secret    # Required, never use default
SAM_GOV_API_KEY=your_api_key           # Required for opportunity sync
ANTHROPIC_API_KEY=your_claude_key      # Required for AI features
```

---

## 🧪 Testing & Quality Issues

### **TypeScript Compilation Errors**
```bash
# Full type check
npm run type-check

# Common issues and fixes
# 1. Missing type definitions
npm install @types/package-name

# 2. Strict null checks
const value: string | null = getValue()
if (value !== null) {
  // Safe to use value
}

# 3. Dynamic imports in Next.js 15
const { id } = await params  // Always await params
```

### **Test Failures**
```bash
# Run specific test suites
npm test -- --testPathPattern=opportunities
npm run test:e2e -- --project=chromium

# Debug test failures
npm test -- --verbose --no-coverage
npm run test:e2e -- --debug
```

### **ESLint & Prettier Issues**
```bash
# Fix formatting issues
npm run lint -- --fix

# Check specific files
npx eslint src/components/specific-file.tsx
npx prettier --check src/components/
```

---

## 🌐 Production Environment Troubleshooting

### **Database Connection Issues**
```bash
# Test Supabase connectivity
curl -X POST "https://your-project.supabase.co/rest/v1/rpc/health" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"

# Check connection pooling
curl -s "http://localhost:3000/api/health" | jq '.database.connections'
```

### **Redis Cache Problems**
```bash
# Test Redis connectivity
docker exec medcontract-redis redis-cli ping

# Check cache performance
curl -s "http://localhost:3000/api/quota/status" | jq '.performance'

# Clear cache if needed
docker exec medcontract-redis redis-cli FLUSHALL
```

### **API Rate Limiting**
```bash
# Check SAM.gov quota status
curl -s "http://localhost:3000/api/quota/status" | jq '.remaining'

# View rate limit headers
curl -I "http://localhost:3000/api/opportunities/search"

# Expected quotas:
# SAM.gov: 1000 calls/day
# Anthropic: Based on tier
# Stripe: 100 requests/second
```

---

## 🔧 Performance Optimization Solutions

### **Frontend Performance**
- **Virtual Scrolling**: Implemented for lists >1000 items
- **Code Splitting**: Dynamic imports for large components
- **Bundle Analysis**: Use `npm run build -- --analyze`
- **Image Optimization**: Next.js Image component required

### **Backend Performance**
- **Database Indexing**: Applied on frequently queried fields
- **Query Optimization**: Selective field loading and joins
- **Caching Strategy**: Redis with intelligent TTL (5-30 minutes)
- **Background Processing**: Bull.js for heavy operations

### **Monitoring & Alerts**
```bash
# Performance monitoring commands
npm run monitor:test                # Local performance validation
npm run monitor:health-check       # Production health verification

# User journey monitoring
curl -s "http://localhost:3000/api/monitoring/journey" | jq '.status'
```

---

## 📋 Diagnostic Commands Reference

### **Quick Health Check**
```bash
# Application health
curl -s "http://localhost:3000/api/health" | jq '.'

# Database connectivity
curl -s "http://localhost:3000/api/opportunities/count" | jq '.count'

# API performance
time curl -s "http://localhost:3000/api/opportunities/public-search?limit=1" > /dev/null
```

### **Development Environment Validation**
```bash
# Verify all services
make health-check

# Check logs
docker logs medcontract-dev --tail=50
docker logs medcontract-redis --tail=20

# Resource usage
docker stats --no-stream
```

### **Production Readiness Verification**
```bash
# Build verification
npm run build
npm run type-check
npm test

# Security validation
npm audit
npm run lint

# Performance benchmarks
npm run test:e2e -- --project=performance
```

---

## 🆘 Emergency Procedures

### **Application Down**
1. **Check Docker containers**: `docker ps`
2. **Restart services**: `make dev` or `docker-compose restart`
3. **View logs**: `docker logs medcontract-dev`
4. **Database connectivity**: Test Supabase connection
5. **Clear cache**: Redis FLUSHALL if cache corruption suspected

### **Performance Degradation**
1. **API response times**: Test endpoint performance
2. **Database queries**: Check for long-running operations
3. **Memory usage**: Monitor container resources
4. **Cache hit rates**: Verify Redis performance
5. **Background jobs**: Check worker process status

### **Data Integrity Issues**
1. **Database backup**: Verify recent backups exist
2. **Schema validation**: Compare with expected structure
3. **Data verification**: Run count queries on critical tables
4. **Sync status**: Check SAM.gov integration health
5. **Rollback plan**: Document recovery procedures

---

## 📞 Escalation Procedures

### **Internal Issues**
1. **Check this guide first** for known solutions
2. **Review logs** for error patterns and stack traces
3. **Test in isolation** to identify specific component failures
4. **Document new issues** for future reference

### **External Service Issues**
- **Supabase**: Check status.supabase.com
- **SAM.gov**: Verify api.sam.gov availability
- **Anthropic**: Check Anthropic status page
- **Stripe**: Monitor Stripe dashboard

### **Contact Information**
- **Development Issues**: Reference [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **Architecture Questions**: See [ARCHITECTURE.md](./ARCHITECTURE.md)  
- **Production Concerns**: Review [PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md)

---

## 📚 Related Documentation

This troubleshooting guide complements:
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Complete development instructions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and technical decisions
- **[PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md)** - Current priorities and blockers
- **[NAICS_MATCHING_SYSTEM.md](./NAICS_MATCHING_SYSTEM.md)** - Medical industry matching system

**Usage Scenarios**:
- 🐛 **Bug Resolution**: Similar issues and their proven solutions
- 🗄️ **Database Operations**: Schema reference and query patterns
- ⚡ **Performance Issues**: Slow response times and optimization
- 🔧 **Development Setup**: Environment and configuration problems
- 📊 **Production Monitoring**: Health checks and diagnostic procedures

---

**Last Updated**: December 6, 2024 | **Next Review**: After major feature releases or production incidents

---

> **📋 Documentation Rule**: This project maintains exactly 7 documentation files. **No new documentation files may be created.** All documentation updates must be added to existing files: README.md, DEVELOPER_GUIDE.md, ARCHITECTURE.md, DEPLOYMENT.md, TROUBLESHOOTING.md, PRODUCTION_TASKS.md, or NAICS_MATCHING_SYSTEM.md.

> 🔧 **Need immediate help?** Use the diagnostic commands above, then consult the relevant specialized documentation.
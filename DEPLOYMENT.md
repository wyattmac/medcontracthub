# Deployment Guide

**Production deployment and infrastructure setup for MedContractHub**

> 🚀 **Production Ready** | 🐳 **Docker Optimized** | 🔒 **Security Hardened** | 📊 **Monitoring Enabled**

---

## 🎯 Deployment Overview

MedContractHub is designed for enterprise-grade deployment with multi-environment support, comprehensive monitoring, and robust security. This guide covers complete production setup from infrastructure to monitoring.

### **Deployment Status**
- **Production Readiness**: 99% complete
- **Zero TypeScript Errors**: Strict mode compliance
- **Security Hardened**: CSRF protection, input sanitization, RLS
- **Performance Optimized**: <500ms API response times
- **Multi-Environment**: Development, staging, production configurations

---

## 🏗️ Infrastructure Requirements

### **Core Services**

#### **1. Application Server**
- **CPU**: 2+ cores (4+ recommended for production)
- **Memory**: 4GB minimum (8GB+ recommended)
- **Storage**: 20GB+ for application and logs
- **Network**: HTTPS certificate required for production

#### **2. Database - Supabase**
- **Service**: Supabase Pro plan or higher
- **Storage**: 8GB+ for 50k+ opportunities
- **Connections**: Connection pooling enabled
- **Security**: Row Level Security (RLS) configured
- **Backups**: Daily automated backups enabled

#### **3. Cache - Redis**
- **Version**: Redis 6.0+ with persistence
- **Memory**: 2GB+ for optimal caching
- **Configuration**: Password authentication required
- **Persistence**: AOF and RDB backup enabled

#### **4. External API Services**
- **SAM.gov**: Active API key with 1,000 daily quota
- **Anthropic**: Claude API for contract analysis
- **Stripe**: Production keys for billing
- **Resend**: Transactional email service

---

## 🐳 Docker Deployment

### **Multi-Environment Setup**

#### **Development Environment**
```bash
# Start development environment
make dev                    # Port 3000
docker-compose up --build

# Environment file
cp .env.example .env.local
# Configure development API keys
```

#### **Staging Environment**
```bash
# Start staging environment
make staging               # Port 3001
docker-compose -f docker-compose.yml up --build

# Environment configuration
NEXT_PUBLIC_ENV=staging
ENABLE_AI_FEATURES=true
```

#### **Production Environment**
```bash
# Production deployment
make prod                  # Port 3002
docker-compose -f docker-compose.prod.yml up -d

# Production environment
NEXT_PUBLIC_ENV=production
NODE_ENV=production
```

### **Docker Configuration Files**

#### **Production Dockerfile**
```dockerfile
# Multi-stage production build
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

FROM base AS build
COPY . .
RUN npm ci && npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

#### **Docker Compose - Production**
```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis_data:
```

---

## 🔒 Environment Configuration

### **Required Environment Variables**

#### **Core Application**
```bash
# Application Environment
NODE_ENV=production
NEXT_PUBLIC_ENV=production
PORT=3000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ACCESS_TOKEN=your_access_token

# Security Configuration
CSRF_SECRET=your_32_character_random_secret_key
NEXTAUTH_SECRET=your_auth_secret_key
NEXTAUTH_URL=https://yourdomain.com
```

#### **External API Services**
```bash
# Government Data
SAM_GOV_API_KEY=your_samgov_api_key

# AI Services
ANTHROPIC_API_KEY=your_claude_api_key
MISTRAL_API_KEY=your_mistral_api_key

# Payment Processing
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_public
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Communication
RESEND_API_KEY=re_your_resend_api_key

# Optional Enhancements
BRAVE_SEARCH_API_KEY=your_brave_api_key
SENTRY_DSN=your_sentry_dsn
```

#### **Infrastructure**
```bash
# Redis Configuration
REDIS_URL=redis://username:password@host:port/database
REDIS_PASSWORD=your_redis_password

# Background Jobs
SYNC_TOKEN=your_sync_security_token

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
ENABLE_USER_JOURNEY_MONITORING=true
MONITORING_WEBHOOK_URL=https://your-alerts-webhook
```

### **Security Configuration Validation**
```bash
# Validate environment on startup
npm run validate-env

# Check security settings
npm run security-check

# Environment-specific validation
NODE_ENV=production npm run validate-production-env
```

---

## 🛡️ Security Hardening

### **Application Security**

#### **CSRF Protection**
```typescript
// Enabled by default in enhanced route handler
export const POST = enhancedRouteHandler.POST(
  async ({ user, supabase, sanitizedBody }) => {
    // CSRF token automatically validated
  },
  { 
    requireAuth: true,
    requireCSRF: true,
    rateLimit: 'api'
  }
)
```

#### **Input Sanitization**
```typescript
// Client-side sanitization
import DOMPurify from 'dompurify'
const clean = DOMPurify.sanitize(userInput)

// Server-side validation
const schema = z.object({
  title: z.string().max(200).min(1),
  content: z.string().max(5000)
})
```

#### **Rate Limiting**
```typescript
// Tier-based rate limiting
const rateLimits = {
  starter: { requests: 100, window: '15m' },
  professional: { requests: 500, window: '15m' },
  enterprise: { requests: 2000, window: '15m' }
}
```

### **Database Security**

#### **Row Level Security (RLS)**
```sql
-- Enable RLS on all tables
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- User-specific data access
CREATE POLICY "Users can access their own data" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Public data access
CREATE POLICY "Public opportunities readable" ON opportunities
  FOR SELECT USING (status = 'active');
```

#### **Connection Security**
```bash
# SSL enforcement
PGSSLMODE=require

# Connection pooling with limits
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000
```

### **Infrastructure Security**

#### **HTTPS Configuration**
```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

#### **Security Headers**
```typescript
// Next.js middleware security headers
export default function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  return response
}
```

---

## 📊 Monitoring & Observability

### **Application Monitoring**

#### **Health Check Endpoints**
```bash
# Application health
GET /api/health
{
  "status": "healthy",
  "timestamp": "2024-12-06T20:00:00Z",
  "database": { "status": "connected", "latency": "45ms" },
  "redis": { "status": "connected", "memory": "2.1GB" },
  "external_apis": {
    "samgov": { "status": "operational", "quota": 756 },
    "anthropic": { "status": "operational" }
  }
}

# Detailed system metrics
GET /api/monitoring/status
```

#### **User Journey Monitoring**
```bash
# Automated monitoring system
npm run monitor:start              # Start continuous monitoring
npm run monitor:status             # Check monitoring status

# Dashboard access
https://yourdomain.com/monitoring
```

#### **Performance Metrics**
```typescript
// Performance tracking
const performanceMetrics = {
  api_response_time: '<500ms',
  page_load_time: '<2s',
  database_query_time: '<100ms',
  cache_hit_rate: '>90%'
}
```

### **Error Monitoring - Sentry**

#### **Sentry Configuration**
```typescript
// Sentry initialization
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter sensitive data
    return event
  }
})
```

#### **Custom Error Tracking**
```typescript
// Application-specific error tracking
import { apiLogger } from '@/lib/errors/logger'

try {
  await riskyOperation()
} catch (error) {
  apiLogger.error('Operation failed', error, {
    userId: user.id,
    operation: 'sync_opportunities'
  })
  throw error
}
```

### **Database Monitoring**

#### **Supabase Metrics**
```bash
# Database performance
curl "https://api.supabase.com/v1/projects/${PROJECT_ID}/metrics" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

# Connection pool status
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

#### **Query Performance**
```sql
-- Slow query monitoring
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;
```

---

## 🚀 Deployment Procedures

### **Pre-Deployment Checklist**

#### **Code Quality Verification**
```bash
# Complete quality check
npm run lint                  # Code style compliance
npm run type-check           # TypeScript validation
npm test                     # Unit test suite
npm run test:e2e            # End-to-end tests
npm run build               # Production build verification
```

#### **Security Validation**
```bash
# Security audit
npm audit --audit-level=moderate
npm run security-check

# Environment validation
npm run validate-production-env

# Dependency verification
npm run check-vulnerabilities
```

#### **Performance Verification**
```bash
# Performance benchmarks
npm run test:performance

# Bundle analysis
npm run build -- --analyze

# API performance testing
npm run test:api-performance
```

### **Deployment Steps**

#### **1. Environment Preparation**
```bash
# Create production environment file
cp .env.production .env.local

# Validate configuration
npm run validate-env

# Database migration
npm run db:migrate:production
```

#### **2. Build & Deploy**
```bash
# Production build
docker build -f Dockerfile.prod -t medcontracthub:latest .

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
make health-check
```

#### **3. Post-Deployment Verification**
```bash
# Health checks
curl https://yourdomain.com/api/health

# User journey validation
npm run monitor:health-check

# Performance verification
curl -w "@curl-format.txt" https://yourdomain.com/opportunities
```

### **Rollback Procedures**

#### **Application Rollback**
```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Deploy previous version
docker-compose -f docker-compose.prod.yml up -d --scale app=0
docker run -d --name medcontracthub-rollback medcontracthub:previous

# Verify rollback
curl https://yourdomain.com/api/health
```

#### **Database Rollback**
```bash
# Restore from backup
supabase db dump --file=backup.sql
supabase db reset --file=backup.sql

# Verify data integrity
npm run verify-data-quality
```

---

## 🔧 Production Optimization

### **Performance Tuning**

#### **Database Optimization**
```sql
-- Essential indexes for production
CREATE INDEX CONCURRENTLY idx_opportunities_naics_active 
ON opportunities(naics_code, status) WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_opportunities_posted_date 
ON opportunities(posted_date DESC) WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_opportunities_deadline 
ON opportunities(response_deadline) WHERE status = 'active';
```

#### **Redis Configuration**
```bash
# Production Redis settings
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### **Application Optimization**
```typescript
// Production-specific optimizations
const config = {
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
    turbotrace: {
      logLevel: 'error'
    }
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
}
```

### **Scaling Configuration**

#### **Horizontal Scaling**
```yaml
# Docker Swarm configuration
version: '3.8'
services:
  app:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

#### **Load Balancer Setup**
```nginx
# Nginx load balancing
upstream medcontracthub {
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    location / {
        proxy_pass http://medcontracthub;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🆘 Disaster Recovery

### **Backup Procedures**

#### **Database Backups**
```bash
# Automated daily backups
supabase db dump --file="backup-$(date +%Y%m%d).sql"

# Backup to cloud storage
aws s3 cp backup.sql s3://medcontracthub-backups/

# Verify backup integrity
supabase db restore --file=backup.sql --dry-run
```

#### **Application Backups**
```bash
# Docker image backup
docker save medcontracthub:latest | gzip > medcontracthub-backup.tar.gz

# Configuration backup
tar -czf config-backup.tar.gz .env* docker-compose*.yml
```

### **Recovery Procedures**

#### **Database Recovery**
```bash
# Full database restore
supabase db reset --file=backup.sql

# Partial data recovery
psql -h host -U user -d database -f selective-restore.sql

# Verify data integrity
npm run verify-data-quality
```

#### **Application Recovery**
```bash
# Restore from backup
docker load < medcontracthub-backup.tar.gz
docker-compose up -d

# Verify application health
npm run monitor:health-check
```

---

## 📋 Maintenance Procedures

### **Regular Maintenance Tasks**

#### **Daily Operations**
```bash
# Health monitoring
curl https://yourdomain.com/api/health | jq '.'

# Performance metrics
docker stats --no-stream

# Log review
docker logs medcontracthub --since=24h | grep ERROR
```

#### **Weekly Maintenance**
```bash
# Security updates
npm audit fix
docker image prune -f

# Database optimization
VACUUM ANALYZE opportunities;
REINDEX INDEX CONCURRENTLY idx_opportunities_naics_active;

# Cache optimization
redis-cli MEMORY PURGE
```

#### **Monthly Reviews**
```bash
# Performance analysis
npm run analyze-performance

# Security audit
npm run security-audit

# Dependency updates
npm update
npm audit
```

### **Monitoring Alerts**

#### **Critical Alerts**
- API response time >2 seconds
- Database connection failures
- Memory usage >90%
- Error rate >5%
- SAM.gov quota <100 remaining

#### **Warning Alerts**
- API response time >1 second
- Memory usage >80%
- Cache hit rate <80%
- Disk usage >85%
- Background job failures

---

## 📞 Production Support

### **Incident Response**

#### **Severity Levels**
- **P0 (Critical)**: Complete service outage
- **P1 (High)**: Major feature broken
- **P2 (Medium)**: Performance degradation
- **P3 (Low)**: Minor issues, cosmetic bugs

#### **Contact Information**
- **On-Call Engineer**: [Contact details]
- **Database Admin**: [Supabase support]
- **Infrastructure**: [Cloud provider support]

### **Documentation References**
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Bug fixes and solutions
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Development procedures
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design reference

---

**Last Updated**: December 6, 2024 | **Next Review**: Quarterly or after major releases

---

> **📋 Documentation Rule**: This project maintains exactly 7 documentation files. **No new documentation files may be created.** All documentation updates must be added to existing files: README.md, DEVELOPER_GUIDE.md, ARCHITECTURE.md, DEPLOYMENT.md, TROUBLESHOOTING.md, PRODUCTION_TASKS.md, or NAICS_MATCHING_SYSTEM.md.

> 🚀 **Ready for production?** Follow the deployment checklist and monitoring procedures above for a successful launch.
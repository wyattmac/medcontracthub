# Production Environment Configuration

This guide covers the complete production environment setup for MedContractHub, including Redis, database connection pooling, and all required services.

## Table of Contents
- [Required Services](#required-services)
- [Environment Variables](#environment-variables)
- [Redis Setup](#redis-setup)
- [Database Connection Pooling](#database-connection-pooling)
- [Health Checks](#health-checks)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Required Services

### 1. Supabase (Database & Auth)
- Production Supabase project
- Service role key for server-side operations
- Row Level Security (RLS) enabled

### 2. Redis (Caching & Rate Limiting)
- Redis 6.0+ recommended
- Persistent storage enabled
- Password authentication required

### 3. External APIs
- SAM.gov API key for contract data
- Anthropic API key for AI analysis
- Resend API key for emails
- Stripe API keys for billing

## Environment Variables

### Quick Setup
1. Copy the production template:
   ```bash
   cp .env.production.example .env.production.local
   ```

2. Fill in all required values

3. Validate your configuration:
   ```bash
   npm run validate:env:production
   ```

### Critical Variables

#### Redis Configuration
```env
# Option 1: Connection URL (recommended)
REDIS_URL=redis://default:your_password@your_redis_host:6379/0

# Option 2: Individual settings
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
REDIS_DB=0
```

#### Database Connection Pooling
```env
# Optimize for your expected load
DB_MAX_CONNECTIONS=25      # Maximum connections in pool
DB_MIN_CONNECTIONS=5       # Minimum idle connections
DB_CONNECTION_TIMEOUT=60000 # Connection timeout (ms)
DB_IDLE_TIMEOUT=300000     # Idle connection timeout (ms)
DB_STATEMENT_TIMEOUT=30000 # Query timeout (ms)
```

#### Security
```env
# Generate strong random values
CSRF_SECRET=$(openssl rand -base64 48)
NEXTAUTH_SECRET=$(openssl rand -base64 48)
```

## Redis Setup

### 1. Redis Cloud (Recommended)
1. Sign up at [Redis Cloud](https://redis.com/cloud/)
2. Create a new database
3. Enable persistence
4. Copy connection details to `REDIS_URL`

### 2. Self-Hosted Redis
```bash
# Docker Compose example
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass your_secure_password --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
volumes:
  redis_data:
```

### 3. Vercel KV (Alternative)
If deploying to Vercel, you can use Vercel KV:
```bash
vercel env add REDIS_URL
```

## Database Connection Pooling

The application automatically manages database connections using our custom pool manager.

### Configuration Guidelines

#### Small Application (< 100 concurrent users)
```env
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=2
```

#### Medium Application (100-1000 concurrent users)
```env
DB_MAX_CONNECTIONS=25
DB_MIN_CONNECTIONS=5
```

#### Large Application (> 1000 concurrent users)
```env
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=10
```

### Monitoring Pool Health
```bash
# Check pool statistics via health endpoint
curl https://your-app.com/api/health?detailed=true
```

## Health Checks

### Basic Health Check
```bash
GET /api/health
```

Returns:
```json
{
  "status": "healthy",
  "database": "healthy",
  "redis": "healthy",
  "connectionPool": "healthy"
}
```

### Detailed Health Check
```bash
GET /api/health?detailed=true
```

Returns comprehensive service status including:
- All service connections
- Configuration validation
- Response times
- Error details

## Monitoring

### 1. Application Metrics
Monitor these key metrics:
- Redis connection pool size
- Database connection pool utilization
- API response times
- Error rates

### 2. Alerts to Configure
- Redis connection failures
- Database pool exhaustion
- High error rates
- Slow query performance

### 3. Dashboards
Create monitoring dashboards for:
```javascript
// Connection Pool Metrics
- Total connections
- Active connections
- Idle connections
- Wait queue length

// Redis Metrics
- Hit rate
- Memory usage
- Connection count
- Command latency

// Application Metrics
- Request rate
- Error rate
- Response time (p50, p95, p99)
- Active users
```

## Performance Optimization

### 1. Redis Optimization
```env
# Enable Redis offline queue for resilience
REDIS_ENABLE_OFFLINE_QUEUE=true

# Tune retry strategy
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=2000
```

### 2. Database Optimization
```env
# Adjust based on Supabase plan limits
DB_STATEMENT_TIMEOUT=30000  # Prevent long-running queries
```

### 3. Caching Strategy
```env
# Tune cache TTLs
CACHE_DEFAULT_TTL=3600         # 1 hour default
CACHE_OPPORTUNITIES_TTL=900    # 15 min for opportunities
CACHE_ANALYSIS_TTL=86400      # 24 hours for AI analysis
```

## Troubleshooting

### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis info
redis-cli -u $REDIS_URL info
```

### Database Pool Issues
1. Check pool statistics in health endpoint
2. Monitor for "Connection timeout - pool exhausted" errors
3. Increase `DB_MAX_CONNECTIONS` if needed

### Common Issues

#### "REDIS_URL not configured"
- Ensure REDIS_URL is set in production environment
- Check for typos in environment variable name

#### "Connection pool exhausted"
- Increase `DB_MAX_CONNECTIONS`
- Check for connection leaks in code
- Monitor long-running queries

#### "Rate limit errors"
- Verify Redis is accessible
- Check Redis memory usage
- Monitor for Redis evictions

## Production Checklist

Before going to production:

- [ ] All required environment variables set
- [ ] Redis configured and accessible
- [ ] Database indexes applied (run `scripts/apply-db-indexes.sh`)
- [ ] Connection pool settings optimized
- [ ] Health checks returning healthy
- [ ] Monitoring dashboards created
- [ ] Alerts configured
- [ ] Backup strategy in place
- [ ] Load testing completed

## Security Considerations

1. **Redis Security**
   - Use strong passwords
   - Enable SSL/TLS if possible
   - Restrict network access
   - Regular security updates

2. **Database Security**
   - Use connection pooling to limit connections
   - Monitor for suspicious queries
   - Regular security audits

3. **Environment Variables**
   - Never commit secrets to git
   - Use secret management service
   - Rotate keys regularly
   - Audit access logs

## Support

For production issues:
1. Check health endpoint: `/api/health?detailed=true`
2. Review application logs
3. Monitor Redis and database metrics
4. Check for recent deployments

Remember to always test configuration changes in staging before applying to production!
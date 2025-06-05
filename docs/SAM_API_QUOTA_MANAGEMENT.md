# SAM.gov API Quota Management System

## Overview
Comprehensive quota management system for SAM.gov API with 1000 daily calls limit. Implements intelligent caching, usage tracking, and optimization strategies to maximize API efficiency.

## Key Components

### 1. Quota Manager (`lib/sam-gov/quota-manager.ts`)
- **Real-time tracking**: Monitors daily/hourly usage with Redis
- **Priority system**: Critical > High > Medium > Low operations  
- **Emergency preservation**: Reserves last 50 calls for critical operations
- **Rate limiting**: 50 calls/hour for smooth distribution

### 2. Enhanced SAM Client (`lib/sam-gov/client.ts`)
- **Quota integration**: All API calls check quota before execution
- **Smart caching**: Extended TTL when quota is low (30 min vs 5 min)
- **Priority parameters**: Operations tagged with priority levels
- **Cache-first approach**: Always check cache before API calls

### 3. Usage Analytics (`app/api/quota/route.ts`)
- **Real-time monitoring**: Live quota status and usage patterns
- **Optimization suggestions**: Actionable recommendations
- **Usage analytics**: By operation, user, time patterns
- **Optimal windows**: Best times for background operations

### 4. Prefetch Manager (`lib/sam-gov/prefetch-manager.ts`)
- **Smart prefetching**: Common queries during low-usage hours
- **User behavior analysis**: Custom tasks based on search patterns
- **Optimal scheduling**: Executes when usage < 50% of average
- **Quota-aware**: Only runs when sufficient quota available

### 5. Database Schema (`supabase/migrations/007_sam_quota_tracking.sql`)
- **Usage tracking**: `sam_api_usage` table with comprehensive logging
- **Analytics functions**: Pre-built queries for usage patterns
- **Automatic cleanup**: 90-day retention with daily cleanup
- **Performance indexes**: Optimized for real-time queries

## Usage Optimization Strategies

### Intelligent Caching
```typescript
// Aggressive caching when quota is low
const cacheTTL = quotaStatus.daily.remaining < 200 ? 1800 : 300 // 30 min vs 5 min
searchCache.set(cacheKey, data, cacheTTL)
```

### Priority-Based Execution
```typescript
await executeWithPriority(
  CallPriority.CRITICAL,  // User searches get highest priority
  'search',
  userId,
  () => samClient.getOpportunities(params)
)
```

### Emergency Preservation
```typescript
// Preserve last 50 calls for critical operations
if (operation !== 'health' && quotaUsage.daily.remaining <= 50) {
  throw new RateLimitError('API quota preserved for critical operations')
}
```

## API Quota Indicators

### User-Facing Components
- **Quota Indicator**: Shows remaining calls with visual progress
- **Warning Alerts**: Displayed when quota is low
- **Critical Alerts**: Emergency mode with cache-only operation

### Dashboard Integration
```tsx
<QuotaIndicator quotaStatus={quotaStatus} />
```

## Configuration

### Quota Thresholds
```typescript
const DEFAULT_CONFIG = {
  dailyLimit: 1000,
  hourlyLimit: 50,
  emergencyThreshold: 50,    // Reserve for critical ops
  warningThreshold: 200      // Start aggressive optimization
}
```

### Cache Settings
```typescript
// Normal operation: 5 minutes
// Low quota: 30 minutes  
// Critical: Use cache only
```

## Expected Performance

### API Usage Reduction
- **50-70% reduction** through intelligent caching
- **Request batching** for multiple NAICS codes
- **Prefetching** during optimal windows (2-6 AM)

### User Experience
- **Zero disruption** during quota management
- **Real-time feedback** on quota status
- **Graceful degradation** when quota is exhausted

### Monitoring & Analytics
- **Live dashboard** with usage patterns
- **Optimization suggestions** with estimated savings
- **Usage analytics** by operation, user, time

## Implementation Status ✅

- [x] Quota manager with Redis tracking
- [x] Enhanced SAM.gov client with quota checks
- [x] Usage analytics and monitoring API
- [x] React components for quota display
- [x] Database schema for usage tracking
- [x] Smart prefetching system
- [x] Priority-based call management
- [x] Emergency preservation logic
- [x] User-facing quota indicators
- [x] Optimization suggestions

## Usage Examples

### Check Quota Before Operation
```typescript
const quotaManager = getSAMQuotaManager()
await quotaManager.checkQuota('search', userId)
```

### Execute with Priority
```typescript
await executeWithPriority(
  CallPriority.HIGH,
  'search', 
  userId,
  () => performSearch(params)
)
```

### Get Quota Status
```typescript
const status = await quotaManager.getQuotaStatus()
console.log(`${status.daily.remaining} calls remaining`)
```

### Smart Prefetching
```typescript
const prefetchManager = getPrefetchManager()
await prefetchManager.executePrefetch() // Runs during optimal windows
```

## Monitoring

### Key Metrics
- Daily/hourly usage tracking
- Cache hit rates
- Operation efficiency scores
- User behavior patterns

### Alerts
- Warning: < 200 calls remaining
- Critical: < 50 calls remaining  
- Emergency: Cache-only mode

### Optimization
- Automatic cache extension
- Background task scheduling
- Request batching
- Prefetch optimization

This system ensures optimal use of the 1000 daily SAM.gov API calls while maintaining excellent user experience.
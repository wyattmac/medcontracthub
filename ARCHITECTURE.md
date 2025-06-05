# MedContractHub Architecture

## 🏗️ Architecture Principles

1. **Domain-Driven Design (DDD)** - Organize by business domains
2. **Feature-First Structure** - Each feature is self-contained
3. **Layered Architecture** - Clear separation of concerns
4. **Performance First** - Optimize for speed and scalability
5. **Developer Experience** - Easy to understand and contribute

## 📁 Proposed Directory Structure

```
medcontracthub/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes group
│   ├── (dashboard)/              # Dashboard routes group
│   └── api/                      # API routes
│
├── core/                         # Core business logic
│   ├── contracts/                # Contract/Opportunity domain
│   │   ├── entities/            # Domain entities
│   │   ├── services/            # Business logic
│   │   ├── repositories/        # Data access
│   │   └── use-cases/           # Application use cases
│   │
│   ├── users/                    # User management domain
│   ├── billing/                  # Billing domain
│   ├── analytics/                # Analytics domain
│   └── ai/                       # AI/ML domain
│
├── infrastructure/               # External services & technical concerns
│   ├── database/                # Database clients & migrations
│   │   ├── supabase/
│   │   └── redis/
│   ├── api-clients/             # External API clients
│   │   ├── sam-gov/
│   │   ├── stripe/
│   │   └── mistral/
│   ├── queue/                   # Job queues
│   ├── cache/                   # Caching layer
│   └── monitoring/              # Logging & monitoring
│
├── features/                     # Feature modules (UI + logic)
│   ├── opportunities/           # Opportunities feature
│   │   ├── components/         # Feature-specific components
│   │   ├── hooks/              # Feature-specific hooks
│   │   ├── api/                # Feature API endpoints
│   │   └── types/              # Feature types
│   │
│   ├── proposals/               # Proposals feature
│   ├── analytics/               # Analytics feature
│   └── settings/                # Settings feature
│
├── shared/                       # Shared across features
│   ├── components/              # Shared UI components
│   │   ├── ui/                 # Base UI components
│   │   └── layouts/            # Layout components
│   ├── hooks/                   # Shared hooks
│   ├── utils/                   # Utility functions
│   ├── types/                   # Shared TypeScript types
│   └── constants/               # App constants
│
└── tests/                        # Test files
    ├── unit/
    ├── integration/
    └── e2e/
```

## 🚀 Performance Optimizations

### 1. Code Splitting Strategy
```typescript
// features/opportunities/components/OpportunitiesPage.tsx
import dynamic from 'next/dynamic'

// Lazy load heavy components
const OpportunitiesTable = dynamic(
  () => import('./OpportunitiesTable'),
  { 
    loading: () => <TableSkeleton />,
    ssr: false // Only for client-heavy components
  }
)

// Parallel load related components
const [Filters, Stats] = await Promise.all([
  import('./Filters'),
  import('./Stats')
])
```

### 2. Data Fetching Patterns
```typescript
// core/contracts/services/OpportunityService.ts
export class OpportunityService {
  // Use React Query for caching
  static queryKeys = {
    all: ['opportunities'] as const,
    lists: () => [...this.queryKeys.all, 'list'] as const,
    list: (filters: OpportunityFilters) => 
      [...this.queryKeys.lists(), filters] as const,
    details: () => [...this.queryKeys.all, 'detail'] as const,
    detail: (id: string) => [...this.queryKeys.details(), id] as const,
  }

  // Prefetch on server
  async prefetchOpportunities(queryClient: QueryClient) {
    await queryClient.prefetchQuery({
      queryKey: OpportunityService.queryKeys.lists(),
      queryFn: () => this.getOpportunities(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }
}
```

### 3. Database Query Optimization
```typescript
// infrastructure/database/supabase/repositories/OpportunityRepository.ts
export class OpportunityRepository {
  async findWithOptimizedQuery(filters: OpportunityFilters) {
    // Use database indexes
    const query = this.supabase
      .from('opportunities')
      .select(`
        id,
        title,
        agency,
        value_amount,
        response_deadline,
        naics_code,
        match_score,
        saved_opportunities!inner(user_id)
      `)
      .eq('active', true)
      .order('match_score', { ascending: false })
      .limit(50)

    // Add filters conditionally
    if (filters.naicsCode) {
      query.contains('naics_codes', [filters.naicsCode])
    }

    return query
  }
}
```

## 🔧 Implementation Guide

### Phase 1: Core Domain Setup
1. Create core business domains
2. Move business logic from API routes to services
3. Implement repository pattern for data access

### Phase 2: Feature Modules
1. Reorganize components by feature
2. Create feature-specific APIs
3. Implement lazy loading

### Phase 3: Infrastructure Layer
1. Centralize external API clients
2. Implement caching strategy
3. Add monitoring and logging

### Phase 4: Testing & Documentation
1. Add unit tests for core services
2. Integration tests for features
3. Update documentation

## 📊 Scalability Considerations

### 1. Microservices Ready
- Each domain can be extracted to a microservice
- Clear boundaries between domains
- API-first design

### 2. Horizontal Scaling
- Stateless services
- Redis for session management
- Queue-based background jobs

### 3. Performance Monitoring
```typescript
// infrastructure/monitoring/performance.ts
export class PerformanceMonitor {
  static async trackApiCall(name: string, fn: () => Promise<any>) {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      
      // Send to monitoring service
      await this.sendMetric({
        name,
        duration,
        success: true
      })
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      await this.sendMetric({
        name,
        duration,
        success: false,
        error
      })
      throw error
    }
  }
}
```

## 🛠️ Developer Experience

### 1. Feature Generator
```bash
# Generate new feature module
npm run generate:feature proposals

# Creates:
# - features/proposals/
# - features/proposals/components/
# - features/proposals/hooks/
# - features/proposals/api/
# - features/proposals/types/
```

### 2. Type Safety
```typescript
// shared/types/api.ts
export type ApiResponse<T> = {
  data: T
  error: null
} | {
  data: null
  error: ApiError
}

// Usage ensures error handling
const result = await api.getOpportunities()
if (result.error) {
  // TypeScript knows data is null here
  handleError(result.error)
} else {
  // TypeScript knows error is null here
  processData(result.data)
}
```

### 3. Testing Strategy
```typescript
// tests/unit/core/contracts/OpportunityService.test.ts
describe('OpportunityService', () => {
  it('should calculate match score correctly', () => {
    const service = new OpportunityService()
    const score = service.calculateMatchScore(
      opportunity,
      companyProfile
    )
    expect(score).toBe(0.85)
  })
})
```

## 🔄 Migration Path

### Week 1: Core Setup
- [ ] Create core directory structure
- [ ] Move business logic to services
- [ ] Implement repository pattern

### Week 2: Feature Modules
- [ ] Reorganize opportunities feature
- [ ] Reorganize proposals feature
- [ ] Update imports

### Week 3: Performance
- [ ] Implement caching
- [ ] Add lazy loading
- [ ] Optimize queries

### Week 4: Testing
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update documentation

## 📈 Expected Benefits

1. **Performance**: 50% faster page loads
2. **Scalability**: Handle 10x more users
3. **Maintainability**: 70% faster feature development
4. **Testing**: 90%+ code coverage
5. **Developer Experience**: New developers productive in 1 day

## 🚦 Success Metrics

- Page Load Time: < 1s
- API Response Time: < 200ms
- Build Time: < 2 minutes
- Test Coverage: > 90%
- Developer Onboarding: < 1 day
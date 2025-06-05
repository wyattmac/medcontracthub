# Architecture Migration Guide

## Overview
This guide helps migrate from the current structure to the new scalable architecture.

## Migration Steps

### Phase 1: Setup Core Domain (Week 1)
- [x] Create directory structure
- [x] Create Opportunity entity
- [x] Create OpportunityService with business logic
- [x] Create OpportunityRepository for data access
- [x] Create CacheService for performance
- [x] Create monitoring services

### Phase 2: Refactor Features (Week 2)
- [ ] Move opportunities components to features/opportunities
- [ ] Create feature-specific hooks
- [ ] Update imports throughout the app
- [ ] Create feature API clients

### Phase 3: Infrastructure (Week 3)
- [x] Setup Redis client
- [x] Setup performance monitoring
- [x] Create centralized logger
- [ ] Setup queue system for background jobs
- [ ] Implement rate limiting

### Phase 4: Testing & Documentation (Week 4)
- [ ] Add unit tests for services
- [ ] Add integration tests
- [ ] Update documentation
- [ ] Create developer onboarding guide

## Example Migration: Opportunities Feature

### Before (Current Structure):
```
app/api/opportunities/search/route.ts
components/dashboard/opportunities/
lib/sam-gov/client.ts
```

### After (New Structure):
```
core/contracts/
  entities/Opportunity.ts
  services/OpportunityService.ts
  repositories/OpportunityRepository.ts
  
features/opportunities/
  components/
  hooks/useOpportunities.ts
  api/opportunityApi.ts
  
app/api/opportunities/search/route.ts (thin wrapper)
```

## Benefits Achieved

1. **Separation of Concerns**
   - Business logic in services
   - Data access in repositories
   - UI logic in features

2. **Performance**
   - Centralized caching
   - Query optimization
   - Performance monitoring

3. **Scalability**
   - Can extract domains to microservices
   - Horizontal scaling ready
   - Queue-based processing

4. **Developer Experience**
   - Clear structure
   - Easy to find code
   - Consistent patterns

## Next Steps

1. Start migrating one feature at a time
2. Update tests as you go
3. Monitor performance improvements
4. Document any issues or learnings

## Code Examples

### Using the New Service Layer:
```typescript
// In API route
import { OpportunityService } from '@/core/contracts/services/OpportunityService'
import { OpportunityRepository } from '@/core/contracts/repositories/OpportunityRepository'
import { CacheService } from '@/infrastructure/cache/CacheService'

const cache = new CacheService(redis)
const repository = new OpportunityRepository(supabase)
const service = new OpportunityService(repository, cache)

const opportunities = await service.searchOpportunities(filters)
```

### Using Feature Hooks:
```typescript
// In React component
import { useOpportunities } from '@/features/opportunities/hooks/useOpportunities'

function OpportunitiesPage() {
  const { data, isLoading, error } = useOpportunities({ 
    naicsCodes: ['123456'] 
  })
  
  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  
  return <OpportunitiesList opportunities={data.opportunities} />
}
```

## Rollback Plan

If issues arise:
1. Keep old code in place during migration
2. Use feature flags to switch between old/new
3. Monitor error rates and performance
4. Can revert by switching feature flags

## Success Metrics

Track these metrics during migration:
- Page load time (target: < 1s)
- API response time (target: < 200ms)
- Error rate (target: < 0.1%)
- Developer productivity (new feature time)

## Questions?

Contact the architecture team or check the documentation.
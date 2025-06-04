# MedContractHub Project Rules

## Quick Context
AI platform for medical distributors to win federal contracts via SAM.gov integration
Stack: Next.js 14, TypeScript, Supabase, Tailwind CSS | Path: /home/locklearwyatt/projects/medcontracthub

## Development Workflow
1. **Before Starting**: Always run `npm test && npm run type-check`
2. **While Coding**: Use TodoWrite to track progress
3. **Before Committing**: Run `npm run lint && npm run type-check`
4. **Commit Style**: Use conventional commits (feat:, fix:, docs:, chore:)

## Status
✅ Auth, SAM.gov (22k+), AI analysis, exports, emails, Brave Search, Mistral OCR
✅ Virtual scrolling, CI/CD pipeline, Redis, Bull.js queues, DB optimization
✅ Stripe integration, Usage metering, Billing dashboard, 14-day trials
✅ All environment variables configured (Stripe, Sentry, CSRF protection)
📊 Production Readiness: 85% (Test Coverage: 6.14% 🔴)

## ✅ Week 1-3 Completed
### Week 1: Foundation
- Memory leak fixes
- Virtual scrolling (22k+ items)
- CI/CD pipeline setup
- Test infrastructure

### Week 2: Infrastructure
- Redis integration
- Bull.js job queues
- Database optimization
- Connection pooling

### Week 3: Revenue
- Stripe integration + webhooks
- Usage metering system
- Billing dashboard
- Trial flow implementation

## Critical Rules
1. **TypeScript strict** - `as any` only for DB compatibility
2. **Custom errors only** - Use `@/lib/errors/types`
3. **Route handler wrapper** - ALL APIs use `routeHandler`
4. **Context7 MCP first** - Research before implementing
5. **Test before commit** - `npm run lint && npm run type-check`

## Structure
```
app/(auth)/          # Public routes
app/(dashboard)/     # Protected routes  
app/api/            # API endpoints (use routeHandler)
components/ui/       # shadcn/ui
lib/errors/         # Error system
lib/supabase/       # DB clients
```

## Code Patterns
```typescript
// API Route (REQUIRED)
export const GET = routeHandler.GET(
  async ({ user, supabase }) => NextResponse.json({ data }),
  { requireAuth: true, validateQuery: zodSchema }
)

// Error Handling
throw new NotFoundError('Opportunity')
const { handleError } = useErrorHandler()
handleError(error, { showToast: true })

// DB Query
const { data, error } = await supabase
  .from('opportunities')
  .select('*')
  .order('created_at', { ascending: false })
```

## Commands
```bash
npm run dev          # Start dev
npm run build        # Build
npm run lint         # Lint
npm run type-check   # TypeScript
npm run db:types     # Generate types
npm test            # Tests
```

## Before Coding
- Check patterns in `components/dashboard/`
- Review `types/database.types.ts`
- Use Context7 MCP for libraries
- Follow `lib/errors/` patterns

## Development Pipeline

### Branch Strategy
- **main**: Production (protected, requires PR)
- **develop**: Staging (auto-deploys)
- **feature/***: Development branches

### Deployment Flow
1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make changes and test: `npm test && npm run type-check`
3. Push and create PR to develop
4. After staging validation, PR to main
5. Production deployment (requires approval)

See [PIPELINE.md](./PIPELINE.md) for complete details.

## MCP Servers
```bash
# GitHub (all changes)
mcp__github__create_branch
mcp__github__push_files  
mcp__github__create_pull_request

# Context7 (research)
mcp__context7__resolve-library-id
mcp__context7__get-library-docs
```

## Environment
```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SAM_GOV_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
CSRF_SECRET= # NEVER use default value
SENTRY_DSN= # Error monitoring
SENTRY_AUTH_TOKEN= # For source maps

# Production (Required for prod)
REDIS_URL=
REDIS_PASSWORD=
DB_MAX_CONNECTIONS=25
DB_MIN_CONNECTIONS=5
DB_CONNECTION_TIMEOUT=60000

# Optional
MISTRAL_API_KEY=
BRAVE_SEARCH_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

## Key Files
- `lib/api/route-handler.ts` - API wrapper
- `lib/errors/types.ts` - Error classes
- `middleware.ts` - Auth protection
- `lib/hooks/useErrorHandler.ts` - Client errors

## 🚨 Production Blockers - The Final 15%

### Critical Issues (Must Fix Before Production)
1. **Test Coverage Crisis**: 6.14% coverage, 14/22 test suites failing
2. **Security Vulnerabilities**: Memory leak in useAuth, hardcoded secrets
3. **Missing Production Config**: No Redis URL, missing DB pool settings
4. **Error Boundaries**: Only root-level, dashboard components can crash app

### Production Readiness Checklist
- [ ] Test coverage > 50% minimum (target 80%)
- [ ] Fix all failing test suites
- [ ] Remove hardcoded secrets (CSRF, API keys)
- [ ] Configure production Redis
- [ ] Add error boundaries to dashboard
- [ ] Complete Sentry monitoring setup
- [ ] Add database indexes
- [ ] Implement health check endpoints

## 🎯 Action Plan - Final Sprint

### Week 1: Critical Blockers (40 hrs)
- [ ] Fix test suite mock errors (8 hrs)
- [ ] Add Stripe integration tests (8 hrs)
- [ ] Fix useAuth memory leak with AbortController (4 hrs)
- [ ] Remove .env from git, update secrets handling (2 hrs)
- [ ] Add error boundaries to dashboard sections (4 hrs)
- [ ] Implement critical path E2E tests (8 hrs)
- [ ] Configure Sentry DSN properly (2 hrs)
- [ ] Add missing database indexes (4 hrs)

### Week 2: Production Configuration (32 hrs)
- [ ] Set up production Redis configuration (4 hrs)
- [ ] Configure DB connection pooling env vars (4 hrs)
- [ ] Implement distributed rate limiting (8 hrs)
- [ ] Add performance monitoring (8 hrs)
- [ ] Create health check endpoints (4 hrs)
- [ ] Update Vercel.json with limits (2 hrs)
- [ ] Fix TypeScript errors in build (2 hrs)

### Week 3: Test Coverage & Monitoring (40 hrs)
- [ ] Increase test coverage to 50% (24 hrs)
- [ ] Add integration tests for API routes (8 hrs)
- [ ] Implement k6 load testing (8 hrs)
- [ ] Create operational dashboards (4 hrs)
- [ ] Document runbooks and procedures (4 hrs)

## 👥 Hiring Priorities (IMMEDIATE)

### 1. QA Engineer (Contract/FT)
- Build comprehensive test suite
- Set up E2E testing with Playwright
- Establish testing best practices
- Budget: $5-8k/month

### 2. DevOps Consultant (2-week contract)
- Set up CI/CD pipeline
- Configure monitoring & logging
- Implement backup strategy
- Redis & queue infrastructure
- Budget: $5-10k total

### 3. Security Auditor (1-week audit)
- HIPAA compliance review
- Penetration testing
- Security best practices
- Budget: $3-5k

## 📊 Performance Targets
- **Page Load**: < 2 seconds
- **Bundle Size**: < 1.5MB
- **API Response**: < 200ms (p95)
- **Test Coverage**: > 80%
- **Uptime**: 99.9%

## 🐛 Critical Issues Status

### 🔴 Active Issues
1. **Test Coverage**: 6.14% (14/22 suites failing)
2. **Memory Leak**: `useAuth` hook missing AbortController
3. **Security**: Hardcoded CSRF secret, .env in git
4. **Error Boundaries**: Missing in dashboard components
5. **Production Config**: No Redis URL, missing DB settings

### ✅ Resolved Issues
1. **Virtual Scrolling**: Implemented with react-window
2. **N+1 Queries**: Fixed with proper joins
3. **Database Optimization**: Connection pooling added
4. **CI/CD Pipeline**: GitHub Actions configured
5. **Stripe Integration**: Completed with webhooks

## Common Fixes
- **Memory leaks**: Add cleanup to all subscriptions
- **Performance**: Use react-window for lists > 100 items
- **N+1 queries**: Batch with `Promise.all()` or dataloader
- **Bundle size**: Dynamic import large dependencies
- **Auth fails**: Check middleware & RLS + cleanup subscriptions
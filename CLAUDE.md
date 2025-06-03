# MedContractHub Project Rules

## Quick Context
AI platform for medical distributors to win federal contracts via SAM.gov integration
Stack: Next.js 14, TypeScript, Supabase, Tailwind CSS | Path: /home/locklearwyatt/projects/medcontracthub

## Status
✅ Auth, SAM.gov (22k+), AI analysis, exports, emails, Brave Search, Mistral OCR
✅ Virtual scrolling, CI/CD pipeline, Redis, Bull.js queues, DB optimization
🚧 Payment integration, Usage metering, Production monitoring
📊 Production Readiness: 85%

## ✅ Week 1-2 Completed
1. **Memory Leaks** - ✅ Fixed
2. **Virtual Scrolling** - ✅ Implemented
3. **CI/CD Pipeline** - ✅ GitHub Actions ready
4. **Redis & Queues** - ✅ Production infrastructure
5. **DB Optimization** - ✅ Query batching & pooling

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

# Optional
MISTRAL_API_KEY=
BRAVE_SEARCH_API_KEY=
SENTRY_DSN=
```

## Key Files
- `lib/api/route-handler.ts` - API wrapper
- `lib/errors/types.ts` - Error classes
- `middleware.ts` - Auth protection
- `lib/hooks/useErrorHandler.ts` - Client errors

## 🎯 30-Day Action Plan

### Week 1: Critical Fixes (IMMEDIATE)
- [ ] Fix memory leaks in useAuth hook (4 hrs)
- [ ] Implement react-window for opportunities list (8 hrs)
- [ ] Write auth & payment critical path tests (8 hrs)
- [ ] Activate Sentry monitoring properly (2 hrs)
- [ ] Fix N+1 queries in opportunities endpoint (4 hrs)

### Week 2: Infrastructure & Scale
- [ ] Set up GitHub Actions CI/CD pipeline (8 hrs)
- [ ] Create staging environment on Vercel (4 hrs)
- [ ] Implement Redis for rate limiting (8 hrs)
- [ ] Add Bull.js job queue for OCR processing (8 hrs)
- [ ] Database query optimization & batching (8 hrs)

### Week 3: Revenue Features
- [ ] Complete Stripe integration + webhooks (16 hrs)
- [ ] Build usage metering for AI features (8 hrs)
- [ ] Implement 14-day trial flow (8 hrs)
- [ ] Create billing & subscription dashboard (8 hrs)

### Week 4: Production Polish
- [ ] Security audit & penetration testing (16 hrs)
- [ ] Load testing with k6 (target 1000 users) (8 hrs)
- [ ] Implement backup strategy (8 hrs)
- [ ] Bundle optimization (target < 1.5MB) (8 hrs)

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

## 🐛 Known Critical Issues
1. **Memory Leak**: `useAuth` hook missing cleanup
2. **N+1 Queries**: Opportunities endpoint (22k queries!)
3. **Bundle Size**: 2.8MB initial load
4. **No Virtual Scrolling**: Browser crash risk
5. **Missing Tests**: 0% coverage = no safety net

## Common Fixes
- **Memory leaks**: Add cleanup to all subscriptions
- **Performance**: Use react-window for lists > 100 items
- **N+1 queries**: Batch with `Promise.all()` or dataloader
- **Bundle size**: Dynamic import large dependencies
- **Auth fails**: Check middleware & RLS + cleanup subscriptions
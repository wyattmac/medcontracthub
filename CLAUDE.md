# MedContractHub Project Rules

## Quick Context
AI platform for medical distributors to win federal contracts via SAM.gov integration
Stack: Next.js 15, TypeScript, Supabase, Tailwind CSS, Docker | Path: /home/locklearwyatt/projects/medcontracthub

## Current Status ✅
✅ Auth, SAM.gov (22k+), AI analysis, exports, emails, Brave Search, Mistral OCR
✅ Virtual scrolling, CI/CD pipeline, Redis, Bull.js queues, DB optimization
✅ Stripe integration, Usage metering, Billing dashboard, 14-day trials
✅ Modern dashboard UI with gradient design and color-coded themes
✅ Docker multi-environment setup with hot reload development
📊 Production Readiness: 100% (Test Coverage: Comprehensive ✅)

## Development Workflow

### Docker Development (Recommended)
```bash
./docker-scripts.sh start dev    # Start development
./docker-scripts.sh logs dev     # View logs
./docker-scripts.sh shell dev    # Access container
```

### Standard Workflow
1. **Before Starting**: `npm test && npm run type-check`
2. **While Coding**: Use TodoWrite to track progress
3. **Before Committing**: `npm run lint && npm run type-check`
4. **Commit Style**: Use conventional commits (feat:, fix:, docs:, chore:)

## Critical Rules
1. **TypeScript strict** - `as any` only for DB compatibility
2. **Custom errors only** - Use `@/lib/errors/types`
3. **Route handler wrapper** - ALL APIs use `routeHandler`
4. **Context7 MCP first** - Research before implementing
5. **Test before commit** - Always run linting and type checking

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
```

## UI Design System
- **Color themes**: Blue (opportunities), Green (saved), Purple (proposals), Amber (value)
- **Gradients**: Use inline CSS for cross-browser compatibility
- **Animations**: `hover:shadow-lg transition-all duration-300 hover:scale-105`
- **Layout**: Responsive with xl:grid-cols-5 for desktop balance

## Structure
```
app/(auth)/          # Public routes
app/(dashboard)/     # Protected routes  
app/api/            # API endpoints (use routeHandler)
components/ui/       # shadcn/ui with custom gradients
lib/errors/         # Error system
lib/supabase/       # DB clients
```

## Commands

### Docker Commands (Recommended)
```bash
./docker-scripts.sh start dev     # Start development
./docker-scripts.sh start staging # Start staging  
./docker-scripts.sh start prod    # Start production
./docker-scripts.sh stop all      # Stop all environments
./docker-scripts.sh logs dev      # View logs
./docker-scripts.sh status all    # Check status
```

### NPM Commands
```bash
npm run dev          # Start dev (local)
npm run build        # Build
npm run lint         # Lint
npm run type-check   # TypeScript
npm test            # Tests
```

## Environment Variables
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
SENTRY_DSN=

# Production
REDIS_URL=
REDIS_PASSWORD=
DB_MAX_CONNECTIONS=25
```

## MCP Servers
- **GitHub**: `mcp__github__*` for all repo operations
- **Context7**: `mcp__context7__*` for library research

## Key Files
- `lib/api/route-handler.ts` - API wrapper
- `lib/errors/types.ts` - Error classes
- `middleware.ts` - Auth protection
- `app/(dashboard)/dashboard/page.tsx` - Modern gradient dashboard

## Docker Environments
- **Development** (port 3000): Hot reload, isolated DB
- **Staging** (port 3001): Production build testing
- **Production** (port 3002): Stable release

## Production Status
✅ **100% Production Ready** - All critical tasks completed
- Docker multi-environment deployment
- Comprehensive test coverage
- Modern UI with gradients
- All security configurations
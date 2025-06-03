# MedContractHub Project Rules

## Quick Context
AI platform for medical distributors to win federal contracts via SAM.gov integration
Stack: Next.js 14, TypeScript, Supabase, Tailwind CSS | Path: /home/locklearwyatt/projects/medcontracthub

## Status
✅ Auth, SAM.gov (22k+), AI analysis, exports, emails
🚧 Analytics UI, Mistral OCR
📋 Product sourcing, supplier discovery

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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SAM_GOV_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
MISTRAL_API_KEY= # Optional
SENTRY_DSN= # Optional
```

## Key Files
- `lib/api/route-handler.ts` - API wrapper
- `lib/errors/types.ts` - Error classes
- `middleware.ts` - Auth protection
- `lib/hooks/useErrorHandler.ts` - Client errors

## Current Tasks
- [ ] Analytics Dashboard UI
- [ ] Mistral OCR integration
- [ ] Product/supplier schema
- [ ] Web scraping engine
- [ ] AI matching system
- [ ] Virtual scrolling
- [ ] Test coverage

## Common Fixes
- **DB types**: Use `as any` strategically
- **Auth fails**: Check middleware & RLS
- **Timeouts**: Add caching, check limits
- **Large lists**: Need virtualization (pending)
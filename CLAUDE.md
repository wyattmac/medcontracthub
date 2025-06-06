# CLAUDE.md

This file provides essential guidance to Claude Code when working with this repository.

## 📋 **IMPORTANT: Required Reading Before Coding**

Before making any code changes, Claude Code MUST review these critical documents:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture, patterns, and technical decisions
   - Review architectural patterns before implementing new features
   - Follow established domain structure and layering principles
   - Use documented performance optimizations and security patterns

2. **[PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md)** - Current production blockers and priorities
   - Check for critical issues that affect the code you're working on
   - Align new work with immediate production priorities
   - Avoid introducing changes that conflict with production readiness

## Project Overview
**MedContractHub** - AI-powered platform for medical distributors to win federal contracts
- **Stack**: Next.js 15, TypeScript, Supabase, Tailwind CSS, Docker, Redis
- **Path**: `/home/locklearwyatt/projects/medcontracthub`
- **Status**: 99% Production ready - Database populated with 1,002+ real opportunities
- **Recent**: Redis DNS errors resolved, Sentry monitoring restored, bulk sync operational

## 🚀 Essential Commands

### Development
```bash
# Start development (Docker recommended)
make dev                    # Port 3000
npm run dev                # Local alternative
npm run worker:dev         # Background worker

# Before committing - ALWAYS run these
npm run lint              # ESLint + Prettier
npm run type-check        # TypeScript validation
npm test                  # Run tests
```

### Docker Environments
```bash
make dev                  # Development (3000)
make staging             # Staging (3001) 
make prod               # Production (3002)
make health-check       # Check services
```

### Database
```bash
npm run db:types        # Generate TypeScript types
npm run dev-setup       # Create dev user (bypass onboarding)
```

## 🏗️ Architecture Essentials

**⚠️ CRITICAL: Before implementing any architectural patterns, read [ARCHITECTURE.md](./ARCHITECTURE.md) for complete context and examples.**

### API Route Pattern (MANDATORY)
Always use the enhanced route handler as documented in ARCHITECTURE.md:

```typescript
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase, sanitizedQuery }) => {
    // Implementation
  },
  { 
    requireAuth: true,
    validateQuery: schema,
    rateLimit: 'api'
  }
)
```

### Error Handling
- **Custom Errors**: Use types from `lib/errors/types.ts`
- **Error Boundaries**: Wrap sections with `SectionErrorBoundary`
- **Client Errors**: Use `useError` hook for reporting

### Component Patterns
```typescript
// Route groups for organization
app/(dashboard)/page.tsx    // Protected routes
app/(auth)/page.tsx        // Public routes

// Explicit client components only when needed
'use client'  // For interactivity
```

## 🎨 UI Guidelines

### Theme System
- **Blue gradients**: Opportunities
- **Green gradients**: Saved items  
- **Purple gradients**: Proposals
- **Amber gradients**: Analytics

### Responsive Design
- **Mobile-first**: Start with 375px
- **Breakpoints**: sm(640px), md(768px), lg(1024px), xl(1280px)
- **Half-page support**: Optimized for windowed apps
- **Touch navigation**: Mobile hamburger menu

### Performance
- Use virtual scrolling for lists >1000 items
- Dynamic imports for code splitting
- Next.js Image for optimization

## 🔧 Development Patterns

**📖 For complete implementation details, see [ARCHITECTURE.md](./ARCHITECTURE.md) sections on Domain Architecture and Development Patterns.**

### State Management
- **Server state**: TanStack Query
- **Client state**: Zustand
- **Forms**: React Hook Form + Zod

### Database
- **Supabase**: Cloud PostgreSQL with RLS
- **Connection pooling**: `lib/db/connection-pool.ts`
- **Type generation**: `npm run db:types`

### Security
- **CSRF protection**: Required on mutations
- **Input sanitization**: DOMPurify for all user input
- **Environment validation**: On startup

## 🚨 Critical Patterns

### Next.js 15 Dynamic Routes
```typescript
// Always await params
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

### Authentication
- Development mode bypasses auth (`NODE_ENV=development`)
- Use `npm run dev-setup` for test user
- Protected routes use middleware

### Known Issues
**⚠️ Check [PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md) for current production blockers before making changes.**

**Recently Resolved (June 6, 2025)**:
- ✅ **Redis DNS errors**: Edge runtime compatibility fixed
- ✅ **SAM.gov sync**: Working with 1,002+ real opportunities loaded
- ✅ **Sentry monitoring**: Error tracking restored and functional

**Remaining Issues**:
- **Next.js headers import**: Causing Docker health check failures (app functional)
- **SSL in Docker**: Disabled for development, enabled for production

## 🔗 Key Integrations

### SAM.gov (`lib/sam-gov/`)
- **Status**: ✅ Operational with 1,002+ opportunities loaded
- **Sync**: Automated daily sync configured and working
- **Performance**: 4.24ms average insert time, Redis caching active
- **Quota**: Management and rate limiting functional
- **NAICS Matching**: Personalized medical industry matching (`lib/constants/medical-naics.ts`)

### AI Services
- **Claude**: `lib/ai/claude-client.ts` (contract analysis)
- **Mistral**: `lib/ai/mistral-ocr-client.ts` (document OCR)

### Billing (`lib/stripe/`)
- Subscription tiers: $29, $99, $299
- Usage metering for AI features
- Webhook handlers

### Background Jobs
- **Email**: `emailQueue`
- **OCR**: `ocrQueue` 
- **Sync**: `syncQueue`
- Worker: `npm run worker:dev`

## 🌍 Environment Variables

### Required
```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN       # For MCP server dashboard access
CSRF_SECRET                 # 32+ chars, NEVER use default
SAM_GOV_API_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
RESEND_API_KEY
SYNC_TOKEN                  # For automated sync security
```

### Optional
```env
MISTRAL_API_KEY
BRAVE_SEARCH_API_KEY
REDIS_URL
SENTRY_DSN
```

## 🤖 MCP Server Integration

### Available Servers
- **Puppeteer** (`mcp__puppeteer__*`): Browser automation, screenshots
- **Supabase** (`mcp__supabase__*`): Database operations, migrations
- **GitHub** (`mcp__github__*`): Repository management, PRs
- **Context7** (`mcp__context7__*`): Library documentation

### Error Debugging
- **Visual**: Puppeteer screenshots on errors
- **Database**: Supabase state during failures
- **Documentation**: Context7 for library issues

## 🚀 Performance & AI Configuration

### AI Features Status
- **AI Recommendations**: Currently DISABLED (static responses for performance)
- **AI Analysis**: Currently DISABLED (static responses for performance)  
- **Reason**: Cost optimization during development phase
- **Re-enable**: Set `ENABLE_AI_FEATURES=true` when ready

### Performance Optimizations ✅
- **Next.js 15 cookies**: Fixed async/await warnings
- **API response times**: Reduced from 48s to instant
- **localhost:3000**: Now loads in 0.19s (was 9+ seconds)
- **Anthropic costs**: Eliminated during development

See [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md) for complete details.

## 📋 Recent Feature Updates

### Personalized Medical NAICS Matching System ✅ (December 6, 2024)
- **Medical NAICS Library**: Comprehensive reference with 150+ medical industry codes
- **Interactive Onboarding**: Visual NAICS code selection organized by medical categories
- **Personalized Matching**: Opportunities matched based on user's selected NAICS codes
- **Smart Scoring**: Exact matches (100%), category matches (80%), partial matches (60%)
- **Medical Focus**: Manufacturing, Wholesale, Healthcare, Research categorization
- **Bug Fix**: Critical percentage display issue resolved (8000% → 80%)

### Opportunities Enhancement ✅
- **Standard Layout**: Professional 3-column responsive design for opportunity details
- **Newest First Ordering**: Opportunities now show newest posted dates first (2025 vs 2015)
- **Improved UX**: Color-coded status indicators, match scores, organized action buttons
- **Mobile Optimized**: Fully responsive design with stacked mobile layout
- **Authentication Fixed**: Eliminated auth errors blocking opportunity viewing

See [OPPORTUNITIES_IMPROVEMENTS.md](./OPPORTUNITIES_IMPROVEMENTS.md) for complete details.

## 🏃‍♂️ Quick Troubleshooting

**📋 For current production issues and priorities, always check [PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md) first.**

### Common Issues
1. **TypeScript errors**: Run `npm run type-check`
2. **Docker health check failing**: Known Next.js headers import issue (app functional)
3. **Database connection**: Verify Supabase environment variables
4. **Auth issues**: Use `npm run dev-setup` for test user
5. **Redis errors**: ✅ **RESOLVED** - Edge runtime compatibility fixed
6. **SAM.gov sync**: ✅ **WORKING** - 1,002+ real opportunities loaded
7. **Performance issues**: ✅ **OPTIMIZED** - Major speed improvements applied

### Development Tips
- **Always review [ARCHITECTURE.md](./ARCHITECTURE.md) and [PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md) before coding**
- Always use Docker development environment (`make dev`)
- Run linting before commits
- Use virtual scrolling for large lists
- Follow mobile-first responsive design
- Implement proper error boundaries
- Follow Clean Architecture + DDD patterns as documented in ARCHITECTURE.md

---

**Last Updated**: December 6, 2024 - Added Personalized Medical NAICS Matching System
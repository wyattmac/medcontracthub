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

## 🧪 Critical Testing & Quality Insights

### Lessons from Comprehensive E2E Testing (June 6, 2025)

**⚠️ CRITICAL DISCOVERY**: A comprehensive critical user journey test revealed fundamental issues that traditional testing missed:

#### Issues Discovered & Fixed:
1. **Development Shortcuts Breaking Users**: Landing page redirect prevented new user registration
2. **Configuration Chaos**: 15+ hardcoded localhost:3000 URLs throughout codebase
3. **Performance Blindness**: 11+ second page loads going unnoticed
4. **Environment Divergence**: Development too different from production reality

#### Testing Philosophy Lessons:

**❌ Soft Testing**: "Does the component render correctly?"
**✅ Hard Testing**: "Can a real user complete their goal in under 30 seconds?"

#### Key Insights:
- **Perfect components can create broken user experiences**
- **Development environment lies when too different from production**
- **Performance is a product feature, not just technical debt**
- **User journey validation must be part of development process**

#### Systematic Quality Improvements Needed:
```
HIGH PRIORITY:
- Set up automated user journey monitoring in production
- Establish development environment standards that mirror production
- Set up performance budgets and monitoring for all critical pages
- Create E2E tests for all major user workflows
- Create process for regular user journey validation during development

MEDIUM PRIORITY:
- Audit entire codebase for hardcoded values and implement proper config management
- Implement production health checks that validate actual user journeys
- Audit codebase for development shortcuts that could impact production
- Set up RUM (Real User Monitoring) to track actual user experience metrics
```

#### Testing Infrastructure:
- **Critical User Journey Test**: `__tests__/e2e/critical-user-journey.test.ts`
- **Run Command**: `npm run test:critical`
- **Coverage**: Registration → Onboarding → Discovery → Analysis → Proposals → Settings
- **Performance Benchmarks**: Landing (<5s), Opportunities (<8s), Search (<3s)
- **Edge Cases**: XSS protection, injection prevention, offline scenarios

#### Cultural Shift Required:
Move from **"Ship features fast"** to **"Ship user value reliably"**
- Test real user journeys, not just individual features
- Validate assumptions with actual user flows
- Measure user success, not just code coverage
- Prioritize user experience over developer convenience

**The Meta-Lesson**: Comprehensive testing doesn't just improve code quality—it exposes and helps fix organizational quality issues including development processes, quality standards, user empathy, and production readiness.

## 📊 Automated User Journey Monitoring ✅ NEW

### Production Monitoring System (December 6, 2024)
Building on our critical testing insights, we've implemented comprehensive automated monitoring that continuously validates critical user flows in production.

**What it monitors**:
- **Landing page health** (every 5 minutes): Core site availability and key elements
- **Opportunities discovery** (every 10 minutes): Core business functionality  
- **Authentication flows** (every 15 minutes): User registration/login flows
- **API health endpoints** (every 2 minutes): System infrastructure status

**Features**:
- **Real-time alerting** when user journeys break
- **Performance tracking** with automatic scoring (Good/Needs Improvement/Poor)
- **Visual dashboard** at `/monitoring` for real-time status
- **API control** for management and health checks
- **Environment-aware** (automatically enabled in production)

### Monitoring Commands
```bash
# Test monitoring system
npm run monitor:test                # Validate monitoring locally

# Control monitoring
npm run monitor:start              # Start continuous monitoring
npm run monitor:stop               # Stop monitoring  
npm run monitor:status             # Check current status
npm run monitor:health-check       # Run immediate health check
```

### Monitoring Dashboard
Access the real-time monitoring dashboard at **`/monitoring`** to:
- View current monitoring status and active monitors
- Control start/stop of automated monitoring
- Run immediate health checks across all journeys
- See detailed performance metrics and response times
- Track user journey success rates over time

### Alert System Architecture
- **Consecutive Failure Threshold**: Configurable per journey (2-3 failures trigger alert)
- **Performance Scoring**: Automatic classification based on response time thresholds
- **Webhook Integration**: Supports external alert systems (Slack, PagerDuty, etc.)
- **Structured Logging**: Machine-readable monitoring data for analytics
- **Environment Variables**: 
  ```bash
  ENABLE_USER_JOURNEY_MONITORING=true  # Enable in development
  MONITORING_WEBHOOK_URL=...           # Alert webhook endpoint
  ```

### Implementation Details
- **Core Library**: `lib/monitoring/user-journey-monitor.ts`
- **Scheduler**: `lib/monitoring/scheduler.ts` 
- **API Endpoints**: `/api/monitoring/journey`, `/api/monitoring/control`
- **Dashboard**: `app/(dashboard)/monitoring/page.tsx`
- **Auto-start**: Integrated into `instrumentation.ts` for production deployment

This system ensures that critical user flows remain functional 24/7 and provides immediate notification when issues arise, implementing the key lesson from our comprehensive testing: **monitor what users actually experience, not just what code does**.

---

**Last Updated**: December 6, 2024 - Added Automated User Journey Monitoring System
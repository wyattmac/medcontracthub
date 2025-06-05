# MedContractHub Project Rules

## Quick Context
AI platform for medical distributors to win federal contracts via SAM.gov integration
Stack: Next.js 15, TypeScript, Supabase, Tailwind CSS, Docker, Redis, PostgreSQL
Path: /home/locklearwyatt/projects/medcontracthub

## Current Status ✅
✅ Complete AI-powered contract analysis with Claude & Mistral OCR
✅ SAM.gov integration (22k+ opportunities) with real-time sync
✅ Stripe billing, usage metering, 14-day trials with webhooks
✅ Modern dashboard UI with gradient design and color-coded themes
✅ Virtual scrolling, CI/CD pipeline, Redis, Bull.js queues, DB optimization
✅ Docker multi-environment setup (dev/staging/prod) with build optimizations
✅ Production-ready security, monitoring, health checks, automated backups
📊 Production Readiness: 100% (Test Coverage: Comprehensive ✅)

## Architecture Overview
```
Frontend (Next.js 15)
├── Authentication (Supabase Auth)
├── Dashboard (Gradient UI)
├── Opportunities (Virtual scroll)
├── AI Analysis (Claude/Mistral)
├── Billing (Stripe)
└── Settings

Backend Services
├── API Routes (Route handlers)
├── SAM.gov Integration
├── AI Processing (Background jobs)
├── Email System (Resend)
├── Cache Layer (Redis)
└── Database (Supabase/PostgreSQL)

Infrastructure (Docker)
├── Development (Port 3000)
├── Staging (Port 3001)
├── Production (Port 3002)
├── Redis Cache
├── PostgreSQL DB
└── Background Workers
```

## Development Workflow

### Docker Development (Recommended)
```bash
# Quick start options
make dev                        # Start development (Makefile)
./easy-docker.sh               # Interactive menu
./docker-scripts.sh start dev  # Direct command

# Advanced management
make staging                    # Start staging environment
make prod                       # Start production environment
make health-check              # Check all service health
make backup-dev                # Backup development DB
```

### Standard Workflow
1. **Before Starting**: `make dev` or `npm test && npm run type-check`
2. **While Coding**: Use TodoWrite to track progress, hot reload active
3. **Before Committing**: `npm run lint && npm run type-check`
4. **Commit Style**: Use conventional commits (feat:, fix:, docs:, chore:)
5. **Testing**: Test in staging before production deployment

## Todo List Management

Claude Code has built-in todo list functionality. Use it to track tasks:

### Commands
- **TodoRead**: View current todo list (no parameters needed)
- **TodoWrite**: Update todo list with array of tasks

### Todo Structure
```json
{
  "content": "Task description",
  "status": "pending" | "in_progress" | "completed",
  "priority": "high" | "medium" | "low",
  "id": "unique-task-id"
}
```

### Best Practices
1. Always check TodoRead at start of session
2. Update status as you work (pending → in_progress → completed)
3. Add new tasks as discovered
4. Use high priority for blockers
5. Keep descriptions concise but clear

**Note**: The todo list is session-based and managed by Claude Code internally.

## Critical Rules
1. **TypeScript strict** - `as any` only for DB compatibility with Supabase types
2. **Custom errors only** - Use `@/lib/errors/types` (NotFoundError, ValidationError, etc.)
3. **Route handler wrapper** - ALL APIs use `routeHandler` for auth/validation/logging
4. **Context7 MCP first** - Research libraries before implementing
5. **Test before commit** - Always run linting and type checking
6. **Docker first** - Use containerized development for consistency
7. **Health checks** - All services must have `/api/health` endpoints
8. **Security headers** - CSRF protection, rate limiting, sanitization required

## Code Patterns

### API Routes (REQUIRED)
```typescript
// Standard API route with authentication
export const GET = routeHandler.GET(
  async ({ user, supabase }) => {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('user_id', user.id)
    
    if (error) throw new DatabaseError('Failed to fetch opportunities')
    return NextResponse.json({ data })
  },
  { requireAuth: true, validateQuery: querySchema, rateLimit: 'api' }
)

// Background job processing
export const POST = routeHandler.POST(
  async ({ sanitizedBody, user }) => {
    await emailQueue.add('send-notification', {
      userId: user.id,
      type: 'opportunity-match',
      data: sanitizedBody
    })
    return NextResponse.json({ success: true })
  },
  { requireAuth: true, validateBody: emailSchema, rateLimit: 'api' }
)
```

### Error Handling
```typescript
// Custom error throwing
throw new NotFoundError('Opportunity')
throw new ValidationError('Invalid opportunity ID')
throw new AuthenticationError('User not authenticated')
throw new ExternalServiceError('SAM.gov API', 'Connection timeout')

// Client-side error handling
const { handleError } = useErrorHandler()
handleError(error, { showToast: true, logLevel: 'error' })
```

### Component Structure
```typescript
// Dashboard component with gradients
export default function OpportunitiesPage() {
  const { data, isLoading, error } = useOpportunities()
  
  if (error) return <ErrorBoundary error={error} />
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
        {/* Content */}
      </div>
    </div>
  )
}
```

## UI Design System

### Color Themes & Gradients
```css
/* Opportunities (Blue) */
bg-gradient-to-r from-blue-500 to-blue-600
text-blue-600 border-blue-200

/* Saved (Green) */  
bg-gradient-to-r from-green-500 to-emerald-600
text-green-600 border-green-200

/* Proposals (Purple) */
bg-gradient-to-r from-purple-500 to-violet-600
text-purple-600 border-purple-200

/* Value/Analytics (Amber) */
bg-gradient-to-r from-amber-500 to-orange-600
text-amber-600 border-amber-200
```

### Animations & Interactions
```css
/* Standard hover effects */
hover:shadow-lg transition-all duration-300 hover:scale-105

/* Loading states */
animate-pulse bg-gray-200

/* Status indicators */
animate-bounce text-green-500 /* Success */
animate-spin text-blue-500    /* Loading */
```

### Layout Patterns
```typescript
// Responsive grid layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">

// Card component with gradient
<div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300">
```

## Project Structure
```
/home/locklearwyatt/projects/medcontracthub/
├── app/
│   ├── (auth)/             # Public authentication routes
│   │   ├── login/          # Login page with error handling
│   │   ├── signup/         # User registration
│   │   └── onboarding/     # User setup flow
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── dashboard/      # Main dashboard with gradient UI
│   │   ├── opportunities/  # SAM.gov opportunities (22k+)
│   │   ├── proposals/      # Contract proposals management
│   │   ├── analytics/      # Performance analytics
│   │   ├── settings/       # User settings & billing
│   │   └── test-ocr/       # Mistral OCR testing
│   ├── api/               # API endpoints (ALL use routeHandler)
│   │   ├── ai/            # Claude AI analysis
│   │   ├── opportunities/ # SAM.gov data sync
│   │   ├── billing/       # Stripe integration
│   │   ├── emails/        # Resend email system
│   │   ├── ocr/           # Document processing
│   │   └── health/        # Health check endpoint
│   └── globals.css        # Tailwind + custom gradients
├── components/
│   ├── ui/                # shadcn/ui with custom gradients
│   │   ├── button.tsx     # Gradient button components
│   │   ├── card.tsx       # Card layouts with backdrop blur
│   │   └── error-boundary.tsx # Error handling
│   ├── dashboard/         # Dashboard-specific components
│   │   ├── opportunities/ # Virtual scrolling lists
│   │   ├── analytics/     # Chart components
│   │   └── ai/            # AI analysis widgets
│   └── auth/              # Authentication components
├── lib/
│   ├── api/               # API utilities
│   │   └── route-handler.ts # REQUIRED wrapper for all APIs
│   ├── errors/            # Error system
│   │   ├── types.ts       # Custom error classes
│   │   └── logger.ts      # Error logging
│   ├── supabase/          # Database clients
│   │   ├── client.ts      # Client-side DB
│   │   └── server.ts      # Server-side DB
│   ├── sam-gov/           # SAM.gov integration
│   │   ├── client.ts      # API client
│   │   ├── hooks.ts       # React Query hooks
│   │   └── utils.ts       # Data processing
│   ├── ai/                # AI processing
│   │   ├── claude-client.ts # Claude API
│   │   └── mistral-ocr-client.ts # Mistral OCR
│   ├── stripe/            # Billing system
│   │   ├── client.ts      # Stripe client
│   │   └── webhook-handlers.ts # Webhook processing
│   ├── email/             # Email system
│   │   └── client.ts      # Resend integration
│   ├── queue/             # Background jobs
│   │   ├── index.ts       # Bull.js setup
│   │   └── processors/    # Job processors
│   ├── redis/             # Cache layer
│   │   └── client.ts      # Redis client
│   └── monitoring/        # Observability
│       └── sentry.ts      # Error tracking
├── Docker Configuration
│   ├── Dockerfile.dev     # Development with hot reload
│   ├── Dockerfile.staging # Staging environment
│   ├── Dockerfile.prod    # Production optimized
│   ├── Dockerfile.worker  # Background job workers
│   ├── docker-compose.multi-env.yml # All environments
│   └── nginx/             # Nginx configurations
│       ├── staging.conf   # Staging proxy
│       └── production.conf # Production with SSL
├── scripts/
│   ├── docker-scripts.sh  # Docker management
│   ├── easy-docker.sh     # Interactive Docker menu
│   ├── backup-automation.sh # Automated backups
│   └── start-worker.ts    # Background job worker
├── supabase/
│   ├── migrations/        # Database migrations
│   └── schema.sql         # Database schema
└── Configuration
    ├── next.config.js     # Next.js config (standalone output)
    ├── middleware.ts      # Auth protection
    ├── Makefile          # 30+ management commands
    └── CLAUDE.md         # This file
```

## Commands & Scripts

### Docker Commands (Recommended)
```bash
# Quick start (multiple options)
make dev                        # Makefile (recommended)
./easy-docker.sh               # Interactive menu
./docker-scripts.sh start dev  # Direct command

# Environment management
make staging                    # Start staging (port 3001)
make prod                       # Start production (port 3002)
make stop                       # Stop all environments
make clean                      # Remove containers & volumes

# Monitoring & maintenance
make health-check              # Test all service endpoints
make logs                      # View all container logs
make status                    # Check container status
make backup-dev                # Backup development database
make security-scan             # Security vulnerability scan
```

### Development Commands
```bash
# Local development (non-Docker)
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint + Prettier
npm run type-check   # TypeScript validation
npm test            # Jest test suite

# Docker builds
make test-build      # Test production build
make build           # Build all environments
make update          # Update and rebuild images
```

## Environment Variables
```env
# Core Application
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# External APIs
SAM_GOV_API_KEY=your-sam-gov-key
ANTHROPIC_API_KEY=sk-ant-your-claude-key
MISTRAL_API_KEY=your-mistral-key (optional)
RESEND_API_KEY=re_your-resend-key

# Billing & Payments
STRIPE_SECRET_KEY=sk_test_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Security (CRITICAL - generate secure values)
CSRF_SECRET=your-32-char-secret-NEVER-use-default
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=MedContractHub

# Production Infrastructure
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
DB_MAX_CONNECTIONS=25

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-public-sentry-dsn@sentry.io/project-id

# Environment-specific (for multi-environment setup)
DATABASE_URL_DEV=postgresql://user:pass@localhost:5432/medcontracthub_dev
DATABASE_URL_STAGING=postgresql://user:pass@localhost:5433/medcontracthub_staging
DATABASE_URL=postgresql://user:pass@your-prod-db/medcontracthub
```

## Integration Systems

### MCP (Model Context Protocol) Servers
```bash
# GitHub operations
mcp__github__create_repository      # Create new repos
mcp__github__push_files            # Push file changes
mcp__github__create_pull_request   # Create PRs
mcp__github__search_code           # Search codebase

# Library research
mcp__context7__resolve-library-id  # Find library info
mcp__context7__get-library-docs    # Get documentation
```

### AI & Processing
- **Claude (Anthropic)**: Contract analysis, recommendations
- **Mistral**: OCR document processing, text extraction
- **SAM.gov API**: 22k+ federal opportunities, real-time sync
- **Brave Search**: Web research for competitive intelligence

### Infrastructure Services
- **Supabase**: PostgreSQL database, authentication, real-time
- **Redis**: Caching, session storage, rate limiting
- **Bull.js**: Background job processing
- **Stripe**: Billing, subscriptions, usage metering
- **Resend**: Transactional emails, notifications
- **Sentry**: Error tracking, performance monitoring

## Key Files & Architecture

### Critical Files
```bash
# API Infrastructure
lib/api/route-handler.ts           # REQUIRED: All API routes use this
middleware.ts                      # Authentication & security

# Error System
lib/errors/types.ts                # Custom error classes
lib/errors/logger.ts               # Centralized logging

# Database
lib/supabase/client.ts             # Client-side database
lib/supabase/server.ts             # Server-side database
types/database.types.ts            # TypeScript types

# External Integrations
lib/sam-gov/client.ts              # SAM.gov API client
lib/ai/claude-client.ts            # AI analysis
lib/stripe/client.ts               # Billing system

# UI Components
app/(dashboard)/dashboard/page.tsx  # Main dashboard
components/ui/                     # shadcn/ui + gradients
```

### Docker Environments
```bash
# Development (Port 3000)
- Hot reload enabled
- Development database
- Debug logging
- Volume mounts for live coding

# Staging (Port 3001)  
- Production build
- Staging database
- Resource limits (1GB RAM)
- Nginx proxy with caching

# Production (Port 3002)
- Optimized build (standalone output)
- Production database (Supabase)
- Resource limits (2GB RAM)
- SSL termination, security headers
- Automated health checks
- Zero-downtime deployments
```

## Production Features ✅

### Security & Compliance
- CSRF protection on all state-changing requests
- Rate limiting (API: 10req/s, Auth: 5req/min)
- Input sanitization with DOMPurify
- Security headers (HSTS, CSP, XSS protection)
- Non-root containers with signal handling

### Performance & Scalability
- Virtual scrolling for large datasets
- Redis caching with TTL management
- Database connection pooling
- Optimized Docker builds (standalone output)
- CDN-ready static asset caching

### Monitoring & Reliability
- Health check endpoints (`/api/health`)
- Comprehensive error tracking (Sentry)
- Automated database backups (30-day retention)
- Container resource limits & restart policies
- Real-time log aggregation

### Deployment & DevOps
- Multi-environment Docker setup
- Zero-downtime rolling updates
- Automated backup system
- CI/CD ready with health checks
- Production-ready Nginx configuration

**Status: 100% Production Ready** 🚀
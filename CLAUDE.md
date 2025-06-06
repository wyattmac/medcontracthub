# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
**MedContractHub** - AI-powered platform for medical distributors to win federal contracts
- Stack: Next.js 15, TypeScript, Supabase, Tailwind CSS, Docker, Redis, PostgreSQL
- Path: /home/locklearwyatt/projects/medcontracthub
- Production Status: 100% Ready with multi-environment Docker deployment

## Essential Development Commands

### Quick Start
```bash
# Docker Development (Recommended) - Port 3000
make dev                    # Start with Makefile
./easy-docker.sh           # Interactive menu
./docker-scripts.sh start dev  # Direct command

# Local Development (Alternative)
npm run dev                # Start dev server
npm run worker:dev        # Start background worker with hot reload
```

### Testing & Validation
```bash
# Before committing - ALWAYS run these
npm run lint              # ESLint + Prettier
npm run type-check        # TypeScript validation

# Testing commands
npm test                  # Run all tests
npm run test:fast        # Quick test run (bail on first failure)
npm run test:changed     # Test only changed files
npm run test:api         # API route tests (sequential)
npm run test:components  # Component tests
npm run test:coverage    # Full coverage report

# Single test execution
npm test -- path/to/test.ts --watch
```

### Build & Deployment
```bash
# Docker environments
make staging             # Start staging (port 3001)
make prod               # Start production (port 3002)
make health-check       # Check all service health
make backup-dev         # Backup development DB

# Production build
npm run build           # Next.js production build
make test-build         # Test Docker production build
```

### Database Operations
```bash
npm run db:types        # Generate TypeScript types from Supabase
npm run db:migrate      # Apply database migrations
npm run dev-setup       # Set up development user (bypass onboarding)
```

## High-Level Architecture

### API Route Pattern (MANDATORY)
All API routes MUST use the enhanced route handler located at `lib/api/enhanced-route-handler.ts`:

```typescript
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase, sanitizedQuery }) => {
    // Implementation
  },
  { 
    requireAuth: true,      // Authentication required
    validateQuery: schema,  // Zod schema validation
    rateLimit: 'api'       // Rate limiting tier
  }
)
```

This wrapper provides:
- Automatic authentication with `user` object
- Request validation (query/body) with sanitization
- Enhanced error handling with debugging context
- Rate limiting per tier (api: 10req/s, auth: 5req/min)
- CSRF protection on state-changing methods
- Supabase client with proper error recovery
- Detailed error reporting for Claude Code debugging

### Enhanced Error Handling System
Comprehensive error handling with Claude Code debugging support:

**Error Types** (`lib/errors/types.ts`):
- `NotFoundError` - Resource not found
- `ValidationError` - Input validation failures
- `AuthenticationError` - Auth failures
- `DatabaseError` - Database operations
- `ExternalServiceError` - Third-party API failures
- `RateLimitError` - Rate limit exceeded

**Error Reporter** (`lib/errors/error-reporter.ts`):
- Detailed debugging hints based on error type
- Suggested actions for common issues
- Automatic file path extraction from stack traces
- Environment-specific error contexts

**Enhanced Error Boundaries** (`components/ui/enhanced-error-boundary.tsx`):
- Development vs production error displays
- Visual debugging with Puppeteer MCP integration
- Interactive error analysis tools
- Screenshot capture and DOM state analysis

**Client-side Error Handling**:
```typescript
import { api } from '@/lib/api/error-interceptor'
// Automatic error handling with user-friendly messages
const data = await api.get('/api/opportunities')

// Manual error reporting
import { useError } from '@/providers/error-provider'
const { reportError } = useError()
reportError(error, { context: 'custom-operation' })
```

**Error Testing & Debugging**:
- Test endpoint: `/api/test-error?type=validation&throwError=true`
- Interactive test page: `/test-errors` (requires auth)
- Visual debugging with Puppeteer screenshots
- Automated page diagnostics (accessibility, performance, SEO)

### Background Job Processing
Bull.js queues with Redis for async operations:
- Email notifications via `emailQueue`
- OCR document processing via `ocrQueue`
- SAM.gov sync via `syncQueue`

Workers run separately: `npm run worker` or `npm run worker:dev`

### Critical Integration Points

**SAM.gov Integration** (`lib/sam-gov/`)
- 22k+ federal opportunities
- Quota management system with rate limiting
- Cache strategy for API efficiency
- Prefetch manager for performance

**AI Services**
- Claude API (`lib/ai/claude-client.ts`) - Contract analysis
- Mistral OCR (`lib/ai/mistral-ocr-client.ts`) - Document processing at $0.001/page

**Billing System** (`lib/stripe/`)
- Subscription tiers: Starter ($29), Professional ($99), Enterprise ($299)
- Usage metering for AI features
- Webhook handlers for subscription events

### Database Architecture
**Supabase PostgreSQL** with Row Level Security (cloud-hosted):
- `company_profiles` - User company information
- `opportunities` - SAM.gov contract opportunities
- `saved_opportunities` - User bookmarked items
- `proposals` - User-generated proposals
- `api_usage` - Usage tracking for billing
- `reminders` - Deadline notifications

**Local Development Support**:
- Redis for caching and queues (Docker container)
- Connection pooling via `lib/db/connection-pool.ts`
- Environment-specific Supabase projects

### UI Component System
shadcn/ui components with custom gradient themes:
- Blue gradients for Opportunities
- Green gradients for Saved items
- Purple gradients for Proposals
- Amber gradients for Analytics

Virtual scrolling implemented for lists >1000 items using `react-window`

## Development Patterns

### Component Structure
```typescript
// Always use route groups for organization
app/(dashboard)/opportunities/page.tsx  // Protected routes
app/(auth)/login/page.tsx              // Public routes

// Server components by default, client components explicit
'use client'  // Only when needed for interactivity
```

### State Management
- Server state: TanStack Query (React Query) with SSR support
- Client state: Zustand for global state
- Form state: React Hook Form with Zod validation

### Performance Optimizations
- Dynamic imports for code splitting
- Image optimization with Next.js Image
- Redis caching with TTL management
- Database query optimization with DataLoader pattern
- Virtual scrolling for large lists

### Security Requirements
- CSRF tokens required on all mutations
- Input sanitization with DOMPurify
- Environment variable validation on startup
- Non-root Docker containers
- Security headers via middleware

## Known Issues & Solutions

### Next.js 15 Dynamic Routes
Always await params in dynamic routes:
```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

### Supabase SSL/DNS Issues
Docker compose includes `NODE_TLS_REJECT_UNAUTHORIZED=0` for development
Production uses proper SSL certificates

### Authentication in Development
Development mode bypasses auth when `NODE_ENV=development`
Use `npm run dev-setup` to create test user

### Current Data State
- Database contains test data only (2 opportunities)
- SAM.gov sync endpoint needs repair for real data import
- Use simplified queries for Supabase compatibility

## Environment Configuration

Required environment variables:
```env
# Core (Required)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CSRF_SECRET  # 32+ chars, NEVER use default

# External Services
SAM_GOV_API_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY

# Optional Services
MISTRAL_API_KEY
BRAVE_SEARCH_API_KEY

# Production Infrastructure
REDIS_URL
REDIS_PASSWORD
SENTRY_DSN
```

## Docker Multi-Environment Setup

Three isolated environments with separate configurations:
- **Development** (3000): Hot reload, debug logging, enhanced error details
- **Staging** (3001): Production build, 1GB RAM limit
- **Production** (3002): Optimized build, 2GB RAM, SSL ready

Each environment has:
- **Isolated Supabase project/database** (cloud-hosted PostgreSQL)
- Shared Redis container with namespacing (local Docker)
- Nginx reverse proxy (staging/prod)
- Health check endpoints
- Automated backup capabilities

## MCP (Model Context Protocol) Servers

### Available MCP Servers
The project includes several MCP servers that extend Claude's capabilities:

**Puppeteer MCP Server** (`mcp__puppeteer__*`)
- Browser automation and web scraping
- Screenshot capture of pages or elements
- Form interaction (click, fill, select)
- JavaScript execution in browser context
- **Error Debugging**: Automatic screenshot capture on errors
- **Page Diagnostics**: Performance, accessibility, and SEO analysis

**Supabase MCP Server** (`mcp__supabase__*`)
- Direct database operations and management
- Project creation, pausing, and restoration
- Database migrations and SQL execution
- Edge function deployment
- Branch management for development workflows
- Real-time log access for debugging
- TypeScript type generation from schema

**Context7 MCP Server** (`mcp__context7__*`)
- Library documentation retrieval
- Package/product name resolution to library IDs
- Up-to-date documentation for frameworks and libraries
- Topic-focused documentation queries

**GitHub MCP Server** (`mcp__github__*`)
- Repository creation and management
- File operations (create, update, push multiple files)
- Pull request creation and management
- Issue tracking and commenting
- Code search across repositories
- Branch management and forking

### Error Handling Integration with MCP
- **Visual Debugging**: Puppeteer MCP captures error screenshots automatically
- **Database Context**: Supabase MCP provides database state during errors
- **Documentation Lookup**: Context7 MCP helps resolve library-related errors
- **Issue Reporting**: GitHub MCP can create issues from error reports (future enhancement)
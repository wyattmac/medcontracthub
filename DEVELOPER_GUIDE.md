# Developer Guide

**Complete development instructions for MedContractHub**

> 📋 **Required Reading** | Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design | Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for known issues

---

## 🎯 Project Overview

**MedContractHub** is an AI-powered federal contracting platform for medical supply distributors built with enterprise architecture standards.

### **Current Status**
- **Production Ready**: 99% complete with 23,300+ live opportunities
- **Technology Stack**: Next.js 15, TypeScript, Supabase, Docker, Redis
- **Zero TypeScript Errors**: Strict mode compliance maintained
- **Database**: Populated with real federal opportunities from SAM.gov

### **Recent Achievements** (December 2024)
- ✅ Redis DNS errors resolved (Edge runtime compatibility)
- ✅ SAM.gov sync operational (1,002+ opportunities loaded)
- ✅ Sentry monitoring restored and functional
- ✅ Performance optimized (11.7s → 1.95s page loads, 83% improvement)
- ✅ OCR proposal integration with "Mark for Proposal" workflow
- ✅ Environment files consolidated into single `.env.consolidated` file

---

## 🚀 Development Environment Setup

**MedContractHub uses Docker with Supabase for all development work.** There are three development stages with isolated environments:

### **Multi-Stage Development Architecture**

| Stage | Port | Purpose | Database | SSL | Command |
|-------|------|---------|----------|-----|---------|
| **Development** | 3000 | Hot reload coding | Supabase Dev Project | Disabled | `make dev` |
| **Staging** | 3001 | Production build testing | Supabase Staging Project | Nginx proxy | `make staging` |
| **Production** | 3002 | Live deployment | Supabase Production Project | Full SSL | `make prod` |

### **1. Prerequisites**
```bash
# Required tools
- Docker & Docker Compose
- Git
- Make (for shortcuts)

# Verify installation
docker --version
docker-compose --version
make --version
```

### **2. Initial Setup (3 minutes)**
```bash
# Clone repository
git clone https://github.com/wyattmac/medcontracthub.git
cd medcontracthub

# Copy consolidated environment configuration
cp .env.consolidated .env.local

# Edit .env.local with your credentials - all required keys included:
# See complete configuration example below
```

### **Environment Configuration (.env.local)**

**Using the consolidated environment file template:**
```bash
# ===========================================
# DEVELOPMENT SETTINGS
# ===========================================
NODE_ENV=development
DEVELOPMENT_AUTH_BYPASS=true          # Required for testing
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===========================================
# SUPABASE CONFIGURATION (REQUIRED)
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
SUPABASE_ACCESS_TOKEN=sbp_...your-access-token

# ===========================================
# AI SERVICES (REQUIRED FOR OCR)
# ===========================================
ANTHROPIC_API_KEY=sk-ant-api03-...your-claude-key
MISTRAL_API_KEY=...your-mistral-key    # For OCR document processing

# ===========================================
# EXTERNAL APIs (REQUIRED)
# ===========================================
SAM_GOV_API_KEY=...your-sam-gov-key
BRAVE_SEARCH_API_KEY=...your-brave-key  # Optional for enhanced search
RESEND_API_KEY=re_...your-resend-key    # For email notifications

# ===========================================
# STRIPE PAYMENT PROCESSING (USE TEST KEYS)
# ===========================================
STRIPE_SECRET_KEY=sk_test_...your-test-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...your-test-key
STRIPE_WEBHOOK_SECRET=whsec_...your-webhook-secret

# ===========================================
# SECURITY (REQUIRED)
# ===========================================
CSRF_SECRET=your-unique-32-character-secret-key
SYNC_TOKEN=your-sync-endpoint-security-token

# ===========================================
# EMAIL CONFIGURATION
# ===========================================
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=YourAppName

# ===========================================
# MONITORING (OPTIONAL)
# ===========================================
SENTRY_DSN=https://...your-sentry-dsn
SENTRY_AUTH_TOKEN=...your-sentry-token
```

### **3. Start Development Environment**
```bash
# Start development containers (recommended)
make dev                    # Starts on port 3000

# Or manually
docker-compose up --build

# Verify containers are running
docker ps
make health-check
```

### **4. Database Setup**
```bash
# The app connects to your Supabase cloud instance
# No local database setup required

# Verify database connection
curl "http://localhost:3000/api/health" | jq '.database'

# Populate with real SAM.gov data (optional)
npm run populate-samgov-data
```

### **5. Alternative Staging/Production Testing**
```bash
# Test staging build (port 3001)
make staging

# Test production build (port 3002)  
make prod

# Check all environments
make health-check
```
### **6. Access Your Application**
```bash
# Development environment
http://localhost:3000     # Main application
http://localhost:3000/api/health  # Health check endpoint

# Container logs (for debugging)
docker logs medcontract-dev
docker logs medcontract-redis
```

---

## 🛠️ Docker Development Workflow

### **Daily Development Commands**

#### **Starting & Stopping**
```bash
# Start development environment
make dev                    # Recommended: full Docker environment
docker-compose up --build  # Manual alternative

# Stop environment
make stop                   # Graceful shutdown
docker-compose down         # Stop and remove containers

# Restart after changes
make restart               # Quick restart
docker-compose restart    # Manual restart
```

#### **Container Management**
```bash
# View running containers
docker ps
docker stats              # Resource usage

# Container logs
docker logs medcontract-dev -f     # Follow app logs
docker logs medcontract-redis      # Redis logs

# Shell access
docker exec -it medcontract-dev sh # Access app container
docker exec -it medcontract-redis redis-cli # Redis CLI
```

#### **Multi-Environment Testing**
```bash
# Development (hot reload)
make dev                  # Port 3000, development build

# Staging (production build test)  
make staging             # Port 3001, production build + staging DB

# Production simulation
make prod               # Port 3002, full production config

# Health checks across all environments
make health-check       # Verify all services are healthy
```

#### **Code Quality & Testing**
```bash
# Inside Docker container (recommended)
docker exec medcontract-dev npm run lint
docker exec medcontract-dev npm run type-check
docker exec medcontract-dev npm test

# Or on host system
npm run lint              # ESLint + Prettier
npm run type-check        # TypeScript validation
npm test                  # Jest test suite
npm run test:e2e          # Playwright E2E tests
```

#### **Database Operations**
```bash
npm run db:types        # Generate TypeScript types from Supabase
npm run dev-setup       # Create development user (bypass onboarding)
npm run db:migrate      # Apply database migrations
```

### **Consolidated Environment Configuration**

**All environment variables are now managed through a single `.env.consolidated` template file that includes:**

#### **Multi-Environment Support**
- **Development**: Copy `.env.consolidated` to `.env.local` for development
- **Staging**: Use staging-specific Supabase project credentials  
- **Production**: Use production-specific Supabase project credentials

#### **OCR Integration Requirements**
```bash
# OCR-Enhanced Proposals require these AI service keys:
ANTHROPIC_API_KEY=sk-ant-api03-...     # Claude for contract analysis
MISTRAL_API_KEY=...                    # Mistral for document OCR processing

# Enable OCR features with authentication bypass for development:
DEVELOPMENT_AUTH_BYPASS=true          # Required for testing OCR workflow
```

#### **Critical Configuration Notes**
- **DEVELOPMENT_AUTH_BYPASS=true** - Essential for OCR testing and development
- **All API keys included** - Single source of truth for all required services
- **Security tokens provided** - CSRF protection and sync endpoint security
- **Test Stripe keys** - Safe payment processing testing in development
- **Complete documentation** - Every environment variable clearly documented

#### **Environment File Management**
```bash
# Primary environment file (source of truth)
.env.consolidated              # Template with all configuration options

# Active environment files (created from template)
.env.local                    # Development environment
.env.staging                  # Staging environment (when needed)
.env.production              # Production environment (when needed)

# Legacy files (removed during consolidation)
.env, .env.docker.dev        # No longer used
```

---

## 🏗️ Architecture Essentials

> **⚠️ CRITICAL**: Read [ARCHITECTURE.md](./ARCHITECTURE.md) for complete patterns and examples before implementing features.

### **Mandatory Patterns**

#### **API Route Implementation**
Always use the enhanced route handler for new endpoints:

```typescript
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'

export const GET = enhancedRouteHandler.GET(
  async ({ user, supabase, sanitizedQuery }) => {
    // Your implementation here
    return NextResponse.json({ data: 'response' })
  },
  { 
    requireAuth: true,
    validateQuery: schema,
    rateLimit: 'api'
  }
)
```

#### **Component Architecture**
```typescript
// Route organization
app/(dashboard)/page.tsx    // Protected dashboard routes
app/(auth)/page.tsx        // Public authentication routes

// Client components (explicit when needed)
'use client'  // Only for interactivity, not server components
```

#### **Error Handling**
- **Custom Errors**: Use types from `lib/errors/types.ts`
- **Error Boundaries**: Wrap UI sections with `SectionErrorBoundary`
- **Client Errors**: Use `useError` hook for user-facing error reporting

### **Next.js 15 Critical Patterns**

#### **Dynamic Route Parameters**
```typescript
// ALWAYS await params in Next.js 15
export default async function Page({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params  // Required await
  // Component implementation
}
```

#### **Server/Client Import Separation**
```typescript
// Safe server-side imports
if (typeof window === 'undefined') {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()
    // Server-side operations
  } catch (error) {
    console.warn('Server operation failed', error)
  }
}
```

---

## 🎨 UI & Design System

### **Theme System**
Use consistent gradient themes across the application:
- **Blue gradients**: Opportunities and discovery
- **Green gradients**: Saved items and success states  
- **Purple gradients**: Proposals and AI features
- **Amber gradients**: Analytics and insights

### **Responsive Design Standards**
- **Mobile-first approach**: Start with 375px base
- **Breakpoints**: sm(640px), md(768px), lg(1024px), xl(1280px)
- **Half-page optimization**: Support windowed applications
- **Touch-friendly navigation**: Mobile hamburger menu

### **Performance Requirements**
- **Virtual scrolling**: Required for lists >1000 items
- **Dynamic imports**: For code splitting large components
- **Next.js Image**: Mandatory for all image optimization
- **Skeleton loading**: For perceived performance improvement

---

## 🔧 Development Patterns

### **State Management Architecture**
- **Server state**: TanStack Query for API data synchronization
- **Client state**: Zustand for local application state
- **Forms**: React Hook Form + Zod for validation and type safety

### **Database Patterns**
- **Supabase**: Cloud PostgreSQL with Row Level Security
- **Connection pooling**: Use `lib/db/connection-pool.ts` for scalability
- **Type generation**: Run `npm run db:types` after schema changes

### **Security Implementation**
- **CSRF protection**: Required on all state-changing mutations
- **Input sanitization**: DOMPurify for all user-generated content
- **Environment validation**: Validate config on application startup
- **Rate limiting**: Implement per-user-tier restrictions

---

## 🔗 Key Integrations

### **SAM.gov API Integration** (`lib/sam-gov/`)
- **Status**: ✅ Operational with 23,300+ opportunities loaded
- **Sync**: Automated daily synchronization configured and working
- **Performance**: 4.24ms average insert time with Redis caching
- **Quota Management**: 1,000 daily API calls with intelligent rate limiting
- **NAICS Matching**: Personalized medical industry matching system

### **AI Services**
- **Claude**: Contract analysis and insights (`lib/ai/claude-client.ts`)
- **Mistral**: Document OCR processing (`lib/ai/mistral-ocr-client.ts`)
- **Cost Optimization**: AI features disabled in development (`ENABLE_AI_FEATURES=false`)

### **Billing System** (`lib/stripe/`)
- **Subscription tiers**: $29 Starter, $99 Professional, $299 Enterprise
- **Usage metering**: Track AI feature usage for billing
- **Webhook handlers**: Process Stripe events securely

### **Background Jobs**
- **Email queue**: Handle notification processing (`emailQueue`)
- **OCR queue**: Document processing pipeline (`ocrQueue`)
- **Sync queue**: SAM.gov data synchronization (`syncQueue`)
- **Worker process**: `npm run worker:dev` for development

### **OCR-Enhanced Proposals Integration** ✨ NEW

**Complete workflow for AI-powered proposal creation with document processing:**

#### **Components Architecture**
```typescript
// Mark for Proposal Button (opportunities page)
components/dashboard/opportunities/mark-for-proposal-button.tsx
- Triggers OCR processing for opportunity documents
- Shows progress modal with processing status
- Navigates to pre-populated proposal form

// Enhanced Proposal Form (proposals/new page)  
components/dashboard/proposals/create-proposal-form.tsx
- Document upload section with drag-and-drop
- Real-time OCR processing integration
- File validation and progress indicators

// Proposal Document Analyzer (comprehensive analysis)
components/dashboard/proposals/proposal-document-analyzer.tsx
- Tabbed interface: Requirements | Summary | Compliance | Raw Text
- AI-powered requirement extraction with Claude
- Export functionality and copy-to-clipboard features
```

#### **API Endpoints for OCR**
```bash
POST /api/ocr/upload                    # Upload documents for processing
POST /api/ocr/process-optimized         # Process opportunity documents  
POST /api/proposals                     # Create proposal with attachments
GET  /api/opportunities/[id]            # Fetch opportunity with documents
```

#### **Database Schema Updates**
```sql
-- Added proposal_documents table for OCR attachments
-- See migration: supabase/migrations/011_proposal_documents_table.sql
-- Includes RLS policies and proper foreign key relationships
```

#### **Development Workflow**
```bash
# Required environment variables for OCR
ANTHROPIC_API_KEY=sk-ant-api03-...     # Claude AI for analysis
MISTRAL_API_KEY=...                    # Mistral for OCR processing
DEVELOPMENT_AUTH_BYPASS=true          # Essential for testing

# Test OCR integration
1. Start development environment: make dev
2. Navigate to opportunities page: http://localhost:3000/opportunities
3. Click "Mark for Proposal" on any opportunity
4. Upload documents and verify OCR processing
5. Review extracted requirements in tabbed interface
```

---

## 🚨 Known Issues & Solutions

> **📖 Complete Reference**: See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed bug fixes and solutions.

### **Common Development Issues**

#### **Next.js Headers Import Error**
**Issue**: Server-side imports causing client-side execution crashes
```typescript
// ❌ Problematic pattern
const supabase = createServiceClient()
await supabase.from('table').insert(...)

// ✅ Safe pattern
if (typeof window === 'undefined') {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()
    // Safe server operations
  } catch (error) {
    console.warn('Failed server operation', error)
  }
}
```

#### **Database Schema Verification**
Always verify actual database field names before writing queries:
```bash
# Check schema structure
curl -s "http://localhost:3000/api/opportunities/public-search?limit=1" | jq '.opportunities[0] | keys'

# Correct field names (verified)
naics_code          # Not primary_naics_code
agency              # Not department  
status: 'active'    # Not active: 'Yes'
place_of_performance_state  # Not nested office_address
```

#### **Performance Debugging**
```bash
# API response time testing
start=$(date +%s%3N); curl -s "http://localhost:3000/api/opportunities/public-search?limit=5" > /dev/null; end=$(date +%s%3N); echo "$((end - start))ms"

# Database record verification
curl -s "http://localhost:3000/api/opportunities/count" | jq '.count'
```

---

## 🧪 Testing & Quality Assurance

### **Testing Infrastructure**
- **Unit Tests**: Jest with React Testing Library
- **Integration Tests**: API route testing with test database
- **E2E Tests**: Playwright for critical user journeys
- **Performance Tests**: API response time validation

### **Critical Test Coverage**
- **User Journey**: Registration → Onboarding → Discovery → Analysis → Proposals
- **Performance Benchmarks**: Landing (<5s), Opportunities (<8s), Search (<3s)
- **Security**: XSS protection, injection prevention, authentication flows
- **Edge Cases**: Offline scenarios, error recovery, rate limiting

### **Quality Standards**
```bash
# Pre-commit checklist
npm run lint              # Code formatting and style
npm run type-check        # TypeScript strict mode compliance
npm test                  # Unit and integration tests
npm run test:e2e          # Critical user journey validation
```

---

## 🌍 Multi-Environment Configuration

### **Environment-Specific Settings**

#### **Development Mode Features**
- **Authentication bypass**: Automatic dev user creation
- **AI features disabled**: Cost optimization during development
- **Enhanced logging**: Detailed error reporting and debugging
- **Hot reload**: Live code updates with error boundaries

#### **Production Readiness Checklist**
- ✅ **Zero TypeScript errors**: Strict mode compliance
- ✅ **Mobile responsive**: 375px to 1400px+ support
- ✅ **Security hardened**: CSRF protection, input sanitization
- ✅ **Performance optimized**: <500ms API response times
- ✅ **Error monitoring**: Sentry integration configured
- ✅ **Database populated**: 23,300+ real opportunities loaded

---

## 🤖 MCP Server Integration

### **Available Development Tools**
- **Puppeteer** (`mcp__puppeteer__*`): Browser automation and testing
- **Supabase** (`mcp__supabase__*`): Database operations and migrations
- **GitHub** (`mcp__github__*`): Repository management and PR creation
- **Context7** (`mcp__context7__*`): Library documentation access

### **Error Debugging Workflow**
1. **Visual debugging**: Puppeteer screenshots on test failures
2. **Database state**: Supabase queries during error reproduction
3. **Documentation lookup**: Context7 for library-specific issues
4. **Error reporting**: Structured logging with actionable insights

---

## 📊 Performance Monitoring

### **Automated User Journey Monitoring** ✅
Production monitoring system validating critical user flows:

#### **Monitoring Coverage**
- **Landing page health** (every 5 minutes): Core site availability
- **Opportunities discovery** (every 10 minutes): Business functionality
- **Authentication flows** (every 15 minutes): User registration/login
- **API health endpoints** (every 2 minutes): Infrastructure status

#### **Monitoring Commands**
```bash
# Local testing
npm run monitor:test                # Validate monitoring system

# Production control
npm run monitor:start              # Start continuous monitoring
npm run monitor:stop               # Stop monitoring
npm run monitor:status             # Check current status
npm run monitor:health-check       # Immediate health verification
```

#### **Dashboard Access**
Visit `/monitoring` for real-time monitoring dashboard with:
- Current monitoring status and active monitors
- Start/stop controls for automated monitoring
- Immediate health check execution across all journeys
- Performance metrics and response time tracking
- User journey success rate analytics

---

## 🎯 Development Best Practices

### **Code Quality Standards**
1. **TypeScript strict mode**: Zero compilation errors required
2. **Consistent naming**: Follow established patterns in codebase
3. **Error handling**: Comprehensive error boundaries and user feedback
4. **Performance**: Consider bundle size and runtime performance
5. **Security**: Validate all inputs and protect against common vulnerabilities

### **Architecture Principles**
1. **Clean Architecture**: Dependencies point inward toward domain
2. **Domain-Driven Design**: Business logic organized by medical contracting domains
3. **Type Safety First**: Leverage TypeScript for compile-time error prevention
4. **Mobile-First Responsive**: Design for mobile, enhance for desktop
5. **Performance by Design**: Virtual scrolling, caching, optimized bundles

### **Git Workflow**
```bash
# Feature development
git checkout develop
git pull origin develop
git checkout -b feature/feature-name

# Development cycle
npm run lint && npm run type-check && npm test
git commit -m 'feat: add feature description'

# Integration
git push origin feature/feature-name
# Create pull request to develop branch
```

---

## 🔗 Essential Resources

### **Documentation Quick Links**
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system design and patterns
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Bug fixes and debugging guides
- **[PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md)** - Current priorities and blockers
- **[NAICS_MATCHING_SYSTEM.md](./NAICS_MATCHING_SYSTEM.md)** - Medical industry matching system

### **External Resources**
- **[Next.js 15 Documentation](https://nextjs.org/docs)** - Framework reference
- **[Supabase Documentation](https://supabase.com/docs)** - Database and auth
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Styling framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Component library

---

## 🆘 Docker + Supabase Troubleshooting

### **Container Management Issues**

#### **Containers Won't Start**
```bash
# Diagnostic commands
docker ps -a                      # Check all container statuses
docker logs medcontract-dev       # View application logs
docker logs medcontract-redis     # View Redis logs
make health-check                 # Verify all services

# Common fixes
docker system prune -f            # Clean up Docker resources
docker-compose down && make dev   # Fresh container start
```

#### **Port Conflicts**
```bash
# Check what's using ports
lsof -i :3000                     # Main development port
lsof -i :3001                     # Staging port 
lsof -i :3002                     # Production port

# Use alternative environments
make staging                      # Port 3001
make prod                        # Port 3002
```

### **Supabase Database Issues**

#### **Connection Failures**
```bash
# Test database connectivity
curl "http://localhost:3000/api/health" | jq '.database'

# Verify environment variables are set
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Common database fixes:
1. Ensure Supabase project is not paused
2. Verify API keys are current and not expired  
3. Check Row Level Security (RLS) policies
4. Test network connectivity to *.supabase.co
```

#### **Multi-Environment Database Switching**
```bash
# Each environment should use different Supabase projects
# Development:  your-dev-project.supabase.co
# Staging:      your-staging-project.supabase.co  
# Production:   your-prod-project.supabase.co

# Verify environment isolation
curl "http://localhost:3000/api/health" | jq '.environment'
curl "http://localhost:3001/api/health" | jq '.environment'
curl "http://localhost:3002/api/health" | jq '.environment'
```

### **Development Authentication**
```bash
# Create development user (bypasses onboarding)
npm run dev-setup

# Clear authentication state
curl -X POST "http://localhost:3000/api/auth/logout"

# Enable development mode (bypasses auth)
export NODE_ENV=development
```

### **Code Quality & Build Issues**
```bash
# Run checks inside Docker container (recommended)
docker exec medcontract-dev npm run lint
docker exec medcontract-dev npm run type-check
docker exec medcontract-dev npm test
docker exec medcontract-dev npm run build

# Performance testing
time curl -s "http://localhost:3000/api/opportunities/public-search?limit=5"
```

### **Common Error Patterns**
- **Next.js headers import errors**: Use dynamic imports for server-only modules
- **Database connection timeouts**: Check Supabase project status and network
- **Container permission issues**: Verify Docker daemon and user permissions
- **Build failures in Docker**: Run lint/type-check inside container first
- **Authentication bypass not working**: Ensure `NODE_ENV=development` is set

### **Getting Help**
- **Immediate issues**: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Architecture questions**: Reference [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Production concerns**: Review [PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md)

---

**Last Updated**: December 6, 2024 | **Next Review**: Weekly during active development

---

> **📋 Documentation Rule**: This project maintains exactly 7 documentation files. **No new documentation files may be created.** All documentation updates must be added to existing files: README.md, DEVELOPER_GUIDE.md, ARCHITECTURE.md, DEPLOYMENT.md, TROUBLESHOOTING.md, PRODUCTION_TASKS.md, or NAICS_MATCHING_SYSTEM.md.

> 🚀 **Ready to build?** Start with `make dev` and visit [http://localhost:3000](http://localhost:3000)
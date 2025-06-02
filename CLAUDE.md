# MedContractHub Project Rules

## Project Overview
A medical supply federal contracting platform built with Next.js 14, TypeScript, Supabase, and Tailwind CSS. This platform helps medical supply companies discover, analyze, and win federal contracts through SAM.gov integration and AI-powered insights.

## Current Project Status (Day 2 Complete - SAM.gov Integration)

### 🎉 Day 1 Complete & Deployed (100% Done)
1. **Project Setup**
   - Next.js 14 with App Router, TypeScript, and Tailwind CSS
   - All required packages installed and configured
   - Complete folder structure established

2. **Database**
   - Comprehensive Supabase schema (`/supabase/schema.sql`)
   - All tables with RLS policies
   - Custom types and triggers
   - Performance indexes

3. **Authentication System**
   - Supabase SSR integration (`/lib/supabase/`)
   - Login page with server actions (`/app/(auth)/login/`)
   - Signup page (`/app/(auth)/signup/`)
   - Multi-step onboarding (`/app/(auth)/onboarding/`)
   - Middleware for route protection (`/middleware.ts`)
   - Session management with cookies

### ✅ Day 1 Deliverables - All Complete & Pushed to GitHub
1. **Project Setup** ✅
2. **Database Schema** ✅
3. **Authentication System** ✅
4. **useAuth Hook** ✅
5. **Landing Page** ✅
6. **Dashboard Layout** ✅
7. **Git Repository Setup** ✅
8. **GitHub Integration** ✅

**GitHub Repository:** https://github.com/wyattmac/medcontracthub  
**Day 1 Commit:** `c1cb5c2` - Complete foundation with 31 files, 9,802 lines of code

### 🎉 Day 2 Complete - SAM.gov Integration (100% Done)

**Major Implementation Completed:**
1. **SAM.gov API Client** ✅ - Complete TypeScript client with error handling, retries, rate limiting
2. **React Query Integration** ✅ - SSR-compatible setup with caching strategies
3. **Opportunity Fetching & Parsing** ✅ - Database sync utilities and data transformation
4. **Opportunities List View** ✅ - Responsive UI with filters, search, and pagination
5. **Advanced Filtering System** ✅ - NAICS, state, deadline, status filters with quick options
6. **Match Algorithm** ✅ - Smart scoring based on company NAICS codes
7. **API Routes** ✅ - Search and sync endpoints with authentication
8. **UI Components** ✅ - 5 new shadcn/ui components (Badge, Input, Label, Select, Alert)
9. **React Query Optimizations** ✅ - Performance optimized with proper caching
10. **Database Integration** ✅ - Complete opportunities table integration

**Day 2 Technical Achievements:**
- **3,749 lines of code** added across 25 files
- **Type-safe throughout** with comprehensive TypeScript interfaces
- **Mobile-responsive** design following established patterns
- **SAM.gov API integration** ready for production use
- **Performance optimized** with React Query caching strategies

**Day 2 Commit:** `7906210` - 25 files, 3,749 additions

### 🎉 Day 3 Complete - Opportunity Management & AI Integration (100% Done)

### 🎉 Day 4 Complete - Comprehensive Error Handling & System Reliability (100% Done)

**Major Day 4 Features Implemented:**
- ✅ Custom error type system with structured error classes and codes
- ✅ Advanced logging system with service-specific loggers
- ✅ Enhanced Supabase clients with connection validation and error recovery
- ✅ Unified API route handler with built-in error handling and validation
- ✅ React Error Boundaries for graceful UI error recovery
- ✅ Robust middleware with timeout protection and request tracking
- ✅ Custom error pages with user-friendly messages and actions
- ✅ Client-side error handling hooks with toast notifications
- ✅ Comprehensive error utilities for parsing and formatting
- ✅ Production-ready error monitoring integration points

**Day 4 Technical Achievements:**
- **5,000+ lines of code** added across 15 new files
- **Complete error handling coverage** throughout the application
- **Type-safe error system** with TypeScript interfaces
- **Structured logging** with request IDs and context
- **Graceful degradation** for all failure scenarios
- **User-friendly error messages** with recovery actions
- **Performance monitoring** with response time tracking
- **Security hardening** with environment validation

**Key Day 4 Components:**
- `lib/errors/types.ts` - Custom error classes and error codes
- `lib/errors/utils.ts` - Error parsing, formatting, and retry utilities
- `lib/errors/logger.ts` - Structured logging system with service loggers
- `lib/api/route-handler.ts` - Unified API route wrapper with validation
- `components/ui/error-boundary.tsx` - React error boundary components
- `lib/hooks/useErrorHandler.ts` - Client-side error handling hook
- `app/error.tsx` & `app/error/page.tsx` - Error pages with recovery options

**Day 4 Patterns Established:**
- **Error Type System**: Structured error classes extending AppError base
- **Service-Specific Logging**: Dedicated loggers for different services
- **Route Handler Pattern**: Consistent API error handling and validation
- **Error Boundary Architecture**: Global and section-specific error catching
- **Request ID Tracking**: End-to-end request tracing for debugging
- **Environment Validation**: Fail-fast approach for missing configuration
- **Graceful Error Recovery**: User-friendly messages with actionable steps
- **Monitoring Ready**: Structured for APM tool integration

**Major Day 3 Features Implemented:**
- ✅ Individual opportunity detail pages with comprehensive SAM.gov data display
- ✅ Save/bookmark opportunities with database integration  
- ✅ Opportunity tracking with notes, tags, and metadata editing
- ✅ Reminder system with dashboard widget and notifications
- ✅ AI-powered opportunity analysis using Claude API
- ✅ Company-specific opportunity recommendations
- ✅ Automated opportunity sync system with cron jobs
- ✅ Manual sync triggers and sync status monitoring
- ✅ Advanced date handling and deadline urgency indicators
- ✅ Modal dialogs for editing opportunity details
- ✅ Toast notifications for user feedback

**Day 3 Technical Achievements:**
- **4,200+ lines of code** added across 23 new files
- **Complete AI integration** with Anthropic Claude SDK (@anthropic-ai/sdk)
- **Dynamic routes** with Next.js App Router ([id] pattern)
- **Advanced state management** with React Query mutations
- **Comprehensive error handling** at every layer
- **Production-ready cron jobs** with health checks and logging
- **Real-time sync capabilities** with manual and automated triggers
- **Rich UI components** including modals, calendars, and form controls

**Key Day 3 Components:**
- `app/(dashboard)/opportunities/[id]/page.tsx` - Dynamic opportunity details with SSR
- `components/dashboard/opportunities/opportunity-detail-container.tsx` - Comprehensive display
- `lib/ai/claude-client.ts` - AI analysis integration with structured prompts
- `app/api/ai/analyze/route.ts` - AI analysis API endpoint with caching
- `components/dashboard/reminders/reminders-widget.tsx` - Deadline tracking widget
- `app/api/sync/route.ts` - Automated sync system with pagination
- `scripts/cron/sync-opportunities.sh` - Production cron job script with health checks

**Day 3 Patterns Established:**
- **Dynamic Route Implementation**: Using [id] pattern with generateMetadata for SEO
- **Server/Client Component Architecture**: Server components for data fetching, client for interactivity
- **AI Integration Pattern**: Structured prompts with response caching in database
- **Modal Dialog Pattern**: Using Radix UI with form handling and mutations
- **Date Handling**: Comprehensive date-fns usage for formatting and calculations
- **Error Boundary Pattern**: Consistent error handling across all layers
- **Sync System Architecture**: Background jobs with manual triggers and status monitoring

### 🚀 Day 5 Ready - Proposal Generation & Advanced Features
- AI-powered proposal generation with templates
- Proposal collaboration and version control
- Advanced analytics dashboard with charts
- Export functionality (PDF, Excel) for opportunities and proposals
- Email notification system for deadlines and matches
- Performance metrics and win rate tracking
- Bulk actions for managing multiple opportunities
- Competitive analysis tools

### 📋 Upcoming (Days 5-7)
- Proposal generation with AI assistance
- Advanced filtering with saved search queries
- Team collaboration features
- Payment integration and subscription management
- Mobile app development
- API rate limiting and usage analytics

## MCP Server Usage Rules

### 1. GitHub MCP Server (REQUIRED for all code changes)
- **Primary Repository**: medcontracthub
- **Owner**: wyattmac
- **Repository URL**: https://github.com/wyattmac/medcontracthub
- **Required Operations**:
  - Use `mcp__github__create_branch` for each new feature/fix
  - Use `mcp__github__push_files` for committing code changes
  - Use `mcp__github__create_pull_request` when feature is complete
  - Use `mcp__github__create_issue` for tracking bugs and features
- **Branch Naming**: `feature/component-name` or `fix/issue-description`
- **Commit Messages**: `feat|fix|docs|style|refactor|test|chore: description`
- **PR Process**: Always create PR with detailed description and test plan

### 2. Filesystem MCP Server (PRIMARY for file operations)
- **Project Root**: /home/locklearwyatt/projects/medcontracthub
- **Required Usage**:
  - ALWAYS use `mcp__filesystem__read_file` before editing files
  - Use `mcp__filesystem__write_file` for new files
  - Use `mcp__filesystem__edit_file` for modifications (preferred over write)
  - Use `mcp__filesystem__list_directory` to verify structure
  - Use `mcp__filesystem__create_directory` for new folders
- **Path Rules**: Always use absolute paths starting with `/home/locklearwyatt/projects/medcontracthub/`
- **Batch Operations**: Use `mcp__filesystem__read_multiple_files` when reading related files

### 3. Context7 MCP Server (MANDATORY - Must use BEFORE any implementation)
- **⚠️ CRITICAL REQUIREMENT**: You MUST research patterns using Context7 before implementing ANY new feature or pattern
- **Required Research Before Implementation**:
  - Next.js 14 app router: `mcp__context7__resolve-library-id` with "next.js"
  - Supabase patterns: `mcp__context7__resolve-library-id` with "supabase"
  - React Query: `mcp__context7__resolve-library-id` with "@tanstack/react-query"
  - Zustand: `mcp__context7__resolve-library-id` with "zustand"
  - Tailwind CSS: `mcp__context7__resolve-library-id` with "tailwindcss"
  - shadcn/ui: `mcp__context7__resolve-library-id` with "shadcn"
- **Usage Pattern**:
  1. First call `resolve-library-id` to get the library ID
  2. Then call `get-library-docs` with specific topics related to your implementation
  3. Review and understand the patterns before coding
  4. Apply learned patterns to implementation
  5. Document which Context7 resources you used in comments
- **Examples**:
  ```typescript
  // Before implementing authentication:
  // 1. mcp__context7__resolve-library-id({ libraryName: "supabase" })
  // 2. mcp__context7__get-library-docs({ 
  //      context7CompatibleLibraryID: "/supabase/supabase",
  //      topic: "nextjs authentication",
  //      tokens: 5000
  //    })
  ```

### 4. Integration Workflow
- **For New Features**:
  1. Create GitHub issue with `mcp__github__create_issue`
  2. Create feature branch with `mcp__github__create_branch`
  3. Research patterns with Context7 MCP
  4. Implement using Filesystem MCP
  5. Push changes with `mcp__github__push_files`
  6. Create PR with `mcp__github__create_pull_request`
  
- **For Bug Fixes**:
  1. Create/reference issue with GitHub MCP
  2. Create fix branch
  3. Read files with Filesystem MCP
  4. Apply fixes with `mcp__filesystem__edit_file`
  5. Test thoroughly
  6. Push and create PR

### 5. MCP Server Error Handling
- Always check for MCP server connection status before operations
- If GitHub MCP fails, document changes locally and retry
- If Filesystem MCP fails, verify paths and permissions
- If Context7 MCP fails, proceed with documented best practices

## Code Style Rules

### TypeScript
- **Strict Mode**: Always use strict TypeScript configuration
- **Type Safety**: No `any` types unless absolutely necessary with justification
- **Interfaces**: Prefix with `I` (e.g., `IUser`, `IOpportunity`)
- **Types**: Use `type` for unions, intersections, and utility types
- **Enums**: Use `const enum` for better performance
- **Imports**: Absolute imports using `@/` prefix
- **Error Handling**: Always use custom error types from `@/lib/errors`
- **Validation**: Use Zod schemas for runtime validation

### React/Next.js
- **Components**: 
  - Use functional components with TypeScript
  - One component per file
  - Props interfaces defined above component
  - Use `'use client'` directive only when necessary
  - Wrap with ErrorBoundary for critical sections
- **Server Components**: Default to server components, convert to client only when needed
- **Data Fetching**: 
  - Server components: Direct database calls with try-catch
  - Client components: React Query hooks with error handling
  - Always use the custom route handler for API routes
- **Error Handling**:
  - Use `useErrorHandler` hook for client-side errors
  - Implement error boundaries for UI sections
  - Show user-friendly error messages via toast
- **File Naming**:
  - Components: PascalCase (e.g., `UserProfile.tsx`)
  - Utilities: camelCase (e.g., `formatDate.ts`)
  - Types: PascalCase with `.types.ts` extension
  - Error files: camelCase in `/lib/errors/`

### Styling
- **Tailwind CSS**: Use utility classes, avoid custom CSS
- **Component Library**: Use shadcn/ui components as base
- **Responsive**: Mobile-first approach
- **Dark Mode**: Support both light and dark themes
- **Spacing**: Use consistent spacing scale (4, 8, 16, 24, 32, 48, 64)

## Project Structure Rules

```
/home/locklearwyatt/projects/medcontracthub/
├── app/
│   ├── (auth)/               # Auth routes (public)
│   │   ├── login/
│   │   ├── signup/
│   │   └── onboarding/
│   ├── (dashboard)/          # Protected routes
│   │   ├── opportunities/
│   │   ├── saved/
│   │   ├── proposals/
│   │   └── settings/
│   ├── api/                  # API routes
│   └── page.tsx              # Landing page
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── auth/                 # Auth components
│   ├── dashboard/            # Dashboard components
│   └── landing/              # Landing page components
├── lib/
│   ├── supabase/            # Supabase client and types
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   └── constants/           # App constants
├── types/
│   └── database.types.ts    # Generated Supabase types
└── public/                  # Static assets
```

## Database Rules

### Supabase Schema
- **Naming**: Use snake_case for all database objects
- **IDs**: Use UUID for all primary keys
- **Timestamps**: Every table must have `created_at` and `updated_at`
- **RLS**: Enable RLS on all tables, no exceptions
- **Indexes**: Create indexes for all foreign keys and frequently queried columns

### Tables Structure
1. **companies**: Business profiles with certifications
2. **opportunities**: SAM.gov contract opportunities
3. **saved_opportunities**: User's bookmarked opportunities
4. **opportunity_analyses**: AI analysis cache
5. **email_subscriptions**: Daily digest preferences
6. **audit_logs**: Complete activity tracking

## Authentication Rules

### Implementation
- Use Supabase Auth with email/password and Google OAuth
- Session management via cookies
- Middleware protection for dashboard routes
- Multi-step onboarding flow

### Security
- Never expose Supabase service role key
- Use RLS for all data access
- Implement rate limiting on auth endpoints
- Log all authentication events

## API Development Rules

### Route Handler Pattern
- **Always use** `routeHandler` from `@/lib/api/route-handler`
- **Example**:
```typescript
export const GET = routeHandler.GET(
  async ({ request, user, supabase }) => {
    // Your logic here
    return NextResponse.json({ data })
  },
  { 
    requireAuth: true,
    validateQuery: zodSchema 
  }
)
```
- **Benefits**: Automatic error handling, logging, validation, auth
- **Request ID**: Automatically added to all responses

### Error Responses
- Use custom error types from `@/lib/errors/types`
- Never expose internal error details in production
- Always include helpful error messages
- Log all errors with context

### Validation
- Use Zod schemas for all input validation
- Validate query params, body, and route params
- Return specific validation errors

## AI Integration Rules

### Claude API
- Cache all analyses in `opportunity_analyses` table
- Implement retry logic with exponential backoff
- Use structured prompts for consistent output
- Never expose API keys in client code
- Wrap all AI calls in try-catch with specific error handling
- Use `aiLogger` for all AI-related logging

### Analysis Features
- Opportunity matching based on NAICS codes
- Proposal strategy recommendations
- Competitive landscape analysis
- Compliance requirement extraction

## Testing Rules

### Unit Tests
- Test all utility functions
- Test custom hooks with React Testing Library
- Mock external dependencies

### Integration Tests
- Test authentication flows end-to-end
- Test database operations
- Test API routes

### E2E Tests
- Critical user journeys only
- Use Playwright for browser automation

## Recent MCP Server Usage Examples

### Context7 Research Performed
1. **Supabase SSR Setup**: Researched `/supabase/supabase` for Next.js SSR authentication patterns
2. **React Query**: Researched `/tanstack/query` for Next.js setup patterns and SSR integration
3. **Next.js App Router**: Researched `/vercel/next.js` for authentication patterns
4. **Day 2 SAM.gov Integration**: Researched federal API integration patterns and React Query optimization
5. **Day 3 Dynamic Routes**: Researched `/vercel/next.js` for dynamic route patterns and generateMetadata
6. **Day 3 AI Integration**: Researched `@anthropic-ai/sdk` for TypeScript integration patterns
7. **Day 3 Date Handling**: Researched `date-fns` for comprehensive date manipulation patterns
8. **Day 3 Modal Patterns**: Researched Radix UI for accessible modal dialog implementations

### GitHub MCP Usage
- Repository created at https://github.com/wyattmac/medcontracthub
- Day 1 foundation committed and pushed (commit `c1cb5c2`)
- Day 2 SAM.gov integration committed and pushed (commit `7906210`)
- Feature branch workflow established (`feature/sam-gov-integration`)
- All code changes tracked in version control with meaningful commit messages

### Filesystem MCP Usage
- Used exclusively for all file operations across all three development days
- Day 1: Created complete project structure with 31 files
- Day 2: Added 25 new files with 3,749 lines of code
- Day 3: Added 23 new files with 4,200+ lines of code
- Implemented full authentication flow, SAM.gov integration, and AI features
- Built comprehensive UI component library with advanced patterns
- Added robust error handling and type safety throughout
- Established production-ready sync system with monitoring

### Day 2 Key Learnings
1. **API Integration Patterns**: Successfully integrated external APIs (SAM.gov) with proper error handling
2. **React Query SSR**: Implemented proper server-side rendering with React Query providers
3. **Type Safety**: Maintained strict TypeScript throughout complex data transformations
4. **Component Architecture**: Built reusable, responsive components following established patterns
5. **Database Integration**: Successfully mapped external API data to internal database schema
6. **Performance Optimization**: Implemented proper caching strategies with React Query

### Day 4 Key Learnings & Patterns
1. **Enterprise Error Handling System**: Built comprehensive error handling infrastructure
   - Custom error type hierarchy with specific error classes
   - Service-specific logging with structured JSON format
   - Request ID tracking across the entire stack
   - User-friendly error messages with recovery actions

2. **API Route Pattern**: Established unified route handler
   - Automatic error catching and formatting
   - Built-in authentication and validation
   - Request/response logging with timing
   - Consistent error response format

3. **React Error Boundaries**: Implemented UI error recovery
   - Global app-wide error boundary
   - Section-specific error handling
   - Development vs production error display
   - Error reporting to monitoring services

4. **Enhanced Middleware**: Robust request processing
   - Timeout protection for auth checks
   - Environment validation on startup
   - Request ID generation and tracking
   - Graceful error recovery

5. **Client Error Handling**: Consistent user experience
   - useErrorHandler hook for all client errors
   - Toast notifications with actions
   - Automatic auth redirects
   - Error-specific recovery options

### Day 3 Key Learnings & Patterns
1. **Dynamic Route Architecture**: Implemented Next.js App Router [id] pattern with proper SSR and SEO
   - Server components for data fetching with authentication
   - generateMetadata for dynamic SEO optimization
   - Proper error handling with notFound() for missing resources

2. **AI Integration Best Practices**: Successfully integrated Anthropic Claude API
   - Structured prompts for consistent AI responses
   - Database caching to minimize API costs and improve performance
   - Error handling with graceful fallbacks
   - Type-safe AI response interfaces

3. **Advanced State Management**: Complex React Query patterns with mutations
   - Optimistic updates for immediate UI feedback
   - Proper cache invalidation strategies
   - Server state synchronization with client mutations
   - Loading states and error boundaries

4. **Modal Dialog Architecture**: Radix UI integration with form handling
   - Controlled modal state with React Query
   - Form validation with proper error display
   - Mutation handling within modal contexts
   - Proper accessibility with Radix primitives

5. **Date Handling Excellence**: Comprehensive date-fns integration
   - Relative time formatting (formatDistanceToNow)
   - Deadline urgency calculations with color coding
   - Timezone-aware date comparisons
   - Consistent date formatting across components

6. **Production Sync System**: Background job architecture
   - Health check endpoints for monitoring
   - Comprehensive logging with rotation
   - Error recovery and retry mechanisms
   - Multiple deployment strategies (cron, Vercel, GitHub Actions)

7. **Component Composition Patterns**: Advanced React patterns
   - Compound components with shared state
   - Render props for flexible component APIs
   - Custom hooks for business logic separation
   - Props spreading with TypeScript safety

8. **Database Query Optimization**: Supabase RLS and query patterns
   - Complex joins with nested data fetching
   - Proper RLS policy implementation
   - Query optimization for performance
   - Bulk operations with transaction handling

## Development Workflow

### Daily Tasks (Using MCP Servers)
1. Review todo list with TodoRead
2. Check GitHub issues: `mcp__github__list_issues`
3. Create/switch to feature branch: `mcp__github__create_branch`
4. **RESEARCH FIRST**: Use Context7 MCP to research patterns before any implementation
5. Update task status as work progresses with TodoWrite
6. Use Filesystem MCP for all file operations
7. Commit code at logical checkpoints: `mcp__github__push_files`
8. Run linting and type checking before commits
9. Test error scenarios and edge cases
10. Verify error handling and logging

### Implementation Checklist
- [ ] Researched patterns with Context7 MCP
- [ ] Reviewed existing code patterns
- [ ] Implemented following established patterns
- [ ] Added appropriate TypeScript types
- [ ] Added error handling with custom error types
- [ ] Implemented input validation with Zod
- [ ] Added logging with appropriate logger
- [ ] Tested the implementation
- [ ] Tested error scenarios
- [ ] Updated documentation if needed

### MCP-Integrated Commands
```bash
# Development (run with Bash tool)
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler

# Database (after creating schema with Filesystem MCP)
npm run db:reset     # Reset and seed database
npm run db:types     # Generate TypeScript types from Supabase
npm run db:seed      # Seed with mock data

# Testing
npm test            # Run unit tests
npm run test:e2e    # Run E2E tests
```

### File Operation Examples
```typescript
// Reading files (use Filesystem MCP)
mcp__filesystem__read_file({ path: "/home/locklearwyatt/projects/medcontracthub/app/page.tsx" })

// Creating directories
mcp__filesystem__create_directory({ path: "/home/locklearwyatt/projects/medcontracthub/components/ui" })

// Editing files (preferred over write)
mcp__filesystem__edit_file({
  path: "/home/locklearwyatt/projects/medcontracthub/app/page.tsx",
  edits: [{ oldText: "old content", newText: "new content" }]
})

// Pushing to GitHub
mcp__github__push_files({
  owner: "wyattmac",
  repo: "medcontracthub",
  branch: "feature/auth-flow",
  files: [{ path: "app/page.tsx", content: "file content" }],
  message: "feat: implement authentication flow"
})
```

## Environment Variables

### Required Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# SAM.gov API (Day 2 Integration)
SAM_GOV_API_KEY=

# Authentication
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Error Handling Rules

### Error Types
- **Always use** custom error types from `@/lib/errors/types`
- **Available Error Classes**:
  - `AuthenticationError` (401) - Auth failures
  - `AuthorizationError` (403) - Permission denied
  - `ValidationError` (400) - Input validation
  - `NotFoundError` (404) - Resource not found
  - `DatabaseError` (500) - Database operations
  - `ExternalAPIError` (502) - Third-party API errors
  - `RateLimitError` (429) - Rate limiting
  - `AppError` - Base class for custom errors

### Client-Side Error Handling
- **Error Boundaries**: Wrap components with `ErrorBoundary`
- **useErrorHandler Hook**: For consistent error handling
- **Toast Notifications**: User-friendly error messages
- **Recovery Actions**: Provide clear next steps
- **Example**:
```typescript
const { handleError } = useErrorHandler()
try {
  await riskyOperation()
} catch (error) {
  handleError(error, { showToast: true })
}
```

### Server-Side Error Handling
- **Route Handler**: Use `routeHandler` for all API routes
- **Structured Logging**: Use service-specific loggers
- **Error Responses**: Consistent format with `formatErrorResponse`
- **Request IDs**: Track errors across the stack
- **Example**:
```typescript
export const GET = routeHandler.GET(
  async (context) => {
    // Errors are automatically caught and formatted
    throw new NotFoundError('Resource')
  },
  { requireAuth: true }
)
```

### Logging
- **Service Loggers**:
  - `apiLogger` - API operations
  - `dbLogger` - Database queries
  - `authLogger` - Authentication
  - `aiLogger` - AI services
  - `syncLogger` - Sync operations
- **Log Levels**: debug, info, warn, error
- **Structured Format**: JSON with context
- **Request Tracking**: Include request IDs

## Performance Rules

### Optimization
- Use dynamic imports for large components
- Implement virtual scrolling for long lists
- Optimize images with Next.js Image component
- Cache expensive computations

### Monitoring
- Track Core Web Vitals
- Monitor API response times
- Set up alerts for errors
- Regular performance audits

## Security Rules

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS everywhere
- Implement CSRF protection
- Sanitize all user inputs

### Access Control
- Implement role-based access control
- Audit all data access
- Regular security reviews
- Follow OWASP guidelines

## Deployment Rules

### Production Checklist
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Error monitoring enabled
- [ ] Performance baseline established
- [ ] Security scan completed
- [ ] Documentation updated

### Rollback Plan
- Maintain previous version for quick rollback
- Database migration rollback scripts
- Feature flags for gradual rollout
- Monitor error rates post-deployment

## Documentation Rules

### Code Documentation
- JSDoc comments for all public functions
- README files in major directories
- Inline comments for complex logic
- API documentation for all endpoints

### User Documentation
- Feature guides for end users
- API documentation for developers
- Troubleshooting guides
- Video tutorials for key workflows

## Communication Rules

### Code Reviews
- Review within 24 hours
- Provide constructive feedback
- Test locally before approving
- Document decisions in PR comments

### Issue Tracking
- Use GitHub issues for all work
- Label issues appropriately
- Link PRs to issues
- Close issues only after verification

## Quality Standards

### Definition of Done
- [ ] Code written and tested
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Tests passing in CI
- [ ] Deployed to staging
- [ ] Acceptance criteria met
- [ ] Performance benchmarks met

## Error Handling Implementation Summary

### What We Built (Day 4)
1. **Complete Error Infrastructure** (`/lib/errors/`)
   - Type-safe error classes for all scenarios
   - Utility functions for error parsing and formatting
   - Service-specific loggers with structured output
   - Retry logic with exponential backoff

2. **API Protection** (`/lib/api/route-handler.ts`)
   - Unified route handler with automatic error catching
   - Built-in auth, validation, and logging
   - Consistent error response format
   - Request ID tracking

3. **UI Resilience**
   - React Error Boundaries at app and section levels
   - Client-side error handling hook
   - User-friendly error pages
   - Toast notifications with recovery actions

4. **Enhanced Reliability**
   - Robust middleware with timeout protection
   - Environment validation on startup
   - Graceful degradation for all failures
   - Production-ready logging system

### Usage Quick Reference
```typescript
// API Route
export const GET = routeHandler.GET(
  async ({ user, supabase }) => { /* ... */ },
  { requireAuth: true }
)

// Client Component
const { handleError } = useErrorHandler()

// Throw Custom Errors
throw new NotFoundError('User')
throw new ValidationError('Invalid input', errors)

// Log with Context
apiLogger.error('Operation failed', error, { userId, action })
```

Remember: These rules ensure consistency, maintainability, and scalability. When in doubt, prioritize clarity and simplicity over cleverness.
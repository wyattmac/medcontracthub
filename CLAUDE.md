# MedContractHub Project Rules

## Project Overview
A medical supply wholesale distributor platform built with Next.js 14, TypeScript, Supabase, and Tailwind CSS. This platform helps wholesale distributors discover federal contracts, extract product requirements using AI, automatically source products from online suppliers, and generate competitive bids through intelligent matching and cost aggregation.

## Current Project Status (Day 6+ In Progress)

**Core Systems Operational:**
- ✅ **Authentication**: Complete Supabase SSR integration with multi-step onboarding
- ✅ **Database**: Full schema with RLS policies, indexed tables, and audit logging
- ✅ **SAM.gov Integration**: 22,532+ opportunities with sync system and filtering
- ✅ **AI Features**: Claude API integration for opportunity analysis and recommendations
- ✅ **Error Handling**: Comprehensive error infrastructure with monitoring and recovery
- ✅ **Security**: Environment validation, rate limiting, CSRF protection, input sanitization
- ✅ **Export System**: Professional PDF reports and Excel workbooks with bulk operations
- ✅ **Email Notifications**: Deadline reminders and opportunity match alerts with Resend integration
- ✅ **Analytics Dashboard**: Basic analytics API endpoint with chart components
- ✅ **Testing Infrastructure**: Unit tests, E2E tests with Playwright setup
- ✅ **Performance Optimization**: Database query optimization, lazy loading, bundle splitting, caching
- 🚧 **Wholesale Distributor AI**: Mistral OCR integration, product sourcing engine (Planning)

### 🎉 Day 5 Complete - Advanced Features & Email System (Production Ready)

**System Architecture Assessment Complete (Senior Architect Review):**
- ✅ **Core Infrastructure**: All critical systems operational and type-safe
- ✅ **Security Hardening**: Next.js vulnerabilities resolved, environment validation
- ✅ **API Integration**: SAM.gov + Claude APIs tested and operational
- ✅ **Error Handling**: Comprehensive error infrastructure with monitoring
- ✅ **Database**: Schema validated, RLS policies active, connections verified
- ✅ **Authentication**: End-to-end auth flow tested and secure
- ✅ **Type Safety**: Critical business logic fully type-safe
- 🟡 **Non-blocking Issues**: Minor TypeScript cosmetic errors (UI variants)
- 🔄 **Active Development**: CSRF protection, input sanitization, E2E testing

**Day 5 Features Implemented (COMPLETE):**
1. ✅ **Export System** - Professional PDF reports and Excel workbooks with bulk operations
   - React-PDF integration for professional opportunity reports
   - XLSX/SheetJS for multi-sheet Excel exports with NAICS analysis
   - Bulk export UI with advanced filtering and customization options
   - API endpoints with proper file download handling and error recovery

2. ✅ **Email Notification System** - Complete deadline reminders and notifications
   - Resend + React Email integration with professional templates
   - Smart deadline reminders (24h, 3d, 7d before deadline)
   - Opportunity match notifications with NAICS-based matching
   - Welcome email sequences for new user onboarding
   - ReminderButton UI component integrated into opportunity details

**Day 5+ Technical Achievements:**
- **Export Infrastructure**: React-PDF + XLSX with streaming support for large datasets
- **Email Service**: Resend API with lazy client initialization and comprehensive error handling
- **UI Enhancement**: Bulk operations, export dialogs, reminder interfaces
- **Type Safety**: Full TypeScript coverage with Zod validation
- **Error Handling**: Service-specific logging and graceful failure recovery
- **Security Enhancement**: CSRF protection, input sanitization with DOMPurify
- **Testing Setup**: Jest unit tests + Playwright E2E test infrastructure
- **Analytics Foundation**: API endpoint + chart components (UI implementation pending)
- **Production Ready**: Build optimization and environment validation

### 🎉 Day 6 Complete - Performance Optimization & Testing Infrastructure

**Performance Improvements Implemented:**
- ✅ **Database Optimization**: Query-level sorting in Supabase instead of in-memory
- ✅ **Bundle Splitting**: Separated vendor, charts, PDF, Excel, and email bundles
- ✅ **Lazy Loading**: Dynamic imports for heavy components (OpportunityDetail, Analytics)
- ✅ **API Caching**: In-memory cache with LRU eviction for search results
- ✅ **Test Infrastructure**: Jest with SWC for 2-3x faster test execution
- ✅ **Test Scripts**: Granular test commands for targeted testing

### 📋 Upcoming - Wholesale Distributor AI Features (Days 7-10)
- 🚧 **In Progress**: Mistral OCR integration for document processing
- 🚧 **In Progress**: Database schema for products, suppliers, and sourcing
- ❌ **Not Started**: Web scraping engine for supplier discovery  
- ❌ **Not Started**: AI product matching and scoring system
- ❌ **Not Started**: Supplier vetting and qualification workflow
- ❌ **Not Started**: Sourcing dashboard and cost aggregation
- ❌ **Not Started**: Automated bid preparation assistance

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
- **Strategic Type Assertions**: Use `as any` for database compatibility when types conflict
- **Interfaces**: Prefix with `I` (e.g., `IUser`, `IOpportunity`, `IChartData`)
- **Types**: Use `type` for unions, intersections, and utility types
- **Enums**: Use `const enum` for better performance
- **Imports**: Absolute imports using `@/` prefix
- **Error Handling**: Always use custom error types from `@/lib/errors`
- **Validation**: Use Zod schemas for runtime validation
- **Day 5 Additions**:
  - Chart component props: Use strict typing with Recharts interfaces
  - Export functions: Type file generation outputs explicitly
  - Email templates: Use template literal types for type safety

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
│   │   ├── analytics/        # Analytics dashboard
│   │   └── settings/         # Settings page (not implemented)
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

## Implementation Patterns

### MCP Server Integration
- **Context7 Research**: All major libraries researched (Next.js, Supabase, React Query, Claude AI)
- **GitHub Workflow**: Feature branch workflow with meaningful commits (latest: `feature/sam-gov-integration`)
- **Filesystem Operations**: All file operations use MCP filesystem server

### Key Architecture Patterns
- **Route Handler**: Unified API route handling with automatic error catching, auth, and validation
- **Error Boundaries**: Global and section-specific error recovery with user-friendly fallbacks
- **AI Integration**: Structured prompts with database caching and type-safe responses
- **Dynamic Routes**: [id] pattern with SSR, generateMetadata, and proper error handling
- **State Management**: React Query with optimistic updates and cache invalidation

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
- [ ] Added appropriate TypeScript types (with strategic assertions if needed)
- [ ] Added error handling with custom error types
- [ ] Implemented input validation with Zod
- [ ] Added logging with appropriate logger
- [ ] Tested the implementation
- [ ] Tested error scenarios
- [ ] **Day 5 Additions**:
  - [ ] Performance impact assessed for charts/exports
  - [ ] Email templates tested across clients
  - [ ] Bulk operations tested with large datasets
  - [ ] Export file sizes validated
  - [ ] Chart accessibility verified
- [ ] Updated documentation if needed

### MCP-Integrated Commands
```bash
# Development (run with Bash tool)
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler (accept strategic 'any' assertions)

# Database (after creating schema with Filesystem MCP)
npm run db:reset     # Reset and seed database
npm run db:types     # Generate TypeScript types from Supabase
npm run db:seed      # Seed with mock data

# Day 5 Development Commands
npm run test         # Run unit tests (Jest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate test coverage report
npm run test:e2e     # Run E2E tests (Playwright - not implemented yet)
npm run test:ci      # Run tests in CI mode

# Testing
npm test            # Run unit tests
npm run test:e2e    # Run E2E tests
npm run test:load   # Load testing for bulk operations
```

### Code Examples

#### API Route Pattern
```typescript
export const GET = routeHandler.GET(
  async ({ user, supabase }) => { /* ... */ },
  { requireAuth: true }
)
```

#### Error Handling
```typescript
const { handleError } = useErrorHandler()
throw new NotFoundError('Resource')
apiLogger.error('Operation failed', error, { context })
```

#### File Operations (MCP)
```typescript
mcp__filesystem__read_file({ path: "/home/locklearwyatt/projects/medcontracthub/app/page.tsx" })
mcp__github__push_files({ owner: "wyattmac", repo: "medcontracthub", branch: "feature/name", files: [...] })
```

## Environment Variables

### Required Variables
```env
# Supabase (Validated & Operational)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# External APIs (Validated & Working)
SAM_GOV_API_KEY=your_sam_gov_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Day 5 Features (Operational)
RESEND_API_KEY=your_resend_api_key_here

# Wholesale Distributor AI (Day 7+)
MISTRAL_API_KEY=your_mistral_api_key_here

# Email System Configuration (Day 5 Complete)
FROM_EMAIL=noreply@medcontracthub.com
FROM_NAME=MedContractHub

# Authentication (Optional - for OAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Security (Optional - defaults provided)
CSRF_SECRET=medcontracthub-csrf-secret-2024
```

### Environment Status
- ✅ **Supabase**: Connected and validated
- ✅ **SAM.gov API**: 22,532+ opportunities accessible
- ✅ **Claude AI**: Analysis and recommendations operational
- ✅ **Resend Email**: Day 5 notification system operational
- ✅ **Export System**: PDF/Excel generation ready
- 🔄 **Google OAuth**: Optional enhancement
- ✅ **Security**: CSRF protection active

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
  - `emailLogger` - Email notifications and reminders (Day 5)
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

## Production Readiness Status

**Overall Score: 85/100** - Core features operational with ongoing security and analytics enhancements.

### Recent Achievements ✅
1. **Export System**: Professional PDF reports and Excel workbooks with bulk operations
2. **Email Notifications**: Complete deadline reminder system with Resend integration
3. **Security Enhancements**: CSRF protection and input sanitization implemented
4. **Testing Infrastructure**: Jest + Playwright setup with initial test coverage
5. **Analytics Foundation**: API endpoint and chart components ready
6. **UI Enhancement**: Bulk export dialogs and reminder interfaces
7. **Type Safety**: Full TypeScript coverage with strategic database compatibility

### Current Work in Progress
1. **Analytics Dashboard**: Complete UI implementation with data visualization
2. **Testing**: Expand test coverage for critical paths
3. **Security**: Implement security headers and enhanced monitoring
4. **Performance**: Virtual scrolling for large datasets

### Pending Features (Days 6-8)
1. **Proposal Templates**: AI-powered generation with customizable templates
2. **Advanced Search**: Saved queries and smart filters
3. **Team Features**: Collaboration and workflow management
4. **Monetization**: Payment integration and subscription tiers
5. **Mobile**: Progressive Web App development
6. **Monitoring**: Usage analytics and performance tracking

### Architecture Quality
- ✅ **Error Handling**: Comprehensive infrastructure with monitoring
- ✅ **Type Safety**: Strategic assertions for database compatibility  
- ✅ **API Integration**: SAM.gov + Claude AI + Resend Email operational
- ✅ **Security**: Environment validation and access controls
- ✅ **Export Infrastructure**: React-PDF + XLSX with streaming support
- ✅ **Email System**: Professional templates with deadline management

### Implementation Status by Feature

**✅ Completed Features:**
- Authentication & onboarding flow
- SAM.gov integration with 22k+ opportunities
- AI analysis and recommendations
- Opportunity search, save, and management
- Proposal creation and tracking
- Export system (PDF/Excel)
- Email notifications and reminders
- Error handling infrastructure
- Basic rate limiting
- CSRF protection
- Input sanitization

**🔄 In Progress:**
- Analytics dashboard UI (API complete, UI pending)
- E2E test implementation
- Security headers
- Performance optimizations

**❌ Not Started:**
- Proposal templates
- Advanced search filters
- Team collaboration
- Payment integration
- Mobile PWA
- Usage analytics
- Advanced compliance features

Remember: These rules ensure consistency, maintainability, and scalability. When in doubt, prioritize clarity and simplicity over cleverness.
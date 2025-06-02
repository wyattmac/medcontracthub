# MedContractHub Project Rules

## Project Overview
A medical supply federal contracting platform built with Next.js 14, TypeScript, Supabase, and Tailwind CSS. This platform helps medical supply companies discover, analyze, and win federal contracts through SAM.gov integration and AI-powered insights.

## Current Project Status (Day 1 Complete)

### ✅ Completed Components (Day 1 - 100% Complete)
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

### ✅ Day 1 Deliverables - All Complete
1. **Project Setup** ✅
2. **Database Schema** ✅
3. **Authentication System** ✅
4. **useAuth Hook** ✅
5. **Landing Page** ✅
6. **Dashboard Layout** ✅

### 📋 Upcoming (Days 2-5)
- SAM.gov integration
- AI-powered analysis features
- Email notifications
- Payment integration

## MCP Server Usage Rules

### 1. GitHub MCP Server (REQUIRED for all code changes)
- **Primary Repository**: medcontracthub
- **Owner**: locklearwyatt
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

### React/Next.js
- **Components**: 
  - Use functional components with TypeScript
  - One component per file
  - Props interfaces defined above component
  - Use `'use client'` directive only when necessary
- **Server Components**: Default to server components, convert to client only when needed
- **Data Fetching**: 
  - Server components: Direct database calls
  - Client components: React Query hooks
- **File Naming**:
  - Components: PascalCase (e.g., `UserProfile.tsx`)
  - Utilities: camelCase (e.g., `formatDate.ts`)
  - Types: PascalCase with `.types.ts` extension

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

## AI Integration Rules

### Claude API
- Cache all analyses in `opportunity_analyses` table
- Implement retry logic with exponential backoff
- Use structured prompts for consistent output
- Never expose API keys in client code

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
2. **React Query**: Researched `/tanstack/query` for Next.js setup patterns
3. **Next.js App Router**: Researched `/vercel/next.js` for authentication patterns

### GitHub MCP Usage
- All code changes tracked in repository
- Ready for feature branches and pull requests

### Filesystem MCP Usage
- Used exclusively for all file operations
- Created complete project structure
- Implemented authentication flow

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

### Implementation Checklist
- [ ] Researched patterns with Context7 MCP
- [ ] Reviewed existing code patterns
- [ ] Implemented following established patterns
- [ ] Added appropriate TypeScript types
- [ ] Tested the implementation
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
  owner: "locklearwyatt",
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

### Client-Side
- Use error boundaries for component errors
- Show user-friendly error messages
- Log errors to monitoring service
- Provide recovery actions

### Server-Side
- Wrap API routes in try-catch blocks
- Return consistent error responses
- Log errors with context
- Never expose internal errors to clients

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

Remember: These rules ensure consistency, maintainability, and scalability. When in doubt, prioritize clarity and simplicity over cleverness.
# MedContractHub

AI-powered platform to help medical supply companies discover, analyze, and win federal contracts through SAM.gov integration.

## 🚀 Overview

MedContractHub is a comprehensive federal contracting platform designed specifically for medical supply companies. It streamlines the process of finding, analyzing, and bidding on government contracts by leveraging AI-powered insights and automated workflows.

## 📅 Development Progress

- **Day 1**: ✅ Foundation Complete - Authentication, Database, UI Components
- **Day 2**: ✅ SAM.gov Integration - API Client, Opportunity Search, Filtering
- **Day 3**: ✅ Opportunity Management - AI Analysis, Reminders, Sync System
- **Day 4**: ✅ Error Handling & Reliability - Custom Errors, Logging, Recovery
- **Day 5**: 🚧 Proposal Generation - AI Templates, Collaboration, Analytics

## 🎯 Key Features

- **Smart Opportunity Discovery**: Automatically find relevant federal contracts based on your NAICS codes and capabilities
- **AI-Powered Analysis**: Get instant insights on contract requirements, competition, and win probability
- **Proposal Assistance**: Generate compelling proposals with AI-guided recommendations
- **Real-time Notifications**: Never miss an opportunity with customized alerts
- **Compliance Tracking**: Stay compliant with federal requirements and certifications
- **Performance Analytics**: Track your win rate and optimize your bidding strategy

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **State Management**: Zustand, TanStack Query
- **AI Integration**: Anthropic Claude API
- **Error Handling**: Custom error types, structured logging
- **Validation**: Zod schemas for runtime type safety
- **Deployment**: Vercel
- **Monitoring**: Structured logging ready for APM integration

## 📋 Prerequisites

- Node.js 18.17 or later
- npm or yarn package manager
- Supabase account
- Anthropic API key
- Google OAuth credentials (for authentication)

## 📁 Project Structure

```
medcontracthub/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes (public)
│   │   ├── login/           # Login page with server actions
│   │   ├── signup/          # Signup page
│   │   └── onboarding/      # Multi-step onboarding flow
│   ├── (dashboard)/         # Protected dashboard routes
│   ├── api/                 # API routes
│   └── page.tsx             # Landing page
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── auth/                # Authentication components
│   ├── dashboard/           # Dashboard components
│   └── landing/             # Landing page components
├── lib/                     # Utilities and helpers
│   ├── supabase/           # Supabase client setup
│   │   ├── client.ts       # Browser client with error handling
│   │   └── server.ts       # Server client with SSR & validation
│   ├── errors/             # Error handling system
│   │   ├── types.ts        # Custom error classes
│   │   ├── utils.ts        # Error utilities
│   │   └── logger.ts       # Structured logging
│   ├── api/                # API utilities
│   │   └── route-handler.ts # Unified route handler
│   ├── hooks/              # Custom React hooks
│   └── utils.ts            # Utility functions
├── types/                   # TypeScript type definitions
│   └── database.types.ts   # Supabase generated types
├── supabase/               # Database files
│   └── schema.sql          # Complete database schema
├── middleware.ts           # Next.js middleware for auth
└── public/                 # Static assets
```

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/wyattmac/medcontracthub.git
cd medcontracthub
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### 4. Set up the database

Run the database migrations:

```bash
npm run db:reset
```

Generate TypeScript types from your database:

```bash
npm run db:types
```

Seed the database with sample data:

```bash
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## ✅ Current Implementation Status

### 🎉 Day 1 Complete & Deployed (100% Done)

**All Day 1 deliverables completed and pushed to GitHub:**
- ✅ Next.js 14 setup with TypeScript and Tailwind CSS
- ✅ Supabase integration with SSR support (@supabase/ssr)
- ✅ Complete database schema with RLS policies
- ✅ Authentication flow (login, signup, onboarding)
- ✅ Protected routes with middleware
- ✅ Multi-step onboarding for company setup
- ✅ useAuth hook with user context and profile management
- ✅ High-converting landing page with all sections
- ✅ Dashboard layout with responsive sidebar navigation
- ✅ Robust console logging and error handling
- ✅ Git repository setup and Day 1 commit pushed to GitHub

**GitHub Repository:** https://github.com/wyattmac/medcontracthub  
**Day 1 Commit:** `c1cb5c2` - 31 files, 9,802 lines of code

### 🎉 Day 2 Complete - SAM.gov Integration (100% Done)

**Major SAM.gov Integration Implementation:**
- ✅ SAM.gov API client with TypeScript types and error handling
- ✅ React Query hooks for data fetching and caching
- ✅ Opportunity fetching and parsing utilities
- ✅ Complete opportunities list view with responsive design
- ✅ Advanced filtering (NAICS, state, deadline, status)
- ✅ Smart opportunity match scoring based on company capabilities
- ✅ Database integration with sync functionality
- ✅ API routes for search and sync operations
- ✅ React Query optimizations with SSR support

**Day 2 Technical Achievements:**
- **3,749 lines of code** added across 25 files
- **5 new UI components**: Badge, Input, Label, Select, Alert
- **Type-safe throughout** with comprehensive interfaces
- **Mobile-responsive** design with Tailwind CSS
- **Performance optimized** with React Query caching
- **SAM.gov API integration** ready for production use

**Day 2 Commit:** `7906210` - 25 files, 3,749 additions

### 🎉 Day 3 Complete - Opportunity Management & AI Integration (100% Done)

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
- **Complete AI integration** with Anthropic Claude SDK
- **Dynamic routes** with Next.js App Router ([id] pattern)
- **Advanced state management** with React Query mutations
- **Comprehensive error handling** at every layer
- **Production-ready cron jobs** with health checks and logging
- **Real-time sync capabilities** with manual and automated triggers
- **Rich UI components** including modals, calendars, and form controls

**Key Day 3 Components:**
- `app/(dashboard)/opportunities/[id]/page.tsx` - Dynamic opportunity details
- `components/dashboard/opportunities/opportunity-detail-container.tsx` - Comprehensive display
- `lib/ai/claude-client.ts` - AI analysis integration
- `app/api/ai/analyze/route.ts` - AI analysis API endpoint
- `components/dashboard/reminders/reminders-widget.tsx` - Deadline tracking
- `app/api/sync/route.ts` - Automated sync system
- `scripts/cron/sync-opportunities.sh` - Production cron job script

**Day 3 Commit:** `e79ca90` - 23 files, 4,200+ additions

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

**Day 4 Commit:** [Ready to commit] - 15 files, 5,000+ additions

### 📋 Upcoming (Days 5-7)
- Proposal generation with AI assistance
- Advanced filtering with saved search queries
- Team collaboration features
- Payment integration and subscription management
- Mobile app development
- API rate limiting and usage analytics

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm run db:reset` - Reset and migrate database
- `npm run db:types` - Generate TypeScript types from Supabase
- `npm run db:seed` - Seed database with sample data

### MCP Servers

This project uses Model Context Protocol (MCP) servers for enhanced development:

- **GitHub MCP**: Version control and collaboration
- **Filesystem MCP**: File operations and management
- **Context7 MCP**: Library documentation and best practices research

**Important**: Always research patterns using Context7 before implementing new features. See [CLAUDE.md](./CLAUDE.md) for detailed MCP usage guidelines.

### Code Style

- TypeScript strict mode enabled
- ESLint configuration for Next.js
- Prettier for code formatting
- Conventional commits for version control

## 🔐 Authentication Flow

The application uses Supabase Auth with a complete authentication flow:

1. **Sign Up**: Users create an account with email/password
2. **Onboarding**: Multi-step process to collect:
   - Personal information (name, phone, title)
   - Company details (name, NAICS codes)
   - Business certifications (SDVOSB, WOSB, etc.)
3. **Protected Routes**: Middleware ensures only authenticated users access dashboard
4. **Session Management**: Automatic session refresh and cookie-based auth

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e
```

## 📦 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables
4. Deploy

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🔐 Security

- All API routes are protected with authentication
- Row Level Security (RLS) enabled on all Supabase tables
- Environment variables for sensitive data
- HTTPS enforced in production
- Regular dependency updates

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CLAUDE.md](./CLAUDE.md) for detailed development guidelines and MCP server usage.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Anthropic](https://www.anthropic.com/) - AI capabilities
- [TanStack Query](https://tanstack.com/query) - Data fetching

## 📞 Support

For support, email support@medcontracthub.com or join our Slack community.

---

Built with ❤️ by the MedContractHub team
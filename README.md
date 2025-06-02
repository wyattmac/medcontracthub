# MedContractHub

AI-powered platform to help medical supply companies discover, analyze, and win federal contracts through SAM.gov integration.

## 🚀 Overview

MedContractHub is a comprehensive federal contracting platform designed specifically for medical supply companies. It streamlines the process of finding, analyzing, and bidding on government contracts by leveraging AI-powered insights and automated workflows.

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
- **Deployment**: Vercel
- **Monitoring**: Vercel Analytics

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
│   │   ├── client.ts       # Browser client
│   │   └── server.ts       # Server client with SSR
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
git clone https://github.com/locklearwyatt/medcontracthub.git
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

### Day 1 Complete (100% Done)

**All Day 1 deliverables have been completed:**
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

### 🚀 Ready for Day 2

**Day 2 Focus: SAM.gov Integration & Opportunity Management**
- 📋 SAM.gov API client implementation
- 📋 Opportunity fetching and parsing
- 📋 Opportunity list view with filters
- 📋 Opportunity detail pages
- 📋 Save/track functionality
- 📋 Matching algorithm

### Upcoming (Days 3-5)
- 📋 AI-powered opportunity analysis
- 📋 Proposal generation
- 📋 Email notifications
- 📋 Payment integration

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
#!/bin/bash

# Development Start Script (Non-Docker)
# Alternative to Docker development environment

set -e

echo "🚀 Starting MedContractHub Development Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local file not found${NC}"
    echo "Creating basic .env.local for development..."
    
    cat > .env.local << EOF
# Development Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://mock.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key
SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key
SAM_GOV_API_KEY=mock-sam-gov-key
ANTHROPIC_API_KEY=mock-anthropic-key
RESEND_API_KEY=mock-resend-key
STRIPE_SECRET_KEY=mock-stripe-key
STRIPE_WEBHOOK_SECRET=mock-webhook-secret
CSRF_SECRET=mock-csrf-secret-dev-only
SENTRY_DSN=mock-sentry-dsn

# Development flags
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_MOCK_MODE=true
EOF
    
    echo -e "${GREEN}✅ Created .env.local with mock values${NC}"
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo -e "${BLUE}📦 Node.js version: $NODE_VERSION${NC}"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Run type checking
echo -e "${BLUE}🔍 Running type check...${NC}"
if npm run type-check --silent; then
    echo -e "${GREEN}✅ Type check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Type check has warnings (continuing anyway)${NC}"
fi

# Start development server
echo -e "${BLUE}🔥 Starting development server...${NC}"
echo -e "${GREEN}📱 Application will be available at: http://localhost:3000${NC}"
echo -e "${GREEN}🔐 Use mock login with any email format${NC}"
echo ""
echo -e "${YELLOW}Development Features Enabled:${NC}"
echo "  • Mock authentication (no Supabase required)"
echo "  • Mock SAM.gov API data"
echo "  • Mock quota management system"
echo "  • Full dashboard functionality"
echo "  • Real-time development reload"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop the development server${NC}"
echo ""

# Start the development server
npm run dev
EOF
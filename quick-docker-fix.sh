#!/bin/bash

echo "🔧 Quick Docker Environment Fix"
echo "=============================="
echo ""

# Step 1: Check current status
echo "1️⃣ Current Docker status:"
docker ps -a | grep medcontract || echo "No medcontract containers found"
echo ""

# Step 2: Stop everything first
echo "2️⃣ Stopping all containers..."
docker-compose -f docker-compose.multi-env.yml down
echo ""

# Step 3: Create a working .env if it doesn't exist properly
echo "3️⃣ Setting up environment variables..."
if [ ! -f .env ] || [ $(wc -l < .env) -lt 10 ]; then
    echo "Creating new .env file with minimal config..."
    cat > .env << 'EOF'
# Minimal Working Configuration for Docker Development

# Development Database (Local PostgreSQL in Docker)
DATABASE_URL_DEV=postgresql://postgres:postgres@dev-db:5432/medcontracthub_dev

# Minimal Supabase Setup (for testing)
NEXT_PUBLIC_SUPABASE_URL_DEV=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder

# Required API Keys (placeholders for now)
SAM_GOV_API_KEY=placeholder
ANTHROPIC_API_KEY=placeholder
MISTRAL_API_KEY=placeholder
RESEND_API_KEY=placeholder
BRAVE_SEARCH_API_KEY=placeholder
BRAVE_API_KEY=placeholder

# Stripe Test Keys
STRIPE_SECRET_KEY_DEV=sk_test_placeholder
STRIPE_WEBHOOK_SECRET_DEV=whsec_placeholder

# Security
CSRF_SECRET_DEV=dev-csrf-secret-12345678

# Monitoring (optional)
SENTRY_DSN=

# Staging Environment (copy of dev for now)
DATABASE_URL_STAGING=postgresql://postgres:postgres@staging-db:5432/medcontracthub_staging
NEXT_PUBLIC_SUPABASE_URL_STAGING=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
SUPABASE_SERVICE_ROLE_KEY_STAGING=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
STRIPE_SECRET_KEY_STAGING=sk_test_placeholder
STRIPE_WEBHOOK_SECRET_STAGING=whsec_placeholder
CSRF_SECRET_STAGING=staging-csrf-secret-12345678

# Production Environment (placeholders)
DATABASE_URL=postgresql://placeholder
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
STRIPE_SECRET_KEY=sk_live_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
CSRF_SECRET=prod-csrf-secret-12345678
EOF
    echo "✅ Created new .env file"
else
    echo "✅ Using existing .env file"
fi
echo ""

# Step 4: Start fresh
echo "4️⃣ Starting fresh containers..."
docker-compose -f docker-compose.multi-env.yml up -d dev-app dev-redis dev-db
echo ""

# Step 5: Wait for containers to be ready
echo "5️⃣ Waiting for services to start..."
sleep 10
echo ""

# Step 6: Check status
echo "6️⃣ Final status check:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep medcontract
echo ""

# Step 7: Test endpoints
echo "7️⃣ Testing endpoints:"
echo -n "   Health check: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "Failed"
echo ""
echo -n "   Main page: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "Failed"
echo ""

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Check logs: docker logs -f medcontract-dev"
echo "2. Open browser: http://localhost:3000"
echo "3. If you have real API keys, update .env file"
#!/bin/bash

echo "🔧 Setting up Docker Environment Variables"
echo "========================================="
echo ""

# Check if .env.local exists (it might have your real keys)
if [ -f ".env.local" ]; then
    echo "📋 Found .env.local file. Extracting values..."
    
    # Function to get value from .env.local
    get_env_value() {
        grep "^$1=" .env.local | cut -d '=' -f2- || echo ""
    }
    
    # Create new .env file for Docker
    cat > .env << EOF
# Auto-generated from .env.local and .env.docker.dev
# Generated at: $(date)

# ===========================================
# DEVELOPMENT ENVIRONMENT
# ===========================================
DATABASE_URL_DEV=postgresql://postgres:postgres@dev-db:5432/medcontracthub_dev
NEXT_PUBLIC_SUPABASE_URL_DEV=$(get_env_value "NEXT_PUBLIC_SUPABASE_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=$(get_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY_DEV=$(get_env_value "SUPABASE_SERVICE_ROLE_KEY")

# External Services
SAM_GOV_API_KEY=$(get_env_value "SAM_GOV_API_KEY")
ANTHROPIC_API_KEY=$(get_env_value "ANTHROPIC_API_KEY")
MISTRAL_API_KEY=$(get_env_value "MISTRAL_API_KEY")
RESEND_API_KEY=$(get_env_value "RESEND_API_KEY")
BRAVE_SEARCH_API_KEY=$(get_env_value "BRAVE_SEARCH_API_KEY")
BRAVE_API_KEY=$(get_env_value "BRAVE_API_KEY")

# Stripe (Dev)
STRIPE_SECRET_KEY_DEV=$(get_env_value "STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET_DEV=$(get_env_value "STRIPE_WEBHOOK_SECRET")

# Security
CSRF_SECRET_DEV=$(get_env_value "CSRF_SECRET" || echo "dev-csrf-secret-$(openssl rand -hex 16)")

# Monitoring
SENTRY_DSN=$(get_env_value "SENTRY_DSN")

# ===========================================
# STAGING ENVIRONMENT (using dev values for now)
# ===========================================
DATABASE_URL_STAGING=postgresql://postgres:postgres@staging-db:5432/medcontracthub_staging
NEXT_PUBLIC_SUPABASE_URL_STAGING=$(get_env_value "NEXT_PUBLIC_SUPABASE_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING=$(get_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY_STAGING=$(get_env_value "SUPABASE_SERVICE_ROLE_KEY")
STRIPE_SECRET_KEY_STAGING=$(get_env_value "STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET_STAGING=$(get_env_value "STRIPE_WEBHOOK_SECRET")
CSRF_SECRET_STAGING=staging-csrf-secret-$(openssl rand -hex 16)

# ===========================================
# PRODUCTION ENVIRONMENT (using real values)
# ===========================================
DATABASE_URL=$(get_env_value "DATABASE_URL")
NEXT_PUBLIC_SUPABASE_URL=$(get_env_value "NEXT_PUBLIC_SUPABASE_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(get_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY=$(get_env_value "SUPABASE_SERVICE_ROLE_KEY")
STRIPE_SECRET_KEY=$(get_env_value "STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET=$(get_env_value "STRIPE_WEBHOOK_SECRET")
CSRF_SECRET=$(get_env_value "CSRF_SECRET" || echo "prod-csrf-secret-$(openssl rand -hex 16)")
EOF
    
    echo "✅ Created .env file from .env.local"
    echo ""
    echo "⚠️  Please check .env and update any missing values"
    
else
    echo "❌ No .env.local file found"
    echo ""
    echo "Options:"
    echo "1. Copy your existing .env.local file here"
    echo "2. Copy .env.docker.dev to .env and fill in your values:"
    echo "   cp .env.docker.dev .env"
    echo "3. Use minimal setup for testing (no external APIs):"
    
    # Create minimal .env for testing
    cat > .env.minimal << EOF
# Minimal Docker Environment Setup (for testing only)

# Development Database (Docker PostgreSQL)
DATABASE_URL_DEV=postgresql://postgres:postgres@dev-db:5432/medcontracthub_dev

# Minimal Supabase Setup (won't work for auth)
NEXT_PUBLIC_SUPABASE_URL_DEV=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=placeholder-anon-key
SUPABASE_SERVICE_ROLE_KEY_DEV=placeholder-service-key

# Placeholders for required variables
SAM_GOV_API_KEY=placeholder
ANTHROPIC_API_KEY=placeholder
MISTRAL_API_KEY=placeholder
RESEND_API_KEY=placeholder
STRIPE_SECRET_KEY_DEV=sk_test_placeholder
STRIPE_WEBHOOK_SECRET_DEV=whsec_placeholder
CSRF_SECRET_DEV=dev-csrf-secret-$(openssl rand -hex 16)

# Staging placeholders
DATABASE_URL_STAGING=postgresql://postgres:postgres@staging-db:5432/medcontracthub_staging
NEXT_PUBLIC_SUPABASE_URL_STAGING=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_STAGING=placeholder
SUPABASE_SERVICE_ROLE_KEY_STAGING=placeholder
STRIPE_SECRET_KEY_STAGING=sk_test_placeholder
STRIPE_WEBHOOK_SECRET_STAGING=whsec_placeholder
CSRF_SECRET_STAGING=staging-csrf-secret-$(openssl rand -hex 16)

# Production placeholders
DATABASE_URL=placeholder
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
SUPABASE_SERVICE_ROLE_KEY=placeholder
STRIPE_SECRET_KEY=sk_live_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
CSRF_SECRET=prod-csrf-secret-$(openssl rand -hex 16)
EOF
    
    echo "   Created .env.minimal for testing"
fi

echo ""
echo "🔄 Next steps:"
echo "1. Review and update .env file with your actual API keys"
echo "2. Restart Docker environment:"
echo "   ./docker-scripts.sh restart dev"
echo "3. Run tests again:"
echo "   ./test-docker-env.sh"
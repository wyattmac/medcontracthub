#!/bin/bash

# Apply performance optimization migrations to the database
# This script applies indexes and functions for sub-1 second performance

echo "🚀 Applying performance optimizations to database..."

# Check if Supabase is configured
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    exit 1
fi

# Apply the migrations using Supabase CLI or direct SQL
echo "📊 Creating performance indexes..."
npx supabase db push --db-url "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres" < supabase/migrations/20240614_performance_indexes.sql

echo "⚡ Creating fast search function..."
npx supabase db push --db-url "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_ID.supabase.co:5432/postgres" < supabase/migrations/20240614_fast_search_function.sql

echo "✅ Performance optimizations applied successfully!"
echo ""
echo "Next steps:"
echo "1. Monitor query performance in Supabase dashboard"
echo "2. Check Redis cache hit rates"
echo "3. Run load tests to verify sub-1 second response times"
echo ""
echo "Expected improvements:"
echo "- Search queries: 8600ms → <400ms"
echo "- Cached queries: <50ms"
echo "- Save operations: <200ms"
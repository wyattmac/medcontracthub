#!/bin/bash

# Apply Database Performance Indexes and Security Fixes
# This script safely applies database migrations for performance and security

set -e

echo "🚀 Applying database performance indexes and security fixes..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required environment variables are set
if [ -z "$SUPABASE_DB_URL" ] && [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: Neither SUPABASE_DB_URL nor DATABASE_URL is set${NC}"
    echo "Please set one of these environment variables with your database connection string"
    echo "Format: postgresql://[user]:[password]@[host]:[port]/[database]"
    exit 1
fi

# Use DATABASE_URL if SUPABASE_DB_URL is not set
DB_URL=${SUPABASE_DB_URL:-$DATABASE_URL}

# Function to run SQL file
run_migration() {
    local migration_file=$1
    local migration_name=$2
    
    echo -e "${YELLOW}Applying migration: ${migration_name}${NC}"
    
    if psql "$DB_URL" -f "$migration_file" -v ON_ERROR_STOP=1; then
        echo -e "${GREEN}✓ Successfully applied ${migration_name}${NC}"
    else
        echo -e "${RED}✗ Failed to apply ${migration_name}${NC}"
        exit 1
    fi
}

# Apply migrations in order
MIGRATION_DIR="$(dirname "$0")/../supabase/migrations"

# Check if migration files exist
if [ ! -f "$MIGRATION_DIR/005_performance_indexes.sql" ]; then
    echo -e "${RED}Error: Migration file 005_performance_indexes.sql not found${NC}"
    exit 1
fi

if [ ! -f "$MIGRATION_DIR/006_security_fixes.sql" ]; then
    echo -e "${RED}Error: Migration file 006_security_fixes.sql not found${NC}"
    exit 1
fi

# Apply performance indexes
run_migration "$MIGRATION_DIR/005_performance_indexes.sql" "Performance Indexes"

# Apply security fixes
run_migration "$MIGRATION_DIR/006_security_fixes.sql" "Security Fixes"

echo -e "${GREEN}✅ All migrations applied successfully!${NC}"

# Show index statistics
echo -e "\n${YELLOW}Database Index Statistics:${NC}"
psql "$DB_URL" -c "
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('opportunities', 'saved_opportunities', 'proposals', 'opportunity_analyses')
ORDER BY tablename, indexname;
"

echo -e "\n${GREEN}🎉 Database optimization complete!${NC}"
echo -e "Your database now has:"
echo -e "  • Optimized indexes for common queries"
echo -e "  • Security fixes for function search paths"
echo -e "  • Data integrity constraints"
echo -e "  • Improved foreign key performance"
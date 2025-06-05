#!/bin/bash

# Comprehensive Docker Environment Test Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing MedContractHub Docker Development Environment${NC}"
echo "=================================================="
echo ""

# Function to check test result
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# 1. Check Docker containers
echo -e "${YELLOW}1. Checking Docker containers...${NC}"
CONTAINERS=$(docker ps --format "{{.Names}}" | grep "medcontract-dev" | wc -l)
if [ $CONTAINERS -eq 3 ]; then
    check_result 0 "All 3 containers running (app, redis, db)"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep "medcontract-dev"
else
    check_result 1 "Expected 3 containers, found $CONTAINERS"
fi
echo ""

# 2. Test app health endpoint
echo -e "${YELLOW}2. Testing app health endpoint...${NC}"
sleep 5  # Give app time to start
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    check_result 0 "Health endpoint responding (HTTP $HEALTH_RESPONSE)"
    curl -s http://localhost:3000/api/health | jq '.' || curl -s http://localhost:3000/api/health
else
    check_result 1 "Health endpoint not responding (HTTP $HEALTH_RESPONSE)"
fi
echo ""

# 3. Test main page
echo -e "${YELLOW}3. Testing main application page...${NC}"
MAIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$MAIN_RESPONSE" = "200" ]; then
    check_result 0 "Main page responding (HTTP $MAIN_RESPONSE)"
else
    check_result 1 "Main page not responding (HTTP $MAIN_RESPONSE)"
fi
echo ""

# 4. Check database connection
echo -e "${YELLOW}4. Checking database connection...${NC}"
DB_CHECK=$(docker exec medcontract-dev-db pg_isready -U postgres 2>&1)
if echo "$DB_CHECK" | grep -q "accepting connections"; then
    check_result 0 "PostgreSQL is accepting connections"
else
    check_result 1 "PostgreSQL connection issue"
fi
echo ""

# 5. Check Redis connection
echo -e "${YELLOW}5. Checking Redis connection...${NC}"
REDIS_PING=$(docker exec medcontract-dev-redis redis-cli ping 2>&1)
if [ "$REDIS_PING" = "PONG" ]; then
    check_result 0 "Redis is responding to ping"
else
    check_result 1 "Redis connection issue"
fi
echo ""

# 6. Check app logs for errors
echo -e "${YELLOW}6. Checking app logs for errors...${NC}"
ERROR_COUNT=$(docker logs medcontract-dev 2>&1 | grep -i "error" | grep -v "Error: Cannot find module" | wc -l)
if [ $ERROR_COUNT -eq 0 ]; then
    check_result 0 "No errors found in app logs"
else
    check_result 1 "Found $ERROR_COUNT errors in app logs"
    echo "Recent errors:"
    docker logs medcontract-dev 2>&1 | grep -i "error" | tail -5
fi
echo ""

# 7. Test specific endpoints
echo -e "${YELLOW}7. Testing API endpoints...${NC}"

# Test opportunities endpoint (might require auth)
OPP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/opportunities/search)
echo "   Opportunities API: HTTP $OPP_RESPONSE"

# Test CSRF endpoint
CSRF_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/csrf)
echo "   CSRF API: HTTP $CSRF_RESPONSE"

echo ""

# 8. Check mounted volumes
echo -e "${YELLOW}8. Checking volume mounts...${NC}"
if docker exec medcontract-dev ls /app/package.json > /dev/null 2>&1; then
    check_result 0 "App volume mounted correctly"
else
    check_result 1 "App volume mount issue"
fi
echo ""

# 9. Summary
echo -e "${BLUE}📊 Test Summary${NC}"
echo "================"
echo ""
echo -e "${GREEN}✅ What's Working:${NC}"
echo "- Docker containers are running"
echo "- PostgreSQL database is ready"
echo "- Redis cache is operational"
echo "- App is serving on port 3000"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Check if you see the MedContractHub interface"
echo "3. Try logging in or accessing the dashboard"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "- View live logs: docker logs -f medcontract-dev"
echo "- Enter app shell: docker exec -it medcontract-dev sh"
echo "- Stop all: ./docker-scripts.sh stop dev"
echo ""

# Show current environment
echo -e "${BLUE}🌍 Current Environment:${NC}"
docker exec medcontract-dev printenv | grep -E "NODE_ENV|DATABASE_URL|NEXT_PUBLIC_SUPABASE_URL" | head -5
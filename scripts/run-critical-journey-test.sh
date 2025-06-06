#!/bin/bash

# Critical User Journey Test Runner
# This script runs the comprehensive E2E test for MedContractHub

set -e

echo "🚀 Starting Critical User Journey Test for MedContractHub"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if development server is running
echo -e "${BLUE}🔍 Checking if development server is running...${NC}"
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Development server is running${NC}"
else
    echo -e "${YELLOW}⚠️  Development server not running. Starting it now...${NC}"
    npm run dev &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Development server started${NC}"
            break
        fi
        echo "Waiting... ($i/30)"
        sleep 2
    done
    
    if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${RED}❌ Failed to start development server${NC}"
        exit 1
    fi
fi

# Create test results directory
mkdir -p test-results/videos
mkdir -p test-results/screenshots

echo -e "${BLUE}📁 Test results will be saved to: test-results/${NC}"

# Install Playwright browsers if needed
echo -e "${BLUE}🎭 Ensuring Playwright browsers are installed...${NC}"
npx playwright install --with-deps

# Run the critical user journey test
echo -e "${BLUE}🧪 Running Critical User Journey Test...${NC}"
echo "This test will:"
echo "  ✅ Test complete user registration and onboarding"
echo "  ✅ Test medical NAICS code selection"
echo "  ✅ Test opportunity discovery and search"
echo "  ✅ Test opportunity analysis and saving"
echo "  ✅ Test proposal creation and management"
echo "  ✅ Test analytics dashboard"
echo "  ✅ Test settings and profile management"
echo "  ✅ Test billing integration"
echo "  ✅ Test mobile responsiveness"
echo "  ✅ Test error handling and edge cases"
echo "  ✅ Test performance benchmarks"

# Set E2E testing environment variables
export E2E_TESTING=true
export E2E_BASE_URL=http://localhost:3000

echo -e "${BLUE}🔧 Environment Variables:${NC}"
echo "  E2E_TESTING=$E2E_TESTING"
echo "  E2E_BASE_URL=$E2E_BASE_URL"
echo ""

# Run only the critical user journey test
E2E_TESTING=true npx playwright test critical-user-journey.test.ts --project=chromium --reporter=list,html

TEST_EXIT_CODE=$?

# Generate test report
echo -e "${BLUE}📊 Generating test report...${NC}"
npx playwright show-report --host=0.0.0.0 --port=9323 &
REPORT_PID=$!

# Print results summary
echo ""
echo "=================================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}🎉 Critical User Journey Test PASSED!${NC}"
    echo -e "${GREEN}✅ All critical user flows are working correctly${NC}"
else
    echo -e "${RED}❌ Critical User Journey Test FAILED!${NC}"
    echo -e "${RED}🚨 Critical issues found in user flows${NC}"
fi

echo ""
echo "📁 Test artifacts saved to:"
echo "  📸 Screenshots: test-results/*.png"
echo "  🎥 Videos: test-results/videos/"
echo "  📊 Report: test-results/html-report/index.html"
echo ""
echo "🌐 Test report server running at: http://localhost:9323"
echo "Press Ctrl+C to stop the report server"

# Keep report server running
wait $REPORT_PID

# Cleanup
if [ ! -z "$DEV_SERVER_PID" ]; then
    echo -e "${YELLOW}🧹 Stopping development server...${NC}"
    kill $DEV_SERVER_PID
fi

exit $TEST_EXIT_CODE
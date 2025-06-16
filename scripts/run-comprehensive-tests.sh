#!/bin/bash

echo "🧪 MedContractHub Comprehensive Test Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if the app is running
echo "🔍 Checking if app is running on localhost:3000..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo -e "${GREEN}✅ App is running${NC}"
else
    echo -e "${RED}❌ App is not running!${NC}"
    echo "Please start the app first with: npm run dev"
    exit 1
fi

echo ""
echo "📋 Running comprehensive tests..."
echo ""

# Install Playwright browsers if needed
if [ ! -d "node_modules/@playwright/test/node_modules/.cache" ]; then
    echo "📦 Installing Playwright browsers..."
    npx playwright install chromium
fi

# Run the comprehensive test
echo "🚀 Starting Playwright tests..."
echo ""

# Run in headless mode by default, but allow headed mode with --headed flag
if [ "$1" == "--headed" ]; then
    npx playwright test tests/e2e/comprehensive-app-test.spec.ts --headed --reporter=list
else
    npx playwright test tests/e2e/comprehensive-app-test.spec.ts --reporter=list
fi

# Check test results
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "To debug failed tests:"
    echo "1. Run in headed mode: ./scripts/run-comprehensive-tests.sh --headed"
    echo "2. Check screenshots in: test-results/"
    echo "3. View detailed report: npx playwright show-report"
fi

echo ""
echo "📊 Test Summary:"
echo "- Health checks"
echo "- Page navigation" 
echo "- Opportunities display"
echo "- Save/unsave functionality"
echo "- Performance metrics"
echo "- Error handling"
echo "- Responsive design"
echo ""
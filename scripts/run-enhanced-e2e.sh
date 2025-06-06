#!/bin/bash

# Enhanced E2E Testing Script for MedContractHub
# Provides comprehensive Playwright testing with better error handling

set -e

echo "🚀 Starting Enhanced E2E Testing for MedContractHub"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${E2E_BASE_URL:-"http://localhost:3002"}
CONFIG_FILE="playwright.enhanced.config.ts"
TEST_TIMEOUT=${TEST_TIMEOUT:-"180"}
RETRIES=${RETRIES:-"1"}

# Function to print colored output
print_status() {
    echo -e "${BLUE}🔍 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if development server is running
print_status "Checking if development server is running..."
if curl -s -f "$BASE_URL/api/health" > /dev/null; then
    print_success "Development server is running at $BASE_URL"
else
    print_warning "Development server not running at $BASE_URL"
    print_status "Starting development server..."
    npm run dev &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s -f "$BASE_URL/api/health" > /dev/null; then
            print_success "Development server started successfully"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    if ! curl -s -f "$BASE_URL/api/health" > /dev/null; then
        print_error "Failed to start development server"
        exit 1
    fi
fi

# Clean up previous test results
print_status "Cleaning up previous test results..."
rm -rf test-results/enhanced-*
rm -rf playwright-report/
mkdir -p test-results

# Set environment variables
export E2E_BASE_URL="$BASE_URL"
export PLAYWRIGHT_TEST_BASE_URL="$BASE_URL"

# Check if enhanced config exists
if [ ! -f "$CONFIG_FILE" ]; then
    print_warning "Enhanced config not found, using default config"
    CONFIG_FILE="playwright.config.ts"
fi

print_status "Test Configuration:"
echo "📁 Config File: $CONFIG_FILE"
echo "🌐 Base URL: $BASE_URL"
echo "⏱️ Timeout: ${TEST_TIMEOUT}s"
echo "🔄 Retries: $RETRIES"
echo ""

# Run different test suites
run_test_suite() {
    local suite_name="$1"
    local test_pattern="$2"
    local project="$3"
    
    print_status "Running $suite_name tests..."
    
    local cmd="npx playwright test"
    [ -n "$test_pattern" ] && cmd="$cmd $test_pattern"
    [ -n "$project" ] && cmd="$cmd --project=$project"
    cmd="$cmd --config=$CONFIG_FILE"
    cmd="$cmd --timeout=${TEST_TIMEOUT}000"
    cmd="$cmd --retries=$RETRIES"
    
    echo "Command: $cmd"
    
    if $cmd; then
        print_success "$suite_name tests passed"
        return 0
    else
        print_error "$suite_name tests failed"
        return 1
    fi
}

# Test execution
FAILED_SUITES=()

# 1. Run enhanced critical journey tests
if ! run_test_suite "Enhanced Critical Journey" "__tests__/e2e/enhanced-critical-journey.test.ts" "chromium-desktop"; then
    FAILED_SUITES+=("Enhanced Critical Journey")
fi

# 2. Run original critical journey tests (if they exist)
if [ -f "__tests__/e2e/critical-user-journey.test.ts" ]; then
    if ! run_test_suite "Original Critical Journey" "__tests__/e2e/critical-user-journey.test.ts" "chromium-desktop"; then
        FAILED_SUITES+=("Original Critical Journey")
    fi
fi

# 3. Run performance tests
if ! run_test_suite "Performance Tests" "*performance*" "performance"; then
    FAILED_SUITES+=("Performance Tests")
fi

# 4. Run mobile tests
if ! run_test_suite "Mobile Tests" "__tests__/e2e/enhanced-critical-journey.test.ts" "mobile-chrome"; then
    FAILED_SUITES+=("Mobile Tests")
fi

# Generate comprehensive report
print_status "Generating test report..."

if [ -f "test-results/e2e-results.json" ]; then
    # Extract key metrics from results
    TOTAL_TESTS=$(cat test-results/e2e-results.json | jq '.stats.total // 0')
    PASSED_TESTS=$(cat test-results/e2e-results.json | jq '.stats.passed // 0')
    FAILED_TESTS=$(cat test-results/e2e-results.json | jq '.stats.failed // 0')
    
    echo ""
    echo "📊 Test Results Summary:"
    echo "========================"
    echo "📝 Total Tests: $TOTAL_TESTS"
    echo "✅ Passed: $PASSED_TESTS"
    echo "❌ Failed: $FAILED_TESTS"
    echo ""
fi

# List generated artifacts
print_status "Generated artifacts:"
echo "📸 Screenshots: $(find test-results -name "*.png" | wc -l) files"
echo "🎥 Videos: $(find test-results -name "*.webm" | wc -l) files"
echo "📊 Reports: $(find playwright-report -name "*.html" | wc -l) files"

# Open report if successful
if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    print_success "All test suites passed! 🎉"
    
    if [ -f "playwright-report/index.html" ]; then
        print_status "Opening test report..."
        if command -v xdg-open > /dev/null; then
            xdg-open playwright-report/index.html 2>/dev/null &
        elif command -v open > /dev/null; then
            open playwright-report/index.html 2>/dev/null &
        fi
    fi
    
    exit 0
else
    print_error "Some test suites failed:"
    for suite in "${FAILED_SUITES[@]}"; do
        echo "  - $suite"
    done
    
    print_status "Check the following for debugging:"
    echo "📄 Test report: playwright-report/index.html"
    echo "📸 Screenshots: test-results/enhanced-*.png"
    echo "🎥 Videos: test-results/videos/"
    echo "📊 JSON results: test-results/e2e-results.json"
    
    exit 1
fi

# Cleanup function
cleanup() {
    if [ -n "$DEV_SERVER_PID" ]; then
        print_status "Stopping development server..."
        kill $DEV_SERVER_PID 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT
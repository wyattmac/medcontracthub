#!/bin/bash

# MedContractHub Playwright Test Runner - Visible Browser Mode
# This script runs the comprehensive Playwright tests with a visible browser

echo "🎭 MedContractHub Playwright Test Runner"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if app is running
check_app() {
    echo -e "${BLUE}Checking if app is running...${NC}"
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ App is running at http://localhost:3000${NC}"
        return 0
    else
        echo -e "${RED}❌ App is not running!${NC}"
        echo -e "${YELLOW}Please start the app first with: docker-compose up -d${NC}"
        return 1
    fi
}

# Create test results directory
setup_directories() {
    echo -e "${BLUE}Setting up test directories...${NC}"
    mkdir -p test-results/videos
    mkdir -p test-results/trace
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Display menu
show_menu() {
    echo ""
    echo "Choose test mode:"
    echo "================"
    echo "1) 🚀 Fast Mode - Run all tests quickly (headless)"
    echo "2) 👀 Visible Mode - See browser actions (headed)"
    echo "3) 🐌 Demo Mode - Slow motion for presentations"
    echo "4) 🔍 Debug Mode - Step through with inspector"
    echo "5) 📱 Mobile Mode - Test mobile responsiveness"
    echo "6) 🎯 Specific Test - Run a single test"
    echo "7) 🎬 Record Mode - Create video of test run"
    echo ""
}

# Run tests based on selection
run_tests() {
    local mode=$1
    
    # Set environment variables
    export DEVELOPMENT_AUTH_BYPASS=true
    export E2E_BASE_URL=http://localhost:3000
    
    case $mode in
        1)
            echo -e "${BLUE}Running tests in fast mode (headless)...${NC}"
            npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                --project=chromium \
                --reporter=list \
                --reporter=html
            ;;
        2)
            echo -e "${BLUE}Running tests in visible mode...${NC}"
            echo -e "${YELLOW}You will see the browser window!${NC}"
            npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                --project=chromium \
                --headed \
                --reporter=list \
                --workers=1
            ;;
        3)
            echo -e "${BLUE}Running demo mode with slow actions...${NC}"
            echo -e "${YELLOW}Perfect for presentations!${NC}"
            npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                -g "Demo Mode" \
                --project=chromium \
                --headed \
                --reporter=list \
                --workers=1 \
                --timeout=120000
            ;;
        4)
            echo -e "${BLUE}Running in debug mode...${NC}"
            echo -e "${YELLOW}Playwright Inspector will open${NC}"
            echo -e "${YELLOW}Use the step buttons to control test execution${NC}"
            PWDEBUG=1 npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                --project=chromium \
                --headed \
                --workers=1 \
                --timeout=0
            ;;
        5)
            echo -e "${BLUE}Running mobile responsiveness tests...${NC}"
            npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                -g "Mobile" \
                --project=chromium \
                --headed \
                --reporter=list
            ;;
        6)
            echo ""
            echo "Available tests:"
            echo "1) Complete User Journey"
            echo "2) Mobile Responsiveness"
            echo "3) Performance Metrics"
            echo "4) Error Handling"
            echo "5) Accessibility Compliance"
            echo ""
            read -p "Select test number: " test_num
            
            case $test_num in
                1) test_name="Complete User Journey" ;;
                2) test_name="Mobile Responsiveness" ;;
                3) test_name="Performance Metrics" ;;
                4) test_name="Error Handling" ;;
                5) test_name="Accessibility Compliance" ;;
                *) echo -e "${RED}Invalid selection${NC}"; return 1 ;;
            esac
            
            echo -e "${BLUE}Running test: $test_name${NC}"
            npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                -g "$test_name" \
                --project=chromium \
                --headed \
                --reporter=list
            ;;
        7)
            echo -e "${BLUE}Running tests with video recording...${NC}"
            npx playwright test __tests__/e2e/medcontracthub-complete.test.ts \
                --project=chromium \
                --reporter=list \
                --video=on \
                --trace=on
            echo -e "${GREEN}Videos saved in: test-results/videos/${NC}"
            ;;
        *)
            echo -e "${RED}Invalid selection${NC}"
            return 1
            ;;
    esac
}

# Show test results
show_results() {
    echo ""
    echo -e "${BLUE}Test Results:${NC}"
    echo "============="
    
    # Count screenshots
    if [ -d "test-results" ]; then
        screenshot_count=$(find test-results -name "*.png" 2>/dev/null | wc -l)
        if [ $screenshot_count -gt 0 ]; then
            echo -e "${GREEN}📸 Screenshots captured: $screenshot_count${NC}"
            echo "Recent screenshots:"
            find test-results -name "*.png" -type f -printf "  - %f\n" 2>/dev/null | head -5
        fi
        
        # Count videos
        video_count=$(find test-results -name "*.webm" -o -name "*.mp4" 2>/dev/null | wc -l)
        if [ $video_count -gt 0 ]; then
            echo -e "${GREEN}🎬 Videos recorded: $video_count${NC}"
        fi
    fi
    
    # Show HTML report location
    if [ -f "playwright-report/index.html" ]; then
        echo ""
        echo -e "${GREEN}📊 HTML Report available at: playwright-report/index.html${NC}"
        echo -e "${YELLOW}Run 'npx playwright show-report' to view${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🎭 MedContractHub Playwright Test Suite${NC}"
    echo ""
    
    # Check if app is running
    if ! check_app; then
        exit 1
    fi
    
    # Setup directories
    setup_directories
    
    # Show menu and get selection
    show_menu
    read -p "Select mode (1-7): " mode
    
    # Run tests
    if run_tests $mode; then
        echo -e "${GREEN}✅ Tests completed successfully!${NC}"
    else
        echo -e "${RED}❌ Tests failed or were interrupted${NC}"
    fi
    
    # Show results
    show_results
}

# Handle script arguments for CI/CD
if [ "$1" == "--headless" ]; then
    check_app && setup_directories && run_tests 1
elif [ "$1" == "--headed" ]; then
    check_app && setup_directories && run_tests 2
elif [ "$1" == "--debug" ]; then
    check_app && setup_directories && run_tests 4
else
    # Interactive mode
    main
fi
#!/bin/bash

# Run comprehensive app test with Playwright in headed mode (visible browser)
echo "🎭 Running MedContractHub App Test with Playwright (Headed Mode)"
echo "================================================================"

# Set environment variables
export DEVELOPMENT_AUTH_BYPASS=true
export E2E_BASE_URL=http://localhost:3000

# Create test results directory
mkdir -p test-results

# Check if app is running
echo "Checking if app is running..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ App is not running at http://localhost:3000"
    echo "Please start the app with: docker-compose up -d"
    exit 1
fi

echo "✅ App is running"

# Run the test in headed mode
echo ""
echo "🖥️  Running Playwright test with visible browser..."
echo "You will see the browser window open and navigate through the app!"
echo ""

# Run with headed mode and slower speed so you can see what's happening
npx playwright test __tests__/e2e/app-comprehensive.test.ts \
    --project=chromium \
    --headed \
    --reporter=list \
    --workers=1 \
    --timeout=60000

# Check if screenshots were created
echo ""
echo "📸 Screenshots saved:"
ls -la test-results/app-*.png 2>/dev/null || echo "No screenshots found"

echo ""
echo "✅ Test complete!"
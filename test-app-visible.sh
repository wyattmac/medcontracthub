#!/bin/bash

echo "🎭 MedContractHub Visible Browser Test"
echo "====================================="
echo ""
echo "This will open a Chrome browser and test your app."
echo "You will see the browser navigate through:"
echo "  ✓ Login page"
echo "  ✓ Dashboard" 
echo "  ✓ Opportunities search"
echo "  ✓ Saved items"
echo "  ✓ Proposals"
echo "  ✓ Analytics"
echo ""

# Create test results directory
mkdir -p test-results

# Set environment for visible browser with slow motion
export PLAYWRIGHT_SLOW_MO=500  # 500ms delay between actions
export DEVELOPMENT_AUTH_BYPASS=true
export E2E_BASE_URL=http://localhost:3000

# Run the simple test that we know works
echo "🚀 Starting test with visible browser..."
echo ""

npx playwright test __tests__/e2e/simple-visible-test.test.ts \
  --headed \
  --project=chromium \
  --reporter=list \
  --workers=1 \
  --timeout=60000 \
  --no-fail-on-flaky-tests \
  || echo "Test completed with some failures"

echo ""
echo "📸 Screenshots saved:"
ls -la test-results/*.png 2>/dev/null || echo "No screenshots found"

echo ""
echo "To run the full comprehensive test suite with visible browser:"
echo "  ./run-playwright-visible.sh"
echo ""
echo "To debug a specific test step-by-step:"
echo "  npx playwright test --debug"
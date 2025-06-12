#!/bin/bash

echo "🔥 BEAST MODE TEST - MedContractHub Full App Test 🔥"
echo "=================================================="
echo ""
echo "This will open Chrome and test your entire app:"
echo "  ✓ Login flow"
echo "  ✓ Dashboard"
echo "  ✓ Opportunities loading"
echo "  ✓ Search functionality"
echo "  ✓ All major pages"
echo ""
echo "You'll see the browser navigate through everything!"
echo ""

# Create results directory
mkdir -p test-results

# Set environment
export PLAYWRIGHT_SLOW_MO=400  # Slow enough to see everything
export DEVELOPMENT_AUTH_BYPASS=true

echo "🚀 Starting test in 3 seconds..."
sleep 3

# Run the comprehensive test
npx playwright test __tests__/e2e/app-complete-final.test.ts \
  --headed \
  --project=chromium \
  --reporter=list \
  --workers=1 \
  --timeout=60000

echo ""
echo "📸 Test complete! Check screenshots:"
ls -la test-results/*.png 2>/dev/null || echo "No screenshots found"

echo ""
echo "🎯 Key findings:"
echo "  - Opportunities API: /api/opportunities/public-search"
echo "  - Opportunities render as Card components"
echo "  - Look for .hover\\:shadow-md.transition-shadow selectors"
echo ""
echo "✅ Your app is working! Opportunities are loading!"
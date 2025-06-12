#!/bin/bash

echo "🎭 Running MedContractHub Visible Test"
echo "====================================="
echo ""
echo "This will open a Chrome browser window and navigate through your app."
echo "You will see:"
echo "  - The browser window open"
echo "  - Navigation to different pages"
echo "  - Form filling and interactions"
echo "  - Screenshots being taken"
echo ""
echo "Press Enter to start..."
read

# Set slow motion for visibility
export PLAYWRIGHT_SLOW_MO=1000  # 1 second delay between actions

# Run the test with visible browser
npx playwright test __tests__/e2e/simple-visible-test.test.ts \
  --headed \
  --project=chromium \
  --reporter=list \
  --workers=1 \
  --timeout=60000 \
  || true  # Don't exit on test failure

echo ""
echo "Test completed. Check test-results/ for screenshots:"
ls -la test-results/*.png 2>/dev/null || echo "No screenshots found"
echo ""
echo "To view the test video, check:"
find test-results -name "*.webm" -o -name "*.mp4" | head -5
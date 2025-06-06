# Critical User Journey Tests

This directory contains comprehensive end-to-end tests for MedContractHub's critical user flows.

## 🎯 Test Coverage

The **Critical User Journey Test** (`critical-user-journey.test.ts`) is a comprehensive E2E test that covers:

### Core User Flows
1. **User Registration & Authentication**
   - Landing page navigation
   - Sign-up form validation
   - Email confirmation flow

2. **Medical NAICS Onboarding**
   - Company profile setup
   - Medical industry NAICS code selection
   - Personalized matching configuration

3. **Opportunity Discovery**
   - Search functionality with medical keywords
   - Advanced filtering options
   - Personalized opportunity matching
   - NAICS-based recommendations

4. **Opportunity Management**
   - Detailed opportunity viewing
   - Saving opportunities for later
   - AI-powered analysis (when enabled)
   - Match score calculations

5. **Proposal Management**
   - Creating new proposals
   - Linking proposals to opportunities
   - Form validation and data persistence

6. **Analytics & Insights**
   - Performance metrics dashboard
   - Usage tracking verification
   - Data visualization components

7. **Settings & Profile Management**
   - Profile updates
   - NAICS code modifications
   - Company information management

8. **Billing & Subscription**
   - Subscription status verification
   - Usage monitoring
   - Billing dashboard access

### Quality Assurance
- **Performance Benchmarks**
  - Page load time measurements
  - Search response time testing
  - Mobile responsiveness verification

- **Error Handling & Edge Cases**
  - Invalid input handling
  - Network failure scenarios
  - XSS and injection attack prevention
  - Graceful degradation testing

- **Cross-Browser Compatibility**
  - Chrome, Firefox, Safari testing
  - Mobile device simulation

## 🚀 Running the Tests

### Quick Start
```bash
# Run the complete critical journey test
npm run test:critical

# Run in CI mode (JSON + HTML reports)
npm run test:critical:ci

# Run with Playwright UI for debugging
npm run test:e2e:ui
```

### Manual Execution
```bash
# Install dependencies
npx playwright install --with-deps

# Start development server (if not running)
npm run dev

# Run the test
npx playwright test critical-user-journey.test.ts --project=chromium
```

### Debug Mode
```bash
# Run in debug mode with browser visible
npx playwright test critical-user-journey.test.ts --debug --project=chromium
```

## 📊 Test Reports

After running tests, reports are generated in:
- **HTML Report**: `test-results/html-report/index.html`
- **JSON Report**: `test-results/e2e-results.json`
- **Screenshots**: `test-results/*.png`
- **Videos**: `test-results/videos/`

### Viewing Reports
```bash
# Open HTML report
npx playwright show-report

# Or serve on custom port
npx playwright show-report --host=0.0.0.0 --port=9323
```

## 🔧 Configuration

### Environment Variables
- `E2E_BASE_URL`: Application base URL (default: http://localhost:3000)
- `CI`: Set to true for CI environment adjustments

### Test Data
The test creates a unique test user for each run:
```typescript
const testUser = {
  email: `test-${Date.now()}@medcontracthub.test`,
  companyName: 'Advanced Medical Devices Inc',
  naicsCodes: ['339112', '423450', '541714'],
  description: 'Medical device manufacturer...'
}
```

## 🧪 Test Philosophy

This test is designed to be **HARD** - it will expose real issues:

### What Makes It Hard
1. **Complete User Journey**: Tests the entire user flow from registration to advanced features
2. **Real Data Interaction**: Uses actual API endpoints and database operations
3. **Performance Benchmarks**: Includes strict performance requirements
4. **Edge Case Testing**: Attempts to break the application with invalid inputs
5. **Cross-Browser Testing**: Ensures compatibility across different environments
6. **Mobile Responsiveness**: Verifies the application works on mobile devices
7. **Error Boundary Testing**: Validates error handling and recovery

### Success Criteria
- All user flows complete without errors
- Page load times under performance thresholds
- Proper error handling for edge cases
- Mobile interface fully functional
- Data persistence across sessions

## 🐛 Troubleshooting

### Common Issues

**Test Timeouts**
```bash
# Increase timeout in playwright.config.ts
timeout: 60 * 1000, // 60 seconds
```

**Development Server Not Running**
```bash
# The test script will auto-start the dev server
# Or manually start it:
npm run dev
```

**Browser Installation Issues**
```bash
# Reinstall Playwright browsers
npx playwright install --with-deps --force
```

**Network Issues**
```bash
# Check if localhost:3000 is accessible
curl http://localhost:3000/api/health
```

### Debug Tips
1. Use `--debug` flag to run in headed mode
2. Add `await page.pause()` in test code for breakpoints
3. Check screenshots in `test-results/` directory
4. Review network logs in HAR files
5. Enable verbose logging with `DEBUG=pw:api`

## 📈 Performance Expectations

The test includes performance benchmarks:
- Landing page load: < 5 seconds
- Opportunities page load: < 8 seconds
- Search response time: < 3 seconds

## 🔄 Continuous Integration

For CI environments:
```yaml
# Example GitHub Actions
- name: Run Critical User Journey Tests
  run: npm run test:critical:ci
  
- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results/
```

## 📝 Test Maintenance

### Adding New Test Cases
1. Add new test steps to the main journey test
2. Update performance benchmarks as needed
3. Add new edge cases to the data integrity test
4. Update this README with new coverage

### Updating Test Data
- Modify the `testUser` object for different scenarios
- Add new NAICS codes for expanded industry testing
- Update company profiles for various business types

---

This test suite ensures MedContractHub delivers a reliable, performant, and secure experience for medical industry professionals seeking federal contracting opportunities.
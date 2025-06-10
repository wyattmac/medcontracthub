# MedContractHub Test Results

This directory contains test screenshots and results from the automated test suite.

## Test Migration Notice

**Important**: The test suite has been migrated from Puppeteer to Playwright for better integration, performance, and reliability.

## New Test Structure

All tests are now located in the `__tests__` directory at the project root:

```
__tests__/
├── e2e/                    # End-to-end tests (Playwright)
│   ├── auth/              # Authentication flows
│   │   └── authentication-flow.test.ts
│   ├── compliance/        # Compliance matrix tests
│   │   └── compliance-matrix-flow.test.ts
│   ├── dashboard/         # Dashboard navigation
│   │   └── dashboard-navigation.test.ts
│   ├── opportunities/     # Opportunity search and filtering
│   │   └── opportunities-search.test.ts
│   ├── proposals/         # Proposal workflow
│   │   └── proposals-workflow.test.ts
│   └── saved/             # Saved opportunities
│       └── saved-opportunities-flow.test.ts
├── components/            # Component unit tests
├── api/                   # API route tests
└── lib/                   # Library unit tests
```

## Running Tests

### Run all E2E tests:
```bash
npm run test:e2e
```

### Run specific test suites:
```bash
# Run compliance matrix tests
npm run test:e2e:compliance

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug
```

### Run in Docker:
```bash
docker-compose -f docker-compose.yml -f docker-compose.test.yml up test
```

## Test Coverage

### ✅ Completed Test Suites:

1. **Authentication & User Management**
   - Login/logout flows
   - Signup process
   - Protected route handling
   - Session persistence
   - Mobile responsive auth

2. **Dashboard Navigation**
   - Dashboard overview
   - Navigation between sections
   - Stats display
   - Quick actions
   - Mobile navigation

3. **Opportunities Search & Filter**
   - Opportunities listing
   - Search functionality
   - Filter options
   - Pagination
   - Detail view navigation
   - Mobile layout

4. **Saved Opportunities**
   - Save/unsave functionality
   - Notes management
   - Export capabilities
   - AI analysis integration
   - Mobile experience

5. **Proposals Workflow**
   - Create new proposal
   - Edit existing proposals
   - Document generation
   - Status tracking
   - Template usage
   - Mobile form handling

6. **Compliance Matrix**
   - Extract from RFP
   - Manual matrix creation
   - Requirements tracking
   - Response status updates
   - Export functionality
   - Mobile compliance view

## Test Results

Test results are saved to:
- **Screenshots**: `test-results/*.png`
- **Reports**: `test-results/e2e-results.json`
- **HTML Report**: `test-results/index.html`

## Configuration

Tests are configured in:
- `playwright.config.ts` - Main Playwright configuration
- `__tests__/e2e/global-setup.ts` - Global test setup

## Best Practices

1. **Page Object Model**: Consider implementing page objects for common interactions
2. **Test Data**: Use consistent test data fixtures
3. **Selectors**: Prefer data-testid attributes for stability
4. **Mobile Testing**: All major flows include mobile viewport tests
5. **Screenshots**: Capture key states for visual regression tracking

## Debugging

To debug failing tests:
1. Run with `--debug` flag: `npx playwright test --debug`
2. Use `--ui` mode for interactive debugging
3. Check screenshots in `test-results/` directory
4. Review trace files for detailed execution logs

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pre-merge checks
- Nightly builds

See `.github/workflows/` for CI configuration.
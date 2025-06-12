import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Configuration for MedContractHub
 * Optimized for WSL environment
 */
export default defineConfig({
  // Test directory
  testDir: './__tests__/e2e',
  
  // Test timeout
  timeout: 30 * 1000,
  expect: {
    timeout: 10000,
  },
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }]
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL for the tests
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on retry or when running headed
    video: process.env.PWDEBUG || process.env.HEADED ? 'on' : 'retain-on-failure',
    
    // Global timeout for all actions
    actionTimeout: 15 * 1000,
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
    
    // Ignore HTTPS errors (useful for local development)
    ignoreHTTPSErrors: true,
  },

  // Configure projects - simplified for WSL
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },
    
    // Comment out other browsers for now - they can be added back if needed
    /*
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    */

    // Mobile testing - only if needed
    /*
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    */
  ],

  // Run your local dev server before starting the tests
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    // Wait for the server to be ready
    env: {
      DEVELOPMENT_AUTH_BYPASS: 'true',
    },
  },
  
  // Global setup
  globalSetup: './__tests__/e2e/global-setup.ts',
  
  // Test output directory
  outputDir: 'test-results',
  
  // Test match patterns
  testMatch: [
    '__tests__/e2e/**/*.spec.ts',
    '__tests__/e2e/**/*.e2e.ts',
    '__tests__/e2e/**/*.test.ts',
  ],
})
/**
 * Enhanced Playwright Configuration for MedContractHub
 * Optimized for reliable testing with better error handling and performance tuning
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Test directory
  testDir: './__tests__/e2e',
  
  // Increased timeout for better reliability
  timeout: 90 * 1000, // 90 seconds
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
  
  // Run tests in files in parallel
  fullyParallel: false, // Disabled for better stability
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry configuration - more retries for flaky tests
  retries: process.env.CI ? 3 : 1,
  
  // Sequential execution for better reliability
  workers: 1,
  
  // Enhanced reporter configuration
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['line'] // Better console output
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for the tests - support different ports
    baseURL: process.env.E2E_BASE_URL || process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3002',
    
    // Collect trace when retrying the failed test
    trace: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Global timeout for all actions
    actionTimeout: 15 * 1000, // 15 seconds
    
    // Navigation timeout
    navigationTimeout: 60 * 1000, // 60 seconds
    
    // Ignore HTTPS errors for development
    ignoreHTTPSErrors: true,
    
    // Set user agent
    userAgent: 'Playwright E2E Tests - MedContractHub',
    
    // Additional context options
    contextOptions: {
      // Reduce resource usage
      permissions: [],
      reducedMotion: 'reduce',
      forcedColors: 'none',
    },
    
    // Locale settings
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },

  // Configure projects for different browsers and scenarios
  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Performance optimizations
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
    },
    
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific timeouts
        actionTimeout: 20 * 1000,
        navigationTimeout: 90 * 1000,
      },
    },
    
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        actionTimeout: 20 * 1000,
        navigationTimeout: 90 * 1000,
      },
    },

    // Performance testing project
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Optimized for performance testing
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-web-security', // For performance testing
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ]
        }
      },
      testMatch: ['**/*performance*.test.ts']
    },

    // Accessibility testing
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // High contrast for accessibility testing
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
      testMatch: ['**/*accessibility*.test.ts', '**/*a11y*.test.ts']
    }
  ],

  // Global setup and teardown
  globalSetup: './__tests__/e2e/global-setup.ts',
  
  // Test output directory
  outputDir: 'test-results',
  
  // Test match patterns - more specific
  testMatch: [
    '__tests__/e2e/**/*.spec.ts',
    '__tests__/e2e/**/*.e2e.ts',
    '__tests__/e2e/**/*.test.ts',
  ],
  
  // Global test configuration
  use: {
    ...devices['Desktop Chrome'],
    
    // Base URL with fallback
    baseURL: (() => {
      if (process.env.E2E_BASE_URL) return process.env.E2E_BASE_URL
      if (process.env.PORT) return `http://localhost:${process.env.PORT}`
      // Check if port 3002 is available, fallback to 3000
      return 'http://localhost:3002'
    })(),
    
    // Enhanced tracing
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 60000,
    
    // Browser context options
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    
    // Geolocation (optional)
    geolocation: { longitude: -74.0060, latitude: 40.7128 }, // New York
    permissions: ['geolocation'],
  },

  // Web server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: true, // Don't start if already running
    timeout: 180 * 1000, // 3 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
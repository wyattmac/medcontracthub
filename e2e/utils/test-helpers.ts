/**
 * E2E Test Helper Functions
 * Common utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test'

/**
 * Test user credentials for E2E tests
 */
export const TEST_USERS = {
  admin: {
    email: 'test@medcontracthub.com',
    password: 'TestPassword123!',
    company: 'Test Medical Supplies Inc.'
  },
  user: {
    email: 'user@example.com',
    password: 'UserPassword123!',
    company: 'Sample Healthcare Corp.'
  }
}

/**
 * Login helper function
 */
export async function login(page: Page, user: 'admin' | 'user' = 'admin') {
  const credentials = TEST_USERS[user]
  
  // Navigate to login page
  await page.goto('/login')
  
  // Fill login form
  await page.fill('[name="email"]', credentials.email)
  await page.fill('[name="password"]', credentials.password)
  
  // Submit form
  await page.click('button[type="submit"]')
  
  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 })
  
  // Verify we're logged in
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 })
}

/**
 * Logout helper function
 */
export async function logout(page: Page) {
  // Look for user menu or logout button
  const logoutSelector = '[data-testid="logout-button"], [aria-label="Sign out"], text="Sign out"'
  
  try {
    await page.click(logoutSelector, { timeout: 5000 })
    await page.waitForURL('/login', { timeout: 5000 })
  } catch (error) {
    // If logout button not found, try navigating directly
    await page.goto('/login')
  }
}

/**
 * Wait for page to load completely
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle')
  
  // Wait for any loading spinners to disappear
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[data-testid="loading"], .animate-spin, .loading')
    return spinners.length === 0
  }, { timeout: 10000 })
}

/**
 * Search for opportunities
 */
export async function searchOpportunities(page: Page, query: string) {
  // Navigate to opportunities page
  await page.goto('/opportunities')
  await waitForPageLoad(page)
  
  // Find and use search input
  const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]')
  await searchInput.fill(query)
  await searchInput.press('Enter')
  
  // Wait for search results
  await waitForPageLoad(page)
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  })
}

/**
 * Check for JavaScript errors on the page
 */
export async function checkForConsoleErrors(page: Page) {
  const errors: string[] = []
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  
  return errors
}

/**
 * Mock API responses for testing
 */
export async function mockApiResponse(page: Page, endpoint: string, response: any) {
  await page.route(`**/api/${endpoint}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  })
}

/**
 * Fill out opportunity filters
 */
export async function setOpportunityFilters(page: Page, filters: {
  naics?: string
  state?: string
  deadline?: string
}) {
  if (filters.naics) {
    await page.selectOption('[name="naics"]', filters.naics)
  }
  
  if (filters.state) {
    await page.selectOption('[name="state"]', filters.state)
  }
  
  if (filters.deadline) {
    await page.fill('[name="deadline"]', filters.deadline)
  }
  
  // Apply filters
  await page.click('button:has-text("Apply Filters")')
  await waitForPageLoad(page)
}

/**
 * Verify sanitization is working
 */
export async function testInputSanitization(page: Page, inputSelector: string) {
  const maliciousInput = '<script>alert("xss")</script>Test Content'
  
  // Fill input with malicious content
  await page.fill(inputSelector, maliciousInput)
  
  // Get the actual value
  const value = await page.inputValue(inputSelector)
  
  // Verify script tags are removed
  expect(value).not.toContain('<script>')
  expect(value).toContain('Test Content')
  
  return value
}

/**
 * Check accessibility on page
 */
export async function checkAccessibility(page: Page) {
  // Basic accessibility checks
  const issues: string[] = []
  
  // Check for alt text on images
  const imagesWithoutAlt = await page.locator('img:not([alt])').count()
  if (imagesWithoutAlt > 0) {
    issues.push(`${imagesWithoutAlt} images missing alt text`)
  }
  
  // Check for proper heading structure
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
  if (headings.length === 0) {
    issues.push('No headings found on page')
  }
  
  // Check for form labels
  const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby])').count()
  if (inputsWithoutLabels > 0) {
    issues.push(`${inputsWithoutLabels} inputs missing labels`)
  }
  
  return issues
}

/**
 * Performance monitoring
 */
export async function measurePagePerformance(page: Page, url: string) {
  const startTime = Date.now()
  
  await page.goto(url)
  await waitForPageLoad(page)
  
  const endTime = Date.now()
  const loadTime = endTime - startTime
  
  // Get Core Web Vitals if available
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return {
      loadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
    }
  })
  
  return {
    totalLoadTime: loadTime,
    ...metrics
  }
}
/**
 * E2E Tests for Authentication Flow
 * Critical user journey: Login and authentication
 */

import { test, expect } from '@playwright/test'
import { login, logout, waitForPageLoad, checkForConsoleErrors, testInputSanitization } from '../utils/test-helpers'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/')
  })

  test('should display landing page correctly', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/MedContractHub/)
    
    // Check main heading
    await expect(page.locator('h1')).toContainText('MedContractHub')
    
    // Check login/signup links
    await expect(page.locator('a[href="/login"]')).toBeVisible()
    await expect(page.locator('a[href="/signup"]')).toBeVisible()
  })

  test('should navigate to login page', async ({ page }) => {
    await page.click('a[href="/login"]')
    await expect(page).toHaveURL('/login')
    
    // Check login form elements
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/login')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should show validation errors or stay on login page
    const currentUrl = page.url()
    expect(currentUrl).toContain('/login')
  })

  test('should handle login form input sanitization', async ({ page }) => {
    await page.goto('/login')
    
    // Test email input sanitization
    await testInputSanitization(page, 'input[name="email"]')
    
    // Test password input (should not be sanitized for scripts but still secure)
    const passwordInput = 'input[name="password"]'
    await page.fill(passwordInput, 'password<script>alert("test")</script>')
    
    // Password should preserve the content (it's not displayed, so XSS not a concern)
    const passwordValue = await page.inputValue(passwordInput)
    expect(passwordValue).toContain('password')
  })

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Mock successful authentication response
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, user: { id: 'test-user' } })
      })
    })
    
    await page.goto('/login')
    
    // Fill login form with test credentials
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard or onboarding
    await page.waitForURL(/(dashboard|onboarding)/, { timeout: 10000 })
  })

  test('should navigate to signup page', async ({ page }) => {
    await page.click('a[href="/signup"]')
    await expect(page).toHaveURL('/signup')
    
    // Check signup form elements
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should validate signup form inputs', async ({ page }) => {
    await page.goto('/signup')
    
    // Test email validation
    await page.fill('input[name="email"]', 'invalid-email')
    await page.blur('input[name="email"]')
    
    // Should show email validation error
    const emailError = page.locator('text=valid email')
    await expect(emailError).toBeVisible({ timeout: 3000 })
  })

  test('should handle signup form sanitization', async ({ page }) => {
    await page.goto('/signup')
    
    // Test all signup inputs for sanitization
    await testInputSanitization(page, 'input[name="email"]')
    
    // Test company name if present
    const companyInput = page.locator('input[name="company"], input[name="companyName"]')
    if (await companyInput.count() > 0) {
      await testInputSanitization(page, 'input[name="company"], input[name="companyName"]')
    }
  })

  test('should protect dashboard routes when not authenticated', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard')
    
    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 })
    await expect(page).toHaveURL('/login')
  })

  test('should maintain security headers', async ({ page }) => {
    const response = await page.goto('/login')
    
    // Check for security headers
    const headers = response?.headers() || {}
    
    expect(headers).toHaveProperty('x-frame-options')
    expect(headers).toHaveProperty('x-content-type-options')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
  })

  test('should not have console errors on auth pages', async ({ page }) => {
    const errors = await checkForConsoleErrors(page)
    
    await page.goto('/login')
    await waitForPageLoad(page)
    
    await page.goto('/signup')
    await waitForPageLoad(page)
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('Warning:') &&
      !error.includes('chunk')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/**', async (route) => {
      await route.abort('failed')
    })
    
    await page.goto('/login')
    
    // Fill and submit form
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.click('button[type="submit"]')
    
    // Should handle error gracefully (stay on login page or show error message)
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    expect(currentUrl).toContain('/login')
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/login')
    
    // Check for proper form labels
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    
    // Inputs should have labels or aria-labels
    await expect(emailInput).toHaveAttribute('aria-label')
    await expect(passwordInput).toHaveAttribute('aria-label')
    
    // Check keyboard navigation
    await page.keyboard.press('Tab')
    await expect(emailInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(passwordInput).toBeFocused()
  })
})
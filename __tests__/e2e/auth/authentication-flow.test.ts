import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Authentication Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    await test.step('Navigate to login page', async () => {
      await page.goto('/login')
      await expect(page).toHaveURL('/login')
      
      // Verify login form is visible
      await expect(page.locator('form')).toBeVisible()
      await expect(page.locator('input[name="email"]')).toBeVisible()
      await expect(page.locator('input[name="password"]')).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/auth-01-login-page.png',
        fullPage: true 
      })
    })

    await test.step('Enter credentials and submit', async () => {
      await page.fill('input[name="email"]', TEST_USER.email)
      await page.fill('input[name="password"]', TEST_USER.password)
      
      // Submit form
      await page.click('button[type="submit"]')
      
      // Wait for navigation
      await page.waitForURL('**/dashboard', { timeout: 10000 })
    })

    await test.step('Verify successful login', async () => {
      // Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/)
      
      // Should see dashboard content
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/auth-02-dashboard-after-login.png',
        fullPage: true 
      })
    })
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login')
    
    // Enter invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 5000 })
    
    // Should still be on login page
    await expect(page).toHaveURL('/login')
  })

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without login
    await page.goto('/dashboard')
    
    // Should be redirected to login
    await expect(page).toHaveURL('/login')
  })

  test('should handle signup flow', async ({ page }) => {
    await page.goto('/signup')
    
    await test.step('Fill signup form', async () => {
      // Generate unique email
      const uniqueEmail = `test${Date.now()}@medcontracthub.com`
      
      await page.fill('input[name="email"]', uniqueEmail)
      await page.fill('input[name="password"]', TEST_USER.password)
      
      // Fill additional fields if present
      const nameInput = page.locator('input[name="name"]')
      if (await nameInput.count() > 0) {
        await nameInput.fill('Test User')
      }
      
      const companyInput = page.locator('input[name="company"]')
      if (await companyInput.count() > 0) {
        await companyInput.fill('Test Company')
      }
      
      await page.screenshot({ 
        path: 'test-results/auth-03-signup-form.png',
        fullPage: true 
      })
    })

    await test.step('Submit signup', async () => {
      await page.click('button[type="submit"]:has-text("Sign up")')
      
      // Should redirect to onboarding or dashboard
      await page.waitForURL(url => 
        url.includes('/onboarding') || url.includes('/dashboard'),
        { timeout: 10000 }
      )
    })
  })

  test('should handle logout', async ({ page }) => {
    // First login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")')
    
    if (await logoutButton.count() > 0) {
      await logoutButton.click()
    } else {
      // Try opening user menu first
      const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Account")')
      if (await userMenu.count() > 0) {
        await userMenu.click()
        await page.click('button:has-text("Logout"), button:has-text("Sign out")')
      }
    }
    
    // Should be redirected to login
    await expect(page).toHaveURL('/login')
  })

  test('should persist authentication across page refreshes', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Refresh page
    await page.reload()
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })
})

// Mobile authentication tests
test.describe('Authentication - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  
  test('should handle login on mobile', async ({ page }) => {
    await page.goto('/login')
    
    // Verify responsive layout
    await expect(page.locator('form')).toBeVisible()
    
    // Fill and submit
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard')
    
    await page.screenshot({ 
      path: 'test-results/auth-04-mobile-dashboard.png',
      fullPage: true 
    })
  })
})
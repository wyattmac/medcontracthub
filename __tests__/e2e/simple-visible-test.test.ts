import { test, expect } from '@playwright/test'

test.describe('Simple Visible Test - See the Browser', () => {
  test('Navigate through MedContractHub', async ({ page }) => {
    console.log('🌐 Opening browser...')
    
    // Step 1: Go to the app
    console.log('📍 Navigating to app...')
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(2000) // Wait so you can see
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/01-initial-page.png' })
    
    // Step 2: Check where we ended up
    const url = page.url()
    console.log('📍 Current URL:', url)
    
    if (url.includes('/dashboard')) {
      console.log('✅ Already on dashboard (dev mode)')
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    } else if (url.includes('/login')) {
      console.log('📍 Already on login page')
    } else {
      console.log('📍 On landing page, looking for login link...')
      // Try different selectors for login link
      const loginLink = page.locator('a:has-text("Login"), a[href="/login"], button:has-text("Login")')
      if (await loginLink.count() > 0) {
        await loginLink.first().click()
        await page.waitForTimeout(1000)
      }
    }
    
    // Step 3: If we're on login page, login
    if (page.url().includes('/login')) {
      console.log('🔐 Logging in with mock login...')
      
      // Check if it's mock login (development mode)
      const mockLoginTitle = page.locator('text=Mock Development Login')
      if (await mockLoginTitle.count() > 0) {
        console.log('✅ Found mock login form')
        
        // Clear and fill email
        const emailInput = page.locator('input#email, input[type="email"]')
        await emailInput.clear()
        await emailInput.fill('test@medcontracthub.com')
        await page.waitForTimeout(1000)
        
        await page.screenshot({ path: 'test-results/02-login-filled.png' })
        
        // Click the login button (no password needed for mock login)
        const submitButton = page.locator('button[type="submit"]')
        await submitButton.click()
        
        // Wait for redirect (mock login uses window.location.href)
        await page.waitForURL('**/dashboard', { timeout: 10000 })
      } else {
        // Regular login with password
        await page.fill('input[type="email"]', 'test@medcontracthub.com')
        await page.waitForTimeout(1000)
        
        await page.fill('input[type="password"]', 'Test123!@#')
        await page.waitForTimeout(1000)
        
        await page.screenshot({ path: 'test-results/02-login-filled.png' })
        
        await page.click('button[type="submit"]')
        await page.waitForURL('**/dashboard', { timeout: 10000 })
      }
    }
    
    // Step 4: Navigate around
    console.log('🎯 On Dashboard!')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/03-dashboard.png' })
    
    // Go to Opportunities
    console.log('📋 Going to Opportunities...')
    await page.click('nav >> text=Opportunities')
    await page.waitForURL('**/opportunities')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/04-opportunities.png' })
    
    // Go to Saved
    console.log('💾 Going to Saved...')
    await page.click('nav >> text=Saved')
    await page.waitForURL('**/saved')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/05-saved.png' })
    
    // Go to Proposals
    console.log('📝 Going to Proposals...')
    await page.click('nav >> text=Proposals')
    await page.waitForURL('**/proposals')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/06-proposals.png' })
    
    console.log('✅ Test complete!')
  })
})
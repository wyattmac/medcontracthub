import { test, expect } from '@playwright/test'

// Simple compliance matrix test without authentication for testing
test.describe('Compliance Matrix - Simple Test', () => {
  test('should load the application', async ({ page }) => {
    // Just verify the app loads
    await page.goto('/')
    
    // Check if we get redirected to login or see the app
    await expect(page).toHaveURL(/\/(login|dashboard)?/)
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'test-results/compliance-simple-01-app-load.png',
      fullPage: true 
    })
    
    console.log('Current URL:', page.url())
    console.log('Page title:', await page.title())
  })

  test('should navigate to opportunities if authenticated', async ({ page }) => {
    // Try to go directly to opportunities
    await page.goto('/opportunities')
    
    // We should either see opportunities or be redirected to login
    const url = page.url()
    console.log('Opportunities URL:', url)
    
    if (url.includes('/login')) {
      console.log('Redirected to login - authentication required')
      
      // Try mock login if available
      const mockLoginButton = page.locator('button:has-text("Development Login")')
      if (await mockLoginButton.count() > 0) {
        await mockLoginButton.click()
        await page.waitForURL('**/dashboard', { timeout: 5000 })
        
        // Now try opportunities again
        await page.goto('/opportunities')
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/compliance-simple-02-opportunities.png',
      fullPage: true 
    })
  })

  test('should check for compliance matrix button', async ({ page }) => {
    // Use development bypass
    await page.goto('/opportunities')
    
    // If redirected to login, handle it
    if (page.url().includes('/login')) {
      // Look for dev login
      const devLogin = page.locator('text=/dev.*login/i, button:has-text("Development")')
      if (await devLogin.count() > 0) {
        await devLogin.click()
        await page.waitForTimeout(2000)
        await page.goto('/opportunities')
      }
    }
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if opportunities loaded
    const hasOpportunities = await page.locator('[data-testid="opportunity-card"], .opportunity-card, table tbody tr').count() > 0
    
    if (hasOpportunities) {
      // Click first opportunity
      await page.locator('[data-testid="opportunity-card"], .opportunity-card, table tbody tr').first().click()
      await page.waitForTimeout(2000)
      
      // Look for compliance matrix button
      const complianceButton = page.locator('button:has-text("Compliance Matrix"), button:has-text("Generate Compliance")')
      const hasComplianceButton = await complianceButton.count() > 0
      
      console.log('Has compliance button:', hasComplianceButton)
      
      if (hasComplianceButton) {
        await complianceButton.click()
        await page.waitForTimeout(2000)
        
        console.log('Clicked compliance button, current URL:', page.url())
      }
    } else {
      console.log('No opportunities found on page')
    }
    
    await page.screenshot({ 
      path: 'test-results/compliance-simple-03-final.png',
      fullPage: true 
    })
  })
})
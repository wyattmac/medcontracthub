import { test, expect } from '@playwright/test'

// Skip login by using development auth bypass
test.use({
  storageState: undefined,
  extraHTTPHeaders: {
    'x-development-bypass': 'true'
  }
})

test.describe('Quick Compliance Matrix Test', () => {
  test.beforeEach(async ({ page }) => {
    // Set development bypass cookie
    await page.context().addCookies([{
      name: 'dev-auth-bypass',
      value: 'true',
      domain: 'localhost',
      path: '/'
    }])
  })

  test('should test compliance matrix quickly', async ({ page }) => {
    // Go directly to a specific opportunity
    await page.goto('http://localhost:3000/opportunities')
    
    // Wait for cards to appear using the actual CSS selector
    await page.waitForSelector('.hover\\:shadow-md.transition-shadow', {
      timeout: 10000
    })
    
    // Click the first opportunity card's title link
    const firstOpportunityLink = page.locator('a[href^="/opportunities/"]').first()
    await firstOpportunityLink.click()
    
    // Wait for opportunity detail page
    await page.waitForLoadState('networkidle')
    
    // Click Generate Compliance Matrix button
    const complianceButton = page.locator('button:has-text("Generate Compliance Matrix")')
    await expect(complianceButton).toBeVisible({ timeout: 5000 })
    await complianceButton.click()
    
    // Should navigate to compliance page
    await page.waitForURL('**/compliance')
    
    // Test manual creation
    const createManualButton = page.locator('button:has-text("Create Manually")')
    await expect(createManualButton).toBeVisible()
    await createManualButton.click()
    
    // Wait for the page to reload (since we fixed navigation)
    await page.waitForLoadState('networkidle')
    
    // Verify matrix was created
    const requirementsList = page.locator('text=/Requirements|Compliance Requirements/i')
    await expect(requirementsList).toBeVisible({ timeout: 5000 })
    
    console.log('✅ Quick compliance test passed!')
  })
})
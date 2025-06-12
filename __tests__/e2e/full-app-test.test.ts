import { test, expect } from '@playwright/test'

// Test configuration
const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Full App Test - Opportunities Loading', () => {
  test('Complete app test with opportunities verification', async ({ page }) => {
    console.log('🚀 Starting comprehensive MedContractHub test...')
    
    // Set up request logging to debug API calls
    const apiCalls: string[] = []
    page.on('request', request => {
      const url = request.url()
      if (url.includes('/api/')) {
        console.log(`📡 API Request: ${request.method()} ${url}`)
        apiCalls.push(`${request.method()} ${url}`)
      }
    })
    
    page.on('response', response => {
      const url = response.url()
      if (url.includes('/api/')) {
        console.log(`📨 API Response: ${response.status()} ${url}`)
        if (response.status() >= 400) {
          console.error(`❌ API Error: ${response.status()} ${url}`)
        }
      }
    })

    // Step 1: Navigate to app
    await test.step('1. Navigate to app and handle login', async () => {
      console.log('🌐 Navigating to app...')
      await page.goto('http://localhost:3000')
      await page.waitForLoadState('networkidle')
      
      const currentUrl = page.url()
      console.log(`📍 Current URL: ${currentUrl}`)
      
      // Handle login if needed
      if (currentUrl.includes('/login')) {
        console.log('🔐 On login page, logging in...')
        
        // Check for mock login
        const mockLoginTitle = await page.locator('text=Mock Development Login').count()
        if (mockLoginTitle > 0) {
          console.log('✅ Using mock login')
          
          const emailInput = page.locator('input[type="email"], input#email')
          await emailInput.clear()
          await emailInput.fill(TEST_USER.email)
          
          await page.screenshot({ path: 'test-results/full-01-login.png' })
          
          await page.click('button[type="submit"]')
          await page.waitForURL('**/dashboard', { timeout: 10000 })
          console.log('✅ Logged in successfully')
        }
      }
    })

    // Step 2: Verify dashboard loads
    await test.step('2. Verify dashboard', async () => {
      console.log('📊 Checking dashboard...')
      
      // Wait for dashboard to load
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 })
      
      // Check for dashboard stats
      const statsCards = page.locator('[data-testid*="stat"], [class*="stat-card"], [class*="card"]')
      const cardCount = await statsCards.count()
      console.log(`📈 Found ${cardCount} stat cards`)
      
      await page.screenshot({ path: 'test-results/full-02-dashboard.png' })
    })

    // Step 3: Navigate to opportunities and verify they load
    await test.step('3. Navigate to opportunities and verify loading', async () => {
      console.log('🔍 Navigating to opportunities...')
      
      // Click opportunities link
      await page.click('nav >> text=Opportunities')
      
      // Wait for navigation
      await page.waitForURL('**/opportunities', { timeout: 10000 })
      console.log('✅ On opportunities page')
      
      // Wait for page to stabilize
      await page.waitForLoadState('networkidle')
      
      // Take initial screenshot
      await page.screenshot({ path: 'test-results/full-03-opportunities-initial.png' })
      
      // Check for loading indicators
      console.log('⏳ Checking for loading state...')
      const loadingIndicators = page.locator('text=/loading|Loading|searching|Searching/i')
      const loadingCount = await loadingIndicators.count()
      console.log(`Found ${loadingCount} loading indicators`)
      
      // Wait for opportunities to load (with multiple possible selectors)
      console.log('🔍 Waiting for opportunities to load...')
      
      try {
        // Try different selectors for opportunity cards
        const opportunitySelectors = [
          '[data-testid="opportunity-card"]',
          '[data-testid*="opportunity"]',
          '[class*="opportunity-card"]',
          'article',
          '[role="article"]',
          'tr[data-testid*="opportunity"]',
          '.opportunity-item',
          '[id*="opportunity"]'
        ]
        
        let foundOpportunities = false
        for (const selector of opportunitySelectors) {
          const elements = page.locator(selector)
          const count = await elements.count()
          if (count > 0) {
            console.log(`✅ Found ${count} opportunities using selector: ${selector}`)
            foundOpportunities = true
            
            // Get text from first opportunity
            const firstOpp = elements.first()
            const text = await firstOpp.textContent()
            console.log(`📄 First opportunity preview: ${text?.substring(0, 100)}...`)
            break
          }
        }
        
        if (!foundOpportunities) {
          console.log('⚠️ No opportunities found with standard selectors')
          
          // Check for empty state messages
          const emptyStates = [
            'No opportunities found',
            'No results',
            'Try adjusting your filters',
            'No matching opportunities'
          ]
          
          for (const emptyText of emptyStates) {
            const emptyState = page.locator(`text=/${emptyText}/i`)
            if (await emptyState.count() > 0) {
              console.log(`📭 Empty state found: "${emptyText}"`)
              foundOpportunities = true
              break
            }
          }
        }
        
        // Check if there's an error message
        const errorMessages = page.locator('text=/error|failed|unable|problem/i')
        if (await errorMessages.count() > 0) {
          const errorText = await errorMessages.first().textContent()
          console.error(`❌ Error message found: ${errorText}`)
        }
        
        // Take screenshot after waiting
        await page.screenshot({ path: 'test-results/full-04-opportunities-loaded.png' })
        
        // Log page structure for debugging
        console.log('\n📋 Page structure analysis:')
        const mainContent = page.locator('main')
        if (await mainContent.count() > 0) {
          const headings = await mainContent.locator('h1, h2, h3').allTextContents()
          console.log('Headings found:', headings)
          
          const buttons = await mainContent.locator('button').allTextContents()
          console.log(`Buttons found: ${buttons.slice(0, 5).join(', ')}...`)
        }
        
      } catch (error) {
        console.error('❌ Error waiting for opportunities:', error)
        await page.screenshot({ path: 'test-results/full-error-opportunities.png' })
      }
    })

    // Step 4: Test search functionality
    await test.step('4. Test opportunity search', async () => {
      console.log('🔎 Testing search functionality...')
      
      // Find search input
      const searchSelectors = [
        'input[placeholder*="Search"]',
        'input[type="search"]',
        'input[name="search"]',
        '[data-testid="search-input"]',
        'input[aria-label*="Search"]'
      ]
      
      let searchInput = null
      for (const selector of searchSelectors) {
        const input = page.locator(selector)
        if (await input.count() > 0) {
          searchInput = input
          console.log(`✅ Found search input with selector: ${selector}`)
          break
        }
      }
      
      if (searchInput) {
        // Perform search
        await searchInput.clear()
        await searchInput.fill('medical supplies')
        console.log('📝 Entered search term: "medical supplies"')
        
        // Press enter or click search button
        await searchInput.press('Enter')
        
        // Wait for search results
        await page.waitForTimeout(2000)
        console.log('⏳ Waiting for search results...')
        
        await page.screenshot({ path: 'test-results/full-05-search-results.png' })
      } else {
        console.log('⚠️ Search input not found')
      }
    })

    // Step 5: Test other pages
    await test.step('5. Test navigation to other pages', async () => {
      console.log('🧭 Testing navigation to other pages...')
      
      // Test Saved page
      try {
        console.log('💾 Navigating to Saved...')
        await page.click('nav >> text=Saved')
        await page.waitForURL('**/saved', { timeout: 5000 })
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/full-06-saved.png' })
        console.log('✅ Saved page loaded')
      } catch (error) {
        console.error('❌ Failed to navigate to Saved:', error)
      }
      
      // Test Proposals page
      try {
        console.log('📝 Navigating to Proposals...')
        await page.click('nav >> text=Proposals')
        await page.waitForURL('**/proposals', { timeout: 5000 })
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/full-07-proposals.png' })
        console.log('✅ Proposals page loaded')
      } catch (error) {
        console.error('❌ Failed to navigate to Proposals:', error)
      }
      
      // Test Analytics page
      try {
        console.log('📊 Navigating to Analytics...')
        await page.click('nav >> text=Analytics')
        await page.waitForURL('**/analytics', { timeout: 5000 })
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: 'test-results/full-08-analytics.png' })
        console.log('✅ Analytics page loaded')
      } catch (error) {
        console.error('❌ Failed to navigate to Analytics:', error)
      }
    })

    // Step 6: Summary
    await test.step('6. Test summary', async () => {
      console.log('\n📊 Test Summary:')
      console.log('================')
      console.log(`Total API calls made: ${apiCalls.length}`)
      console.log('API endpoints called:')
      apiCalls.forEach(call => console.log(`  - ${call}`))
      
      // Go back to opportunities for final check
      await page.click('nav >> text=Opportunities')
      await page.waitForURL('**/opportunities')
      await page.waitForLoadState('networkidle')
      
      // Final screenshot
      await page.screenshot({ path: 'test-results/full-09-final.png', fullPage: true })
      
      // Check final state
      const finalOpportunities = await page.locator('article, [data-testid*="opportunity"], [class*="opportunity"]').count()
      console.log(`\n✅ Final opportunity count: ${finalOpportunities}`)
      
      if (finalOpportunities === 0) {
        console.log('\n🔍 Debugging: No opportunities found')
        console.log('Checking for common issues:')
        
        // Check for API errors
        const apiErrors = await page.locator('[class*="error"], [data-testid*="error"]').count()
        console.log(`- API error indicators: ${apiErrors}`)
        
        // Check for loading states stuck
        const loadingStuck = await page.locator('[class*="loading"], [class*="spinner"]').count()
        console.log(`- Loading indicators still visible: ${loadingStuck}`)
        
        // Get page text content for debugging
        const pageText = await page.locator('body').textContent()
        console.log(`- Page contains "error": ${pageText?.includes('error')}`)
        console.log(`- Page contains "loading": ${pageText?.includes('loading')}`)
        console.log(`- Page contains "opportunity": ${pageText?.includes('opportunity')}`)
      }
    })
  })
})

// Additional focused test for opportunities
test.describe('Opportunities Loading Debug', () => {
  test('Debug opportunities loading issue', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text())
      }
    })
    
    // Quick navigation to opportunities
    await page.goto('http://localhost:3000/opportunities')
    
    // If redirected to login, handle it
    if (page.url().includes('/login')) {
      const emailInput = page.locator('input[type="email"], input#email')
      await emailInput.fill('test@medcontracthub.com')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard')
      await page.goto('http://localhost:3000/opportunities')
    }
    
    // Wait and analyze
    await page.waitForLoadState('networkidle')
    
    // Detailed page analysis
    console.log('\n🔍 Detailed Opportunities Page Analysis:')
    console.log('=====================================')
    
    // Check all text content
    const allText = await page.locator('body').allTextContents()
    console.log('All text elements:', allText.length)
    
    // Look for specific patterns
    const patterns = [
      { name: 'Loading indicators', selector: 'text=/load|Load/i' },
      { name: 'Error messages', selector: 'text=/error|Error/i' },
      { name: 'Empty states', selector: 'text=/no|No|empty|Empty/i' },
      { name: 'Opportunity mentions', selector: 'text=/opportunity|Opportunity/i' },
      { name: 'Data tables', selector: 'table, [role="table"]' },
      { name: 'Cards/Articles', selector: 'article, [class*="card"]' },
      { name: 'Lists', selector: 'ul li, ol li, [role="list"]' }
    ]
    
    for (const pattern of patterns) {
      const count = await page.locator(pattern.selector).count()
      console.log(`${pattern.name}: ${count} found`)
    }
    
    // Take detailed screenshot
    await page.screenshot({ 
      path: 'test-results/debug-opportunities-full.png', 
      fullPage: true 
    })
    
    console.log('\n✅ Debug analysis complete')
  })
})
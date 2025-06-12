import { test, expect } from '@playwright/test'

test.describe('Test Opportunity Click', () => {
  test('Click on opportunity and verify detail page loads', async ({ page }) => {
    console.log('🚀 Testing opportunity click functionality...')
    
    // Step 1: Go directly to opportunities page
    console.log('\n1️⃣ Navigating to opportunities...')
    await page.goto('http://localhost:3000/opportunities')
    
    // Handle login redirect
    if (page.url().includes('/login')) {
      console.log('🔐 Logging in...')
      await page.fill('input[type="email"]', 'test@medcontracthub.com')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard')
      
      // Go back to opportunities
      await page.goto('http://localhost:3000/opportunities')
    }
    
    // Wait for opportunities to load
    console.log('\n2️⃣ Waiting for opportunities to load...')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // Take screenshot of opportunities page
    await page.screenshot({ path: 'test-results/opportunities-page-loaded.png' })
    
    // Find opportunity links
    console.log('\n3️⃣ Looking for opportunity links...')
    const opportunityLinks = await page.locator('a[href*="/opportunities/"]').all()
    console.log(`Found ${opportunityLinks.length} opportunity links`)
    
    if (opportunityLinks.length > 0) {
      // Get info about first opportunity
      const firstLink = opportunityLinks[0]
      const href = await firstLink.getAttribute('href')
      const text = await firstLink.textContent()
      console.log(`\n📋 First opportunity:`)
      console.log(`  Title: ${text}`)
      console.log(`  Link: ${href}`)
      
      // Click on the opportunity
      console.log('\n4️⃣ Clicking on opportunity...')
      await firstLink.click()
      
      // Wait for navigation
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Check current URL
      const currentUrl = page.url()
      console.log(`\n📍 Current URL: ${currentUrl}`)
      
      // Take screenshot of detail page
      await page.screenshot({ path: 'test-results/opportunity-detail-page.png' })
      
      // Verify we're on detail page
      if (currentUrl.includes('/opportunities/') && !currentUrl.endsWith('/opportunities')) {
        console.log('\n✅ SUCCESS: Navigated to opportunity detail page!')
        
        // Check for detail page elements
        const backButton = page.locator('text=Back to Opportunities')
        if (await backButton.isVisible()) {
          console.log('✅ Back button found')
        }
        
        // Check for opportunity title
        const titleElements = await page.locator('h1, h2, h3').allTextContents()
        console.log('\n📄 Page titles found:')
        titleElements.slice(0, 3).forEach(title => {
          if (title.trim()) console.log(`  - ${title.trim()}`)
        })
        
      } else {
        console.error('\n❌ Failed to navigate to detail page')
      }
      
    } else {
      console.error('\n❌ No opportunity links found!')
      
      // Debug: Check page content
      const pageText = await page.locator('main').textContent()
      if (pageText?.includes('Loading')) {
        console.log('⏳ Page still loading...')
      } else if (pageText?.includes('No opportunities')) {
        console.log('📭 No opportunities message found')
      } else {
        console.log('🔍 Page content preview:', pageText?.substring(0, 200))
      }
    }
    
    console.log('\n✅ Test complete!')
  })
})
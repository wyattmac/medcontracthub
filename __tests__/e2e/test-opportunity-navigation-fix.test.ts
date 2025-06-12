import { test, expect } from '@playwright/test'

test.describe('Test Opportunity Navigation Fix', () => {
  test('Verify correct opportunity opens when clicked', async ({ page }) => {
    console.log('🔍 Testing opportunity navigation fix...')
    
    // Step 1: Login
    console.log('\n1️⃣ Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'test@medcontracthub.com')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    console.log('✅ Logged in')
    
    // Step 2: Navigate to opportunities
    console.log('\n2️⃣ Going to opportunities page...')
    await page.goto('http://localhost:3000/opportunities')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Step 3: Find and click on different opportunities
    console.log('\n3️⃣ Testing multiple opportunities...')
    
    const opportunityLinks = await page.locator('a[href*="/opportunities/"]:not([href$="/opportunities"])').all()
    console.log(`Found ${opportunityLinks.length} opportunities`)
    
    if (opportunityLinks.length >= 2) {
      // Test first opportunity
      console.log('\n📋 Testing first opportunity:')
      const firstTitle = await opportunityLinks[0].locator('h3').textContent()
      console.log(`  Expected title: ${firstTitle}`)
      
      await opportunityLinks[0].click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Check if we're on the detail page
      const currentUrl = page.url()
      console.log(`  Current URL: ${currentUrl}`)
      
      // Check the title on the detail page
      const detailTitle = await page.locator('h1').first().textContent()
      console.log(`  Detail page title: ${detailTitle}`)
      
      // Check for error messages
      const errorAlert = await page.locator('[role="alert"]').first()
      if (await errorAlert.isVisible()) {
        const errorText = await errorAlert.textContent()
        console.log(`  ⚠️ Error found: ${errorText}`)
      } else {
        console.log('  ✅ No error messages')
      }
      
      // Check if it's showing the wrong "Cask and Trailer" mock data
      if (detailTitle?.includes('Cask and Trailer HIC Transport')) {
        console.log('  ❌ ISSUE: Showing mock data instead of real opportunity!')
      } else {
        console.log('  ✅ Showing correct opportunity (not mock data)')
      }
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/opportunity-1-detail.png' })
      
      // Go back to opportunities
      console.log('\n4️⃣ Going back to opportunities...')
      await page.goto('http://localhost:3000/opportunities')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Test second opportunity
      console.log('\n📋 Testing second opportunity:')
      const secondTitle = await opportunityLinks[1].locator('h3').textContent()
      console.log(`  Expected title: ${secondTitle}`)
      
      await opportunityLinks[1].click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      const detailTitle2 = await page.locator('h1').first().textContent()
      console.log(`  Detail page title: ${detailTitle2}`)
      
      if (detailTitle2?.includes('Cask and Trailer HIC Transport')) {
        console.log('  ❌ ISSUE: Still showing mock data!')
      } else {
        console.log('  ✅ Showing correct opportunity')
      }
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/opportunity-2-detail.png' })
      
    } else {
      console.log('❌ Not enough opportunities to test')
    }
    
    console.log('\n✅ Test complete!')
  })
})
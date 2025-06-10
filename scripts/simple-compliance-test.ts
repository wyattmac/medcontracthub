#!/usr/bin/env tsx

/**
 * Simple Compliance Test
 * Tests the compliance matrix with minimal steps
 */

import { chromium } from 'playwright'

async function simpleComplianceTest() {
  console.log('🧪 Simple Compliance Matrix Test')
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
  })
  
  const page = await browser.newPage()
  
  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    
    const devButton = page.locator('button:has-text("Enter Development Mode")')
    if (await devButton.count() > 0) {
      await devButton.click()
      await page.waitForURL('**/dashboard')
      console.log('   ✅ Logged in')
    }
    
    // Step 2: Go to opportunities
    console.log('2️⃣ Going to opportunities...')
    await page.goto('http://localhost:3000/opportunities')
    await page.waitForSelector('.hover\\:shadow-md', { timeout: 10000 })
    console.log('   ✅ Opportunities loaded')
    
    // Step 3: Click first opportunity
    console.log('3️⃣ Clicking first opportunity...')
    const firstLink = page.locator('a[href^="/opportunities/"]').first()
    const opportunityHref = await firstLink.getAttribute('href')
    await firstLink.click()
    await page.waitForURL('**/opportunities/*')
    console.log('   ✅ On opportunity detail page')
    
    // Step 4: Look for compliance button
    console.log('4️⃣ Looking for compliance button...')
    
    // First scroll to bottom to ensure Actions section is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1000)
    
    // Try multiple selectors
    let complianceButton = await page.locator('button:has-text("Generate Compliance Matrix")').first()
    let found = await complianceButton.count() > 0
    
    if (!found) {
      complianceButton = await page.locator('[data-testid="generate-compliance-matrix"]').first()
      found = await complianceButton.count() > 0
    }
    
    if (found) {
      console.log('   ✅ Found compliance button')
      
      // Step 5: Click compliance button
      console.log('5️⃣ Clicking compliance button...')
      await complianceButton.click()
      
      // Wait for navigation or page change
      await page.waitForTimeout(3000)
      
      const currentUrl = page.url()
      console.log(`   📍 Current URL: ${currentUrl}`)
      
      // Step 6: Test matrix creation
      console.log('6️⃣ Testing matrix creation...')
      const createManualButton = page.locator('button:has-text("Create Manually")').first()
      
      if (await createManualButton.count() > 0) {
        console.log('   ✅ Found Create Manually button')
        await createManualButton.click()
        await page.waitForTimeout(2000)
        
        // Check if matrix was created
        const hasRequirements = await page.locator('text=/Requirements/i').count() > 0
        if (hasRequirements) {
          console.log('   ✅ Compliance matrix created successfully!')
        } else {
          console.log('   ⚠️  Requirements section not found')
        }
      } else {
        console.log('   ⚠️  Create Manually button not found')
      }
    } else {
      console.log('   ❌ Compliance button not found')
      
      // Debug: list all buttons
      const buttons = await page.locator('button').allTextContents()
      console.log('   Available buttons:', buttons.filter(b => b.trim()))
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/simple-compliance-final.png',
      fullPage: true 
    })
    
    console.log('\n✅ Test completed!')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    await page.screenshot({ 
      path: 'test-results/simple-compliance-error.png',
      fullPage: true 
    })
  } finally {
    await browser.close()
  }
}

simpleComplianceTest().catch(console.error)
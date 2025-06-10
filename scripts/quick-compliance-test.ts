#!/usr/bin/env tsx

/**
 * Quick Compliance Matrix Test
 * Directly tests compliance functionality without restarting from login
 */

import { chromium } from 'playwright'

async function quickComplianceTest() {
  console.log('🚀 Quick Compliance Matrix Test')
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
  })
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // First, use the mock login
    console.log('🔐 Using mock development login...')
    await page.goto('http://localhost:3000/login')
    
    // Click the development mode button
    const devButton = page.locator('button:has-text("Enter Development Mode")')
    if (await devButton.count() > 0) {
      await devButton.click()
      await page.waitForURL('**/dashboard', { timeout: 5000 })
      console.log('✅ Logged in via development mode')
    }
    
    // Now go to opportunities
    console.log('📋 Loading opportunities page...')
    await page.goto('http://localhost:3000/opportunities')
    
    // Wait for opportunity cards using the actual CSS class
    console.log('⏳ Waiting for opportunities to load...')
    await page.waitForSelector('.hover\\:shadow-md.transition-shadow', {
      timeout: 15000
    })
    
    const opportunityCount = await page.locator('.hover\\:shadow-md.transition-shadow').count()
    console.log(`✅ Found ${opportunityCount} opportunities`)
    
    if (opportunityCount === 0) {
      throw new Error('No opportunities found')
    }
    
    // Click the first opportunity link
    console.log('🖱️ Clicking first opportunity...')
    const firstLink = page.locator('a[href^="/opportunities/"]').first()
    const opportunityTitle = await firstLink.textContent()
    console.log(`  Opportunity: ${opportunityTitle?.trim()}`)
    await firstLink.click()
    
    // Wait for detail page
    await page.waitForURL('**/opportunities/*', { timeout: 10000 })
    await page.waitForTimeout(2000)
    
    // Scroll down to see the Actions section
    console.log('📜 Scrolling to find Actions section...')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1000)
    
    // Check for compliance button - try multiple selectors
    console.log('🔍 Looking for compliance matrix button...')
    let complianceButton = page.locator('button:has-text("Generate Compliance Matrix")')
    
    if (await complianceButton.count() === 0) {
      // Try with data-testid
      complianceButton = page.locator('[data-testid="generate-compliance-matrix"]')
    }
    
    if (await complianceButton.count() === 0) {
      // Try with partial text match
      complianceButton = page.locator('button:has-text("Compliance Matrix")')
    }
    
    if (await complianceButton.count() === 0) {
      console.log('⚠️  No compliance button found, taking screenshot...')
      
      // Debug: Check what buttons are available
      const allButtons = await page.locator('button').allTextContents()
      console.log('Available buttons:', allButtons)
      
      await page.screenshot({ 
        path: 'test-results/quick-test-no-button.png',
        fullPage: true 
      })
      throw new Error('Compliance button not found')
    }
    
    console.log('✅ Found compliance button, clicking...')
    await complianceButton.click()
    
    // Wait for navigation
    await page.waitForURL('**/compliance', { timeout: 10000 })
    console.log('✅ Navigated to compliance page')
    
    // Test manual creation
    console.log('🔨 Testing manual matrix creation...')
    const createManualButton = page.locator('button:has-text("Create Manually")')
    
    if (await createManualButton.count() > 0) {
      await createManualButton.click()
      console.log('  Clicked Create Manually')
      
      // Wait for page reload
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
      
      // Check if matrix was created
      const hasRequirements = await page.locator('text=/Requirements|Compliance Requirements/i').count() > 0
      const hasMatrix = await page.locator('[data-testid="compliance-matrix"], [data-testid="requirements-list"]').count() > 0
      
      if (hasRequirements || hasMatrix) {
        console.log('✅ Manual compliance matrix created successfully!')
      } else {
        console.log('⚠️  Matrix may not have been created properly')
      }
    }
    
    // Test extract from RFP
    console.log('📄 Testing Extract from RFP...')
    const extractButton = page.locator('button:has-text("Extract from RFP")')
    
    if (await extractButton.count() > 0) {
      await extractButton.click()
      console.log('  Clicked Extract from RFP')
      
      // Wait for modal
      const modalVisible = await page.locator('[role="dialog"], [data-testid="requirement-extractor-modal"]').isVisible({ timeout: 5000 }).catch(() => false)
      
      if (modalVisible) {
        console.log('✅ Extraction modal opened')
        
        // Check for documents
        const documentCount = await page.locator('input[type="radio"]').count()
        console.log(`  Found ${documentCount} documents`)
        
        // Close modal
        await page.keyboard.press('Escape')
        console.log('  Modal closed')
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/quick-compliance-success.png',
      fullPage: true 
    })
    
    console.log('\n🎉 Quick compliance test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    await page.screenshot({ 
      path: 'test-results/quick-compliance-error.png',
      fullPage: true 
    })
    process.exit(1)
  } finally {
    await browser.close()
  }
}

// Run the test
quickComplianceTest().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
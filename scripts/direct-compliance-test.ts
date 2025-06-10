#!/usr/bin/env tsx

/**
 * Direct Compliance Matrix Test
 * Skip login and go directly to a specific opportunity to test compliance
 */

import { chromium } from 'playwright'

// You can change this to test different opportunities
const OPPORTUNITY_ID = '9b857a25-8a0f-4e9e-a47d-b8c4e7f0b1c8' // Example ID

async function directComplianceTest(opportunityId: string = OPPORTUNITY_ID) {
  console.log('🎯 Direct Compliance Matrix Test')
  console.log(`   Testing opportunity ID: ${opportunityId}`)
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
  })
  
  const context = await browser.newContext({
    // Set up cookies/storage to bypass auth
    storageState: {
      cookies: [
        {
          name: 'dev-mode',
          value: 'true',
          domain: 'localhost',
          path: '/',
          expires: Date.now() / 1000 + 3600
        }
      ],
      origins: [
        {
          origin: 'http://localhost:3000',
          localStorage: [
            {
              name: 'mock-user',
              value: JSON.stringify({
                id: 'test-user-id',
                email: 'test@medcontracthub.com',
                name: 'Test User'
              })
            }
          ]
        }
      ]
    }
  })
  
  const page = await context.newPage()
  
  try {
    // Go directly to the opportunity detail page
    console.log('📍 Navigating directly to opportunity...')
    await page.goto(`http://localhost:3000/opportunities/${opportunityId}`)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // Take screenshot of opportunity page
    await page.screenshot({ 
      path: 'test-results/compliance-direct-01-opportunity.png',
      fullPage: true 
    })
    
    // Check page title to ensure we're on the right page
    const title = await page.locator('h1').first().textContent()
    console.log(`✅ Loaded opportunity: ${title}`)
    
    // Look for compliance button in the Actions section
    console.log('🔍 Looking for compliance button in Actions section...')
    
    // First try to find the Actions card
    const actionsCard = page.locator('text=/Actions/i').locator('..')
    const actionsVisible = await actionsCard.isVisible().catch(() => false)
    
    if (!actionsVisible) {
      console.log('📜 Actions section not visible, scrolling...')
      // Scroll to find it
      await page.evaluate(() => {
        const actions = Array.from(document.querySelectorAll('*')).find(
          el => el.textContent?.includes('Actions')
        )
        actions?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      await page.waitForTimeout(1000)
    }
    
    // Now look for the compliance button
    const complianceButton = page.locator('button:has-text("Generate Compliance Matrix")')
    const buttonExists = await complianceButton.count() > 0
    
    if (!buttonExists) {
      console.log('⚠️  Compliance button not found, checking if already on compliance page...')
      
      // Maybe we're already on a compliance page or the button isn't available
      const currentUrl = page.url()
      if (currentUrl.includes('/compliance')) {
        console.log('✅ Already on compliance page')
      } else {
        // Try navigating directly
        console.log('🚀 Navigating directly to compliance page...')
        await page.goto(`http://localhost:3000/opportunities/${opportunityId}/compliance`)
        await page.waitForLoadState('networkidle')
      }
    } else {
      console.log('✅ Found compliance button, clicking...')
      await complianceButton.click()
      await page.waitForURL('**/compliance', { timeout: 10000 })
    }
    
    // Now test compliance functionality
    console.log('🧪 Testing compliance matrix functionality...')
    
    // Check if we have existing matrices or need to create one
    const existingMatrices = await page.locator('text=/Existing.*Matrices/i').count()
    const createButtons = await page.locator('button:has-text("Create")').count()
    
    console.log(`   Existing matrices section: ${existingMatrices > 0 ? 'Yes' : 'No'}`)
    console.log(`   Create buttons found: ${createButtons}`)
    
    // Test manual creation
    const createManualButton = page.locator('button:has-text("Create Manually")')
    if (await createManualButton.count() > 0) {
      console.log('📝 Creating manual compliance matrix...')
      await createManualButton.click()
      await page.waitForTimeout(2000)
      
      // Check if created
      const hasRequirements = await page.locator('text=/Requirements|Compliance Requirements/i').count() > 0
      console.log(`   Requirements section visible: ${hasRequirements ? 'Yes' : 'No'}`)
    }
    
    // Test extract from RFP
    const extractButton = page.locator('button:has-text("Extract from RFP")')
    if (await extractButton.count() > 0) {
      console.log('📄 Testing RFP extraction...')
      await extractButton.click()
      
      // Wait for modal
      const modalVisible = await page.locator('[role="dialog"]').isVisible({ timeout: 3000 }).catch(() => false)
      if (modalVisible) {
        console.log('   ✅ Extraction modal opened')
        
        // Count documents
        const docs = await page.locator('input[type="radio"]').count()
        console.log(`   📚 Found ${docs} documents available`)
        
        // Close modal
        await page.keyboard.press('Escape')
      }
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'test-results/compliance-direct-final.png',
      fullPage: true 
    })
    
    console.log('\n✅ Direct compliance test completed!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    await page.screenshot({ 
      path: 'test-results/compliance-direct-error.png',
      fullPage: true 
    })
    process.exit(1)
  } finally {
    await browser.close()
  }
}

// Allow running with a specific opportunity ID from command line
const opportunityId = process.argv[2] || OPPORTUNITY_ID

directComplianceTest(opportunityId).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
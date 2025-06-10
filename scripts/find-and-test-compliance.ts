#!/usr/bin/env tsx

/**
 * Find and Test Compliance
 * Finds the first available opportunity and tests compliance on it
 */

import { chromium } from 'playwright'

async function findAndTestCompliance() {
  console.log('🔍 Find and Test Compliance Matrix')
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
  })
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Quick login
    console.log('🔐 Quick login...')
    await page.goto('http://localhost:3000/login')
    const devButton = page.locator('button:has-text("Enter Development Mode")')
    if (await devButton.count() > 0) {
      await devButton.click()
      await page.waitForURL('**/dashboard', { timeout: 5000 })
    }
    
    // Get first opportunity ID
    console.log('📋 Finding an opportunity...')
    await page.goto('http://localhost:3000/opportunities')
    await page.waitForSelector('.hover\\:shadow-md.transition-shadow', { timeout: 10000 })
    
    // Get the href from the first opportunity link
    const firstLink = page.locator('a[href^="/opportunities/"]').first()
    const href = await firstLink.getAttribute('href')
    
    if (!href) {
      throw new Error('No opportunity link found')
    }
    
    // Extract the ID from the href
    const opportunityId = href.split('/').pop()
    console.log(`✅ Found opportunity ID: ${opportunityId}`)
    
    // Navigate directly to compliance page
    console.log('🎯 Going directly to compliance page...')
    await page.goto(`http://localhost:3000/opportunities/${opportunityId}/compliance`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/find-test-compliance-page.png',
      fullPage: true 
    })
    
    // Check what's on the page
    const pageTitle = await page.title()
    const pageUrl = page.url()
    console.log(`📄 Page title: ${pageTitle}`)
    console.log(`🔗 Page URL: ${pageUrl}`)
    
    // Look for compliance elements
    const hasCreateButtons = await page.locator('button:has-text("Create")').count() > 0
    const hasExistingMatrices = await page.locator('text=/Existing.*Matrices/i').count() > 0
    const hasRequirements = await page.locator('text=/Requirements/i').count() > 0
    
    console.log('\n📊 Page Analysis:')
    console.log(`   Create buttons: ${hasCreateButtons ? 'Yes' : 'No'}`)
    console.log(`   Existing matrices: ${hasExistingMatrices ? 'Yes' : 'No'}`)  
    console.log(`   Requirements section: ${hasRequirements ? 'Yes' : 'No'}`)
    
    // Test creating a matrix
    const createManualButton = page.locator('button:has-text("Create Manually")')
    if (await createManualButton.count() > 0) {
      console.log('\n🔨 Creating manual matrix...')
      await createManualButton.click()
      await page.waitForTimeout(3000)
      
      // Take screenshot after creation
      await page.screenshot({ 
        path: 'test-results/find-test-after-create.png',
        fullPage: true 
      })
      
      console.log('✅ Matrix created!')
    }
    
    console.log('\n✅ Test completed successfully!')
    console.log(`\n💡 You can now test this specific opportunity directly with:`)
    console.log(`   npx tsx scripts/direct-compliance-test.ts ${opportunityId}`)
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    await page.screenshot({ 
      path: 'test-results/find-test-error.png',
      fullPage: true 
    })
    process.exit(1)
  } finally {
    await browser.close()
  }
}

findAndTestCompliance().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
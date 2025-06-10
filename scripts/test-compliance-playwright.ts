#!/usr/bin/env tsx

/**
 * Test Compliance Matrix Generator with Playwright
 * This script tests the compliance matrix functionality with mock data
 */

import { chromium } from 'playwright'

async function testComplianceMatrix() {
  console.log('🧪 Testing Compliance Matrix Generator...')
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
  })
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Navigate to the app
    console.log('📍 Navigating to application...')
    await page.goto('http://localhost:3002')
    
    // Check if we're on login page
    if (page.url().includes('/login')) {
      console.log('🔐 On login page, using development bypass...')
      
      // Try to find development login
      const devLoginButton = await page.locator('button:has-text("Development"), button:has-text("Mock Login")')
      if (await devLoginButton.count() > 0) {
        await devLoginButton.click()
        await page.waitForURL('**/dashboard', { timeout: 5000 })
        console.log('✅ Logged in via development bypass')
      }
    }
    
    // Navigate to opportunities
    console.log('📋 Navigating to opportunities...')
    await page.goto('http://localhost:3002/opportunities')
    await page.waitForLoadState('networkidle')
    
    // Add a mock opportunity if none exist
    const opportunityCards = await page.locator('[data-testid="opportunity-card"]').count()
    console.log(`Found ${opportunityCards} opportunities`)
    
    if (opportunityCards === 0) {
      console.log('⚠️  No opportunities found, trying to add test data...')
      
      // Try to add test data via API
      const response = await page.request.post('http://localhost:3002/api/add-test-data', {
        headers: { 'Content-Type': 'application/json' },
        data: { type: 'opportunities' }
      })
      
      if (response.ok()) {
        console.log('✅ Added test data')
        await page.reload()
        await page.waitForLoadState('networkidle')
      }
    }
    
    // Click on first opportunity
    const firstOpportunity = page.locator('[data-testid="opportunity-card"]').first()
    if (await firstOpportunity.count() > 0) {
      console.log('🖱️  Clicking on first opportunity...')
      await firstOpportunity.click()
      await page.waitForLoadState('networkidle')
      
      // Look for compliance matrix button
      console.log('🔍 Looking for compliance matrix button...')
      const complianceButton = page.locator('button:has-text("Generate Compliance Matrix"), [data-testid="generate-compliance-matrix"]')
      
      if (await complianceButton.count() > 0) {
        console.log('✅ Found compliance matrix button')
        await complianceButton.click()
        await page.waitForLoadState('networkidle')
        
        // Check if we're on compliance page
        if (page.url().includes('/compliance')) {
          console.log('✅ Navigated to compliance page')
          
          // Try to create a manual matrix
          const createManualButton = page.locator('button:has-text("Create Manually")')
          if (await createManualButton.count() > 0) {
            console.log('🔨 Creating manual compliance matrix...')
            await createManualButton.click()
            await page.waitForTimeout(2000)
            
            // Check if matrix was created
            const requirementsList = await page.locator('[data-testid="requirements-list"]').count()
            if (requirementsList > 0) {
              console.log('✅ Compliance matrix created successfully!')
            }
          }
          
          // Try extract from RFP
          const extractButton = page.locator('button:has-text("Extract from RFP")')
          if (await extractButton.count() > 0) {
            console.log('📄 Testing extract from RFP...')
            await extractButton.click()
            
            // Check if modal opened
            const modal = await page.locator('[data-testid="requirement-extractor-modal"], [role="dialog"]').count()
            if (modal > 0) {
              console.log('✅ Extraction modal opened')
              
              // Close modal
              await page.keyboard.press('Escape')
            }
          }
        }
      } else {
        console.log('⚠️  Compliance matrix button not found')
      }
    } else {
      console.log('⚠️  No opportunities available to test')
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/compliance-playwright-final.png',
      fullPage: true 
    })
    
    console.log('✅ Test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    await page.screenshot({ 
      path: 'test-results/compliance-playwright-error.png',
      fullPage: true 
    })
  } finally {
    await browser.close()
  }
}

// Run the test
testComplianceMatrix().catch(console.error)
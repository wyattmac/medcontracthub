#!/usr/bin/env npx tsx

/**
 * Test Script for Button Functionality
 * Verifies that action buttons are working after toast library fixes
 */

import { chromium } from 'playwright'

async function testButtonFunctionality() {
  console.log('🧪 Starting button functionality test...')
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for visibility
  })
  
  const page = await browser.newPage()
  
  try {
    // Navigate to dashboard
    console.log('📍 Navigating to dashboard...')
    await page.goto('http://localhost:3000/dashboard')
    
    // Wait for opportunities to load
    await page.waitForSelector('[data-testid="opportunities-list"]', {
      timeout: 10000
    }).catch(() => {
      console.log('⚠️  Using fallback selector for opportunities list')
      return page.waitForSelector('.space-y-4', { timeout: 10000 })
    })
    
    console.log('✅ Opportunities loaded')
    
    // Test 1: Save Opportunity Button
    console.log('\n🔹 Testing Save Opportunity button...')
    const saveButton = await page.locator('button:has-text("Save")').first()
    
    if (await saveButton.count() > 0) {
      await saveButton.click()
      
      // Check for toast notification
      const toastAppeared = await page.waitForSelector('.sonner-toast', {
        timeout: 5000
      }).then(() => true).catch(() => false)
      
      if (toastAppeared) {
        console.log('✅ Save button works - Toast notification appeared')
        const toastText = await page.locator('.sonner-toast').textContent()
        console.log(`   Toast message: ${toastText}`)
      } else {
        console.log('❌ Save button - No toast notification')
      }
    } else {
      console.log('⚠️  No Save button found')
    }
    
    // Test 2: Mark for Proposal Button
    console.log('\n🔹 Testing Mark for Proposal button...')
    const proposalButton = await page.locator('button:has-text("Mark for Proposal")').first()
    
    if (await proposalButton.count() > 0) {
      await proposalButton.click()
      
      // Check if dialog opens
      const dialogAppeared = await page.waitForSelector('[role="dialog"]', {
        timeout: 5000
      }).then(() => true).catch(() => false)
      
      if (dialogAppeared) {
        console.log('✅ Mark for Proposal button works - Dialog opened')
        
        // Close dialog
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      } else {
        console.log('❌ Mark for Proposal button - No dialog opened')
      }
    } else {
      console.log('⚠️  No Mark for Proposal button found')
    }
    
    // Test 3: External Link Button
    console.log('\n🔹 Testing External Link button...')
    const externalButton = await page.locator('a[title="View on SAM.gov"]').first()
    
    if (await externalButton.count() > 0) {
      const href = await externalButton.getAttribute('href')
      console.log(`✅ External link button found - Links to: ${href}`)
    } else {
      console.log('⚠️  No External Link button found')
    }
    
    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console error:', msg.text())
      }
    })
    
    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(2000)
    
    console.log('\n✅ Button functionality test completed')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await browser.close()
  }
}

// Run the test
testButtonFunctionality().catch(console.error)
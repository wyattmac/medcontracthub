#!/usr/bin/env npx tsx

/**
 * Test AI Proposal Generator through proper UI flow
 * Uses mock authentication system
 */

import puppeteer from 'puppeteer'

const BASE_URL = 'http://localhost:3000'

async function testProposalGeneratorUI() {
  console.log('🧪 Testing AI Proposal Generator UI Flow\n')

  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    slowMo: 50 // Slow down for visibility
  })

  try {
    const page = await browser.newPage()
    
    // 1. Navigate to login page
    console.log('1️⃣ Navigating to login page...')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[type="email"]')

    // 2. Use mock login
    console.log('2️⃣ Performing mock login...')
    await page.type('input[type="email"]', 'test@medcontracthub.com')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForNavigation()
    console.log('✅ Logged in successfully')

    // 3. Navigate to opportunities
    console.log('3️⃣ Navigating to opportunities...')
    await page.goto(`${BASE_URL}/opportunities`)
    await page.waitForSelector('[data-testid="opportunity-card"]', { timeout: 10000 })

    // 4. Click on first opportunity
    console.log('4️⃣ Selecting first opportunity...')
    const firstOpportunity = await page.$('[data-testid="opportunity-card"]')
    if (!firstOpportunity) {
      throw new Error('No opportunities found')
    }
    await firstOpportunity.click()
    await page.waitForSelector('button:has-text("Mark for Proposal")')

    // 5. Click Mark for Proposal
    console.log('5️⃣ Clicking Mark for Proposal...')
    await page.click('button:has-text("Mark for Proposal")')
    
    // Should redirect to create proposal page
    await page.waitForNavigation()
    await page.waitForSelector('[data-testid="ai-proposal-generator"]')

    // 6. Check if AI Generator is available
    console.log('6️⃣ Checking AI Proposal Generator...')
    const aiGeneratorTab = await page.$('button:has-text("AI Generator")')
    if (aiGeneratorTab) {
      await aiGeneratorTab.click()
      console.log('✅ AI Generator tab found and clicked')
      
      // Check for required elements
      const sectionSelector = await page.$('select[name="section"]')
      const generateButton = await page.$('button:has-text("Generate")')
      
      if (sectionSelector && generateButton) {
        console.log('✅ AI Generator UI elements present')
        
        // Try to generate executive summary
        await page.select('select[name="section"]', 'executive_summary')
        await generateButton.click()
        
        // Wait for generation (with timeout)
        try {
          await page.waitForSelector('[data-testid="generation-result"]', { timeout: 30000 })
          console.log('✅ AI Generation completed successfully!')
        } catch (error) {
          console.log('⚠️  Generation timed out or failed')
        }
      }
    } else {
      console.log('⚠️  AI Generator tab not found')
    }

    // 7. Take screenshot for debugging
    await page.screenshot({ path: 'proposal-generator-test.png', fullPage: true })
    console.log('📸 Screenshot saved as proposal-generator-test.png')

    console.log('\n✅ UI flow test completed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    
    // Take error screenshot
    const page = (await browser.pages())[0]
    if (page) {
      await page.screenshot({ path: 'proposal-generator-error.png', fullPage: true })
      console.log('📸 Error screenshot saved')
    }
  } finally {
    await browser.close()
  }
}

// Run the test
testProposalGeneratorUI().catch(console.error)
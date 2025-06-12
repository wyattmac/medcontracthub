import { test, expect } from '@playwright/test'

test.describe('Check Opportunity Data', () => {
  test('Check opportunity notice IDs', async ({ page }) => {
    console.log('🔍 Checking opportunity data...')
    
    // Step 1: Login
    console.log('\n1️⃣ Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'test@medcontracthub.com')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Step 2: Go to opportunities
    console.log('\n2️⃣ Going to opportunities...')
    await page.goto('http://localhost:3000/opportunities')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Step 3: Intercept API calls to see opportunity data
    console.log('\n3️⃣ Intercepting opportunity data...')
    
    page.on('response', async response => {
      if (response.url().includes('/api/opportunities/') && response.status() === 200) {
        try {
          const data = await response.json()
          if (data.opportunity) {
            console.log('\n📋 Opportunity data:')
            console.log(`  ID: ${data.opportunity.id}`)
            console.log(`  Notice ID: ${data.opportunity.notice_id || 'NOT SET'}`)
            console.log(`  Title: ${data.opportunity.title}`)
            console.log(`  Has SAM.gov notice ID: ${!!data.opportunity.notice_id}`)
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    })
    
    // Step 4: Click first opportunity
    console.log('\n4️⃣ Clicking first opportunity...')
    const firstOpportunity = page.locator('a[href*="/opportunities/"]:not([href$="/opportunities"])').first()
    
    if (await firstOpportunity.isVisible()) {
      await firstOpportunity.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      
      // Check attachment section
      console.log('\n5️⃣ Checking attachment section...')
      const attachmentSection = page.locator('text=Contract Documents')
      if (await attachmentSection.isVisible()) {
        console.log('✅ Attachment section is visible')
        
        // Check for specific messages
        const noIdMessage = await page.locator('text=No SAM.gov notice ID').isVisible()
        const noAttachmentsMessage = await page.locator('text=No attachments found').isVisible()
        const hasAttachments = await page.locator('text=Available Documents').isVisible()
        
        console.log(`  No SAM.gov ID message: ${noIdMessage}`)
        console.log(`  No attachments message: ${noAttachmentsMessage}`)
        console.log(`  Has attachments: ${hasAttachments}`)
      }
    } else {
      console.log('❌ No opportunities found')
    }
    
    console.log('\n✅ Test complete!')
  })
})
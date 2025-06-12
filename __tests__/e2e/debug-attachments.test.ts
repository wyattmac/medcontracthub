import { test, expect } from '@playwright/test'

test.describe('Debug Attachments Display', () => {
  test('Inspect opportunity data and attachment loading', async ({ page }) => {
    console.log('🔍 Debugging attachment display issue...')
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'info' || msg.type() === 'error') {
        console.log(`[PAGE ${msg.type().toUpperCase()}]`, msg.text())
      }
    })
    
    // Step 1: Go directly to a specific opportunity
    console.log('\n1️⃣ Navigating to opportunity detail page...')
    
    // First, let's get to the opportunities page to find a real ID
    await page.goto('http://localhost:3000/opportunities')
    
    // Handle login
    if (page.url().includes('/login')) {
      console.log('🔐 Handling mock login...')
      await page.fill('input[type="email"]', 'test@medcontracthub.com')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard')
      await page.goto('http://localhost:3000/opportunities')
    }
    
    // Wait for opportunities to load
    await page.waitForLoadState('networkidle')
    
    // Inject debug script to log opportunity data
    console.log('\n2️⃣ Injecting debug script...')
    await page.evaluate(() => {
      // Override fetch to log API calls
      const originalFetch = window.fetch
      window.fetch = async (...args) => {
        const url = args[0] as string
        if (url.includes('attachments')) {
          console.log('🔗 Attachment API Call:', url)
        }
        const response = await originalFetch(...args)
        if (url.includes('attachments')) {
          const cloned = response.clone()
          const data = await cloned.json().catch(() => null)
          console.log('📥 Attachment API Response:', data)
        }
        return response
      }
    })
    
    // Find and click first opportunity
    const opportunityCard = page.locator('[data-testid="opportunity-card"]').first()
    const fallbackLink = page.locator('a[href*="/opportunities/"]').first()
    
    if (await opportunityCard.isVisible()) {
      console.log('\n3️⃣ Found opportunity card, clicking...')
      await opportunityCard.click()
    } else if (await fallbackLink.isVisible()) {
      console.log('\n3️⃣ Found opportunity link, clicking...')
      await fallbackLink.click()
    } else {
      console.log('❌ No opportunities found!')
      return
    }
    
    // Wait for navigation
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Extract opportunity data from the page
    console.log('\n4️⃣ Extracting opportunity data...')
    const opportunityData = await page.evaluate(() => {
      // Try to find opportunity data in various ways
      const dataFromProps = (window as any).__NEXT_DATA__?.props?.pageProps?.opportunity
      const dataFromState = (window as any).__opportunityData
      
      // Look for notice ID in the page
      const noticeIdElement = document.querySelector('[data-notice-id]')
      const noticeIdFromElement = noticeIdElement?.getAttribute('data-notice-id')
      
      // Look for the badge that shows "Notice ID:"
      const noticeBadge = Array.from(document.querySelectorAll('span')).find(el => 
        el.textContent?.includes('Notice ID:')
      )
      const noticeIdFromBadge = noticeBadge?.textContent?.replace('Notice ID:', '').trim()
      
      return {
        fromProps: dataFromProps,
        fromState: dataFromState,
        fromElement: noticeIdFromElement,
        fromBadge: noticeIdFromBadge,
        url: window.location.href,
        opportunityId: window.location.pathname.split('/').pop()
      }
    })
    
    console.log('\n📊 Opportunity Data Found:')
    console.log('   URL:', opportunityData.url)
    console.log('   Opportunity ID:', opportunityData.opportunityId)
    console.log('   Notice ID from badge:', opportunityData.fromBadge)
    console.log('   Notice ID from element:', opportunityData.fromElement)
    
    // Check for attachment component
    console.log('\n5️⃣ Checking attachment component state...')
    
    const attachmentSection = page.locator('text=Contract Documents')
    if (await attachmentSection.isVisible()) {
      console.log('✅ Attachment section is visible')
      
      // Check various states
      const states = {
        loading: await page.locator('text=Loading attachments').isVisible(),
        error: await page.locator('[role="alert"]').isVisible(),
        noAttachments: await page.locator('text=No attachments found').isVisible(),
        hasAttachments: await page.locator('text=Available Documents').isVisible()
      }
      
      console.log('   Component states:', states)
      
      if (states.error) {
        const errorText = await page.locator('[role="alert"]').textContent()
        console.log('   ⚠️ Error message:', errorText)
      }
      
      if (states.hasAttachments) {
        const attachmentCount = await page.locator('[data-testid="attachment-item"]').count()
        console.log('   📎 Attachments found:', attachmentCount)
      }
    } else {
      console.log('❌ Attachment section not found!')
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-attachments.png', fullPage: true })
    
    // Wait a bit more to see if any delayed API calls happen
    console.log('\n6️⃣ Waiting for any delayed API calls...')
    await page.waitForTimeout(3000)
    
    console.log('\n✅ Debug complete!')
  })
})
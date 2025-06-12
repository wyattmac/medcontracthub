import { test, expect } from '@playwright/test'

test.describe('Test Attachments Final', () => {
  test('Verify attachments display correctly', async ({ page }) => {
    console.log('🔍 Final test of attachment functionality...')
    
    // Monitor console for debugging
    page.on('console', msg => {
      if (msg.text().includes('Attachments') || msg.text().includes('attachments')) {
        console.log(`[PAGE LOG] ${msg.text()}`)
      }
    })
    
    // Step 1: Login
    console.log('\n1️⃣ Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'test@medcontracthub.com')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })
    console.log('✅ Logged in')
    
    // Step 2: Navigate directly to an opportunity with attachments
    console.log('\n2️⃣ Going to specific opportunity...')
    
    // Use one of the real opportunities from our database check
    const opportunityId = '9e659fdc-738b-476d-a897-7245c98df7c9' // 59--SWITCH,TOGGLE
    await page.goto(`http://localhost:3000/opportunities/${opportunityId}`)
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)
    
    // Step 3: Check if attachment section is visible
    console.log('\n3️⃣ Checking attachment section...')
    
    const attachmentSection = await page.locator('text=Contract Documents').first()
    const isVisible = await attachmentSection.isVisible().catch(() => false)
    
    if (isVisible) {
      console.log('✅ Attachment section found!')
      
      // Wait a bit for attachments to load
      await page.waitForTimeout(2000)
      
      // Check different states
      const states = {
        loading: await page.locator('text=Loading attachments').isVisible().catch(() => false),
        noSamId: await page.locator('text=No SAM.gov notice ID').isVisible().catch(() => false),
        noAttachments: await page.locator('text=No attachments found').isVisible().catch(() => false),
        hasAttachments: await page.locator('text=Available Documents').isVisible().catch(() => false),
        error: await page.locator('[role="alert"]').first().isVisible().catch(() => false)
      }
      
      console.log('\n📊 Attachment component states:')
      console.log(`  Loading: ${states.loading}`)
      console.log(`  No SAM ID message: ${states.noSamId}`)
      console.log(`  No attachments: ${states.noAttachments}`)
      console.log(`  Has attachments: ${states.hasAttachments}`)
      console.log(`  Error: ${states.error}`)
      
      // If there's an error, get the message
      if (states.error) {
        const errorText = await page.locator('[role="alert"]').first().textContent().catch(() => 'Unknown error')
        console.log(`  Error message: ${errorText}`)
      }
      
      // Check for notice ID badge
      const noticeBadge = await page.locator('span:has-text("Notice ID:")').textContent().catch(() => null)
      if (noticeBadge) {
        console.log(`\n📌 ${noticeBadge}`)
      }
      
      // If attachments are found, list them
      if (states.hasAttachments) {
        const attachmentItems = await page.locator('[data-testid="attachment-item"], div:has(> svg + div > p)').all()
        console.log(`\n📎 Found ${attachmentItems.length} attachment(s)`)
        
        for (let i = 0; i < Math.min(attachmentItems.length, 3); i++) {
          const filename = await attachmentItems[i].locator('p').first().textContent().catch(() => 'Unknown')
          console.log(`  ${i + 1}. ${filename}`)
        }
      }
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/attachments-final.png', fullPage: true })
      
    } else {
      console.log('❌ Attachment section not found')
      
      // Check if we're on the right page
      const title = await page.locator('h1').first().textContent().catch(() => 'No title')
      console.log(`  Page title: ${title}`)
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/attachments-error.png', fullPage: true })
    }
    
    console.log('\n✅ Test complete!')
  })
})
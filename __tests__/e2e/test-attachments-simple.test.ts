import { test, expect } from '@playwright/test'

test.describe('Test Attachments Simple', () => {
  test('Check attachment display on opportunity detail', async ({ page }) => {
    console.log('🔍 Testing attachment display...')
    
    // Monitor network requests
    const attachmentRequests: any[] = []
    page.on('request', request => {
      if (request.url().includes('attachments')) {
        console.log(`📡 Attachment request: ${request.url()}`)
      }
    })
    
    page.on('response', async response => {
      if (response.url().includes('attachments')) {
        const status = response.status()
        const body = await response.text().catch(() => '')
        attachmentRequests.push({
          url: response.url(),
          status,
          body: body.substring(0, 200)
        })
        console.log(`📥 Attachment response: ${status}`)
      }
    })
    
    // Step 1: Navigate to login page first
    console.log('\n1️⃣ Going to login page...')
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    
    // Step 2: Perform mock login
    console.log('\n2️⃣ Performing mock login...')
    await page.fill('input[type="email"]', 'test@medcontracthub.com')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard')
    console.log('✅ Logged in successfully')
    
    // Step 3: Navigate to opportunities
    console.log('\n3️⃣ Going to opportunities page...')
    await page.goto('http://localhost:3000/opportunities')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Take screenshot of opportunities page
    await page.screenshot({ path: 'test-results/opportunities-page.png' })
    
    // Step 4: Find and click an opportunity
    console.log('\n4️⃣ Looking for opportunities...')
    
    // Try different selectors
    const selectors = [
      'a[href*="/opportunities/"]:not([href$="/opportunities"])',
      '[data-testid="opportunity-card"]',
      '.opportunity-card',
      'article a[href*="/opportunities/"]'
    ]
    
    let opportunityFound = false
    for (const selector of selectors) {
      const elements = await page.locator(selector).all()
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} opportunities using selector: ${selector}`)
        
        // Get href of first opportunity
        const firstElement = elements[0]
        const href = await firstElement.getAttribute('href').catch(() => null)
        const text = await firstElement.textContent().catch(() => 'Unknown')
        
        console.log(`📋 First opportunity:`)
        console.log(`   Title: ${text?.trim()}`)
        console.log(`   Link: ${href}`)
        
        // Click the opportunity
        await firstElement.click()
        opportunityFound = true
        break
      }
    }
    
    if (!opportunityFound) {
      console.log('❌ No opportunities found!')
      const pageContent = await page.locator('body').textContent()
      console.log('Page content preview:', pageContent?.substring(0, 500))
      return
    }
    
    // Step 5: Wait for detail page to load
    console.log('\n5️⃣ Waiting for detail page...')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    
    // Take screenshot of detail page
    await page.screenshot({ path: 'test-results/opportunity-detail.png' })
    
    // Step 6: Check for attachment section
    console.log('\n6️⃣ Checking for attachment section...')
    
    // Look for the attachment component
    const attachmentSection = page.locator('text=Contract Documents').first()
    const attachmentVisible = await attachmentSection.isVisible().catch(() => false)
    
    if (attachmentVisible) {
      console.log('✅ Attachment section found!')
      
      // Check different states
      const states = {
        loading: await page.locator('text=Loading attachments').isVisible().catch(() => false),
        noId: await page.locator('text=No SAM.gov notice ID').isVisible().catch(() => false),
        noAttachments: await page.locator('text=No attachments found').isVisible().catch(() => false),
        hasAttachments: await page.locator('text=Available Documents').isVisible().catch(() => false),
        error: await page.locator('[role="alert"]').isVisible().catch(() => false)
      }
      
      console.log('\nAttachment component states:')
      console.log(`  Loading: ${states.loading}`)
      console.log(`  No Notice ID: ${states.noId}`)
      console.log(`  No Attachments: ${states.noAttachments}`)
      console.log(`  Has Attachments: ${states.hasAttachments}`)
      console.log(`  Error: ${states.error}`)
      
      if (states.error) {
        const errorText = await page.locator('[role="alert"]').textContent()
        console.log(`  Error message: ${errorText}`)
      }
      
      // Extract notice ID info
      const noticeBadge = await page.locator('text=Notice ID:').textContent().catch(() => null)
      if (noticeBadge) {
        console.log(`\n📌 Notice ID badge found: ${noticeBadge}`)
      }
    } else {
      console.log('❌ Attachment section not found!')
      
      // Debug: print page structure
      const mainContent = await page.locator('main').innerHTML().catch(() => '')
      console.log('\nMain content preview:')
      console.log(mainContent.substring(0, 1000))
    }
    
    // Step 7: Check network requests
    console.log('\n7️⃣ Attachment API requests made:')
    if (attachmentRequests.length === 0) {
      console.log('❌ No attachment API requests were made')
    } else {
      attachmentRequests.forEach((req, i) => {
        console.log(`\nRequest ${i + 1}:`)
        console.log(`  URL: ${req.url}`)
        console.log(`  Status: ${req.status}`)
        console.log(`  Response preview: ${req.body}`)
      })
    }
    
    console.log('\n✅ Test complete!')
  })
})
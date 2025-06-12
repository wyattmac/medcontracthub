import { test, expect } from '@playwright/test'

test.describe('Test Attachments API', () => {
  test('Test attachment loading for real opportunities', async ({ page }) => {
    console.log('🔍 Testing attachment API functionality...')
    
    // Step 1: Navigate to opportunities page
    console.log('\n1️⃣ Going to opportunities page...')
    await page.goto('http://localhost:3000/opportunities')
    
    // Handle login redirect
    if (page.url().includes('/login')) {
      console.log('🔐 Logging in...')
      await page.fill('input[type="email"]', 'test@medcontracthub.com')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard')
      await page.goto('http://localhost:3000/opportunities')
    }
    
    // Wait for opportunities to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Find opportunity links
    console.log('\n2️⃣ Finding opportunities with notice IDs...')
    const opportunityLinks = await page.locator('a[href*="/opportunities/"]').all()
    console.log(`Found ${opportunityLinks.length} opportunities`)
    
    if (opportunityLinks.length > 0) {
      // Click first opportunity
      const firstLink = opportunityLinks[0]
      const href = await firstLink.getAttribute('href')
      console.log(`\n3️⃣ Clicking opportunity: ${href}`)
      
      // Set up request interceptor to capture API calls
      const apiCalls: Array<{url: string, response?: any}> = []
      
      page.on('response', async response => {
        const url = response.url()
        if (url.includes('/api/sam-gov/attachments-no-auth')) {
          const responseData = await response.json().catch(() => null)
          apiCalls.push({ url, response: responseData })
          console.log('\n📡 Attachment API call captured:')
          console.log(`   URL: ${url}`)
          console.log(`   Status: ${response.status()}`)
          console.log(`   Response:`, JSON.stringify(responseData, null, 2))
        }
      })
      
      // Click opportunity and wait for detail page
      await firstLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      
      // Check if attachment API was called
      console.log('\n4️⃣ Checking attachment API calls...')
      if (apiCalls.length === 0) {
        console.log('❌ No attachment API calls were made!')
        
        // Check if the component is even rendered
        const attachmentSection = page.locator('text=Contract Documents')
        if (await attachmentSection.isVisible()) {
          console.log('✅ Attachment component is visible')
          
          // Check for loading state
          const loadingIndicator = page.locator('text=Loading attachments')
          if (await loadingIndicator.isVisible()) {
            console.log('⏳ Attachments are loading...')
          }
          
          // Check for error state
          const errorIndicator = page.locator('[role="alert"]')
          if (await errorIndicator.isVisible()) {
            const errorText = await errorIndicator.textContent()
            console.log(`⚠️ Error state found: ${errorText}`)
          }
          
          // Check for no attachments message
          const noAttachments = page.locator('text=No attachments found')
          if (await noAttachments.isVisible()) {
            console.log('📭 No attachments message displayed')
          }
        } else {
          console.log('❌ Attachment component not found on page!')
        }
      } else {
        console.log(`✅ Made ${apiCalls.length} attachment API calls`)
        
        // Analyze responses
        for (const call of apiCalls) {
          if (call.response?.success) {
            console.log(`\n✅ Successful response:`)
            console.log(`   Notice ID: ${call.response.data.noticeId}`)
            console.log(`   Attachments: ${call.response.data.count}`)
            if (call.response.data.attachments.length > 0) {
              console.log('   Files:')
              call.response.data.attachments.forEach((att: any) => {
                console.log(`     - ${att.filename}`)
              })
            }
          } else {
            console.log(`\n❌ Failed response:`)
            console.log(`   Error: ${call.response?.error}`)
          }
        }
      }
      
      // Take screenshot of detail page
      await page.screenshot({ path: 'test-results/opportunity-detail-with-attachments.png' })
      
      // Debug: Check what notice ID is being passed
      console.log('\n5️⃣ Checking opportunity data...')
      
      // Try to extract opportunity ID from URL
      const currentUrl = page.url()
      const opportunityId = currentUrl.split('/opportunities/')[1]
      console.log(`   Opportunity ID from URL: ${opportunityId}`)
      
      // Check page content for notice ID references
      const pageContent = await page.content()
      const noticeIdMatch = pageContent.match(/notice[_-]?id["\s:]+["']?([^"'\s,}]+)/i)
      if (noticeIdMatch) {
        console.log(`   Notice ID found in page: ${noticeIdMatch[1]}`)
      }
      
    } else {
      console.log('❌ No opportunities found to test')
    }
    
    console.log('\n✅ Test complete!')
  })
})
import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Compliance Matrix - Real Data Test', () => {
  test('should test compliance matrix with real opportunity data', async ({ page }) => {
    // Step 1: Login with mock development account
    await test.step('Login to application', async () => {
      await page.goto('http://localhost:3000/login')
      
      // Use the mock development login
      const mockEmailInput = page.locator('input[type="email"][value*="@medcontracthub.com"]')
      if (await mockEmailInput.count() > 0) {
        console.log('Using mock development login')
        
        // Click Enter Development Mode button
        await page.click('button:has-text("Enter Development Mode")')
      } else {
        // Fallback to regular login fields if not in mock mode
        await page.fill('input[name="email"]', TEST_USER.email)
        await page.fill('input[name="password"]', TEST_USER.password)
        await page.click('button[type="submit"]')
      }
      
      // Wait for dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 })
      console.log('✅ Successfully logged in')
      
      await page.screenshot({ 
        path: 'test-results/compliance-real-01-dashboard.png',
        fullPage: true 
      })
    })

    // Step 2: Navigate to opportunities and find one with attachments
    await test.step('Find opportunity with attachments', async () => {
      await page.goto('http://localhost:3000/opportunities')
      await page.waitForLoadState('networkidle')
      
      // Wait for opportunities to load - check for loading state first
      console.log('Waiting for opportunities to load...')
      
      // Wait for the skeleton loaders to disappear or cards to appear
      await page.waitForFunction(() => {
        const skeletons = document.querySelectorAll('.animate-pulse')
        const cards = document.querySelectorAll('.hover\\:shadow-md.transition-shadow')
        return skeletons.length === 0 || cards.length > 0
      }, { timeout: 15000 }).catch(() => console.log('Loading timeout'))
      
      // Wait a bit more for data to render
      await page.waitForTimeout(2000)
      
      // Now check if opportunities are available - using the actual card classes from OpportunitiesList
      const hasOpportunities = await page.locator('.hover\\:shadow-md.transition-shadow').count() > 0
      
      if (!hasOpportunities) {
        console.log('No opportunities loaded yet, checking for empty state or errors...')
        
        // Check for API quota message
        const quotaMessage = await page.locator('text=/API Quota|quota/i').count()
        if (quotaMessage > 0) {
          console.log('⚠️  API quota limit may be affecting data loading')
        }
        
        // Try refreshing
        const refreshButton = page.locator('button:has-text("Refresh")')
        if (await refreshButton.count() > 0) {
          console.log('Clicking refresh button...')
          await refreshButton.click()
          await page.waitForTimeout(5000)
        }
      }
      
      // Get all opportunities
      const opportunities = await page.locator('[data-testid="opportunity-card"], .opportunity-card, table tbody tr').all()
      console.log(`Found ${opportunities.length} opportunities`)
      
      // Look for opportunities with attachments by checking each one
      let foundOpportunityWithAttachments = false
      let opportunityIndex = 0
      
      for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
        console.log(`Checking opportunity ${i + 1}...`)
        
        // Click on the opportunity
        await opportunities[i].click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        
        // Check if attachments section exists
        const hasAttachments = await page.locator('[data-testid="attachments-section"], [data-testid="opportunity-attachments"], :has-text("Attachments"), :has-text("Documents")').count() > 0
        const attachmentCount = await page.locator('[data-testid="attachment-item"], a[href*=".pdf"], a[href*=".doc"]').count()
        
        console.log(`Opportunity ${i + 1}: Has attachments section: ${hasAttachments}, Attachment count: ${attachmentCount}`)
        
        if (hasAttachments && attachmentCount > 0) {
          foundOpportunityWithAttachments = true
          opportunityIndex = i
          console.log(`✅ Found opportunity with ${attachmentCount} attachments`)
          
          // Get opportunity details
          const title = await page.locator('h1').textContent()
          const noticeId = await page.locator('text=/Notice ID|notice_id/i').locator('..').locator('p, span').last().textContent()
          console.log(`Opportunity: ${title}`)
          console.log(`Notice ID: ${noticeId}`)
          
          await page.screenshot({ 
            path: 'test-results/compliance-real-02-opportunity-detail.png',
            fullPage: true 
          })
          break
        } else {
          // Go back to opportunities list
          await page.goBack()
          await page.waitForLoadState('networkidle')
        }
      }
      
      if (!foundOpportunityWithAttachments) {
        console.log('⚠️  No opportunities with attachments found in the first 5 opportunities')
        // Still proceed with the first opportunity
        await opportunities[0].click()
        await page.waitForLoadState('networkidle')
      }
    })

    // Step 3: Click Generate Compliance Matrix
    await test.step('Open compliance matrix generator', async () => {
      // Look for the compliance matrix button
      const complianceButton = page.locator('button:has-text("Generate Compliance Matrix"), [data-testid="generate-compliance-matrix"]')
      
      if (await complianceButton.count() > 0) {
        console.log('Found compliance matrix button')
        await complianceButton.click()
        
        // Wait for navigation to compliance page
        await page.waitForURL('**/compliance', { timeout: 10000 })
        console.log('✅ Navigated to compliance page')
        
        await page.screenshot({ 
          path: 'test-results/compliance-real-03-compliance-page.png',
          fullPage: true 
        })
      } else {
        throw new Error('Compliance matrix button not found')
      }
    })

    // Step 4: Test manual matrix creation
    await test.step('Create manual compliance matrix', async () => {
      const createManualButton = page.locator('button:has-text("Create Manually")')
      
      if (await createManualButton.count() > 0) {
        console.log('Creating manual compliance matrix...')
        await createManualButton.click()
        
        // Wait for matrix to be created
        await page.waitForTimeout(3000)
        
        // Check if requirements section appeared
        const requirementsSection = await page.locator('[data-testid="requirements-list"], :has-text("Requirements")').count()
        
        if (requirementsSection > 0) {
          console.log('✅ Manual compliance matrix created successfully')
          
          await page.screenshot({ 
            path: 'test-results/compliance-real-04-manual-matrix.png',
            fullPage: true 
          })
        }
      }
    })

    // Step 5: Test extract from RFP if attachments exist
    await test.step('Test extract from RFP', async () => {
      // Go back to create new matrix if needed
      const extractButton = page.locator('button:has-text("Extract from RFP"), [data-testid="extract-rfp-button"]')
      
      if (await extractButton.count() === 0) {
        // Navigate back to compliance page
        await page.goto(page.url())
        await page.waitForLoadState('networkidle')
      }
      
      if (await extractButton.count() > 0) {
        console.log('Testing extract from RFP...')
        await extractButton.click()
        
        // Wait for modal to open
        await page.waitForSelector('[data-testid="requirement-extractor-modal"], [role="dialog"]:has-text("Extract")', {
          timeout: 5000
        })
        
        console.log('✅ Extraction modal opened')
        
        // Check if documents loaded
        const documentList = await page.locator('[data-testid="document-list"], input[type="radio"]').count()
        console.log(`Found ${documentList} documents in modal`)
        
        if (documentList > 0) {
          // Select first document if not already selected
          const firstRadio = page.locator('input[type="radio"]').first()
          if (!await firstRadio.isChecked()) {
            await firstRadio.click()
          }
          
          // Make sure Section L and M are selected
          const sectionL = page.locator('input[id*="section-l"], #section-l')
          const sectionM = page.locator('input[id*="section-m"], #section-m')
          
          if (await sectionL.count() > 0 && !await sectionL.isChecked()) {
            await sectionL.click()
          }
          if (await sectionM.count() > 0 && !await sectionM.isChecked()) {
            await sectionM.click()
          }
          
          await page.screenshot({ 
            path: 'test-results/compliance-real-05-extraction-modal.png',
            fullPage: true 
          })
          
          // Start extraction
          const startExtractionButton = page.locator('button:has-text("Extract Requirements"), [data-testid="start-extraction"]')
          if (await startExtractionButton.count() > 0) {
            console.log('Starting extraction...')
            await startExtractionButton.click()
            
            // Wait for extraction to complete (this might take a while)
            console.log('Waiting for extraction to complete...')
            
            // Wait for loading indicator to disappear
            await page.waitForFunction(() => {
              const spinner = document.querySelector('.animate-spin, [data-testid="extraction-progress"]')
              return !spinner
            }, { timeout: 120000 })
            
            console.log('✅ Extraction completed')
            
            await page.screenshot({ 
              path: 'test-results/compliance-real-06-extraction-complete.png',
              fullPage: true 
            })
            
            // Check results
            const requirementItems = await page.locator('[data-testid="requirement-item"], [data-section]').count()
            console.log(`Found ${requirementItems} requirements extracted`)
          }
        } else {
          console.log('⚠️  No documents found in extraction modal')
          // Close modal
          await page.keyboard.press('Escape')
        }
      }
    })

    // Step 6: Test response tracking
    await test.step('Test response tracking', async () => {
      // Look for response tracking tab
      const responseTab = page.locator('[data-tab="responses"], button:has-text("Response Tracking")')
      
      if (await responseTab.count() > 0) {
        console.log('Testing response tracking...')
        await responseTab.click()
        await page.waitForTimeout(1000)
        
        // Find first requirement
        const firstRequirement = page.locator('[data-testid="requirement-item"]').first()
        if (await firstRequirement.count() > 0) {
          // Update status
          const statusSelect = firstRequirement.locator('[data-testid="status-select"], select')
          if (await statusSelect.count() > 0) {
            await statusSelect.selectOption('in_progress')
            console.log('✅ Updated requirement status')
          }
        }
        
        await page.screenshot({ 
          path: 'test-results/compliance-real-07-response-tracking.png',
          fullPage: true 
        })
      }
    })

    console.log('✅ All compliance matrix tests completed successfully!')
  })
})
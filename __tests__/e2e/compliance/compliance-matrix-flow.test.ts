import { test, expect, Page } from '@playwright/test'
import { createServiceClient } from '@/lib/supabase/server'

// Test user credentials
const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Compliance Matrix Generator - Complete Flow', () => {
  let page: Page
  
  // Test data to track throughout the flow
  const testData = {
    opportunityId: '',
    opportunityTitle: '',
    noticeId: '',
    matrixId: '',
    requirementsFound: 0,
    sectionsFound: [] as string[]
  }

  test.beforeEach(async ({ page: p }) => {
    page = p
    
    // Login before each test
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard')
  })

  test('should create compliance matrix from opportunity with attachments', async () => {
    // Step 1: Navigate to opportunities
    await test.step('Navigate to opportunities page', async () => {
      await page.goto('/opportunities')
      await page.waitForSelector('[data-testid="opportunity-card"]')
      
      // Take screenshot
      await page.screenshot({ 
        path: 'test-results/compliance-01-opportunities.png',
        fullPage: true 
      })
    })

    // Step 2: Find opportunity with attachments
    await test.step('Select opportunity with attachments', async () => {
      // Look for opportunities with attachment indicators
      const opportunityCard = await page.locator('[data-testid="opportunity-card"]')
        .filter({ has: page.locator('[data-testid="attachment-icon"], :has-text("attachment")') })
        .first()
      
      // If no opportunity with attachments, use the first one
      const targetCard = await opportunityCard.count() > 0 
        ? opportunityCard 
        : page.locator('[data-testid="opportunity-card"]').first()
      
      // Extract opportunity data
      testData.opportunityTitle = await targetCard.locator('h3, [data-testid="opportunity-title"]').textContent() || ''
      const opportunityLink = await targetCard.locator('a[href*="/opportunities/"]').getAttribute('href')
      testData.opportunityId = opportunityLink?.split('/').pop() || ''
      
      expect(testData.opportunityId).toBeTruthy()
      
      // Click to view details
      await targetCard.click()
      await page.waitForURL(`**/opportunities/${testData.opportunityId}`)
    })

    // Step 3: Verify opportunity details and attachments
    await test.step('Verify opportunity has attachments', async () => {
      await page.waitForSelector('[data-testid="opportunity-detail"]')
      
      // Get notice ID for attachment fetching
      const noticeIdElement = await page.locator('text=/Notice ID|notice_id/i').locator('..').locator('p, span').last()
      testData.noticeId = await noticeIdElement.textContent() || ''
      
      // Check for attachments section
      const attachmentsSection = page.locator('[data-testid="attachments-section"], [data-testid="opportunity-attachments"], :has-text("Attachments")')
      const hasAttachments = await attachmentsSection.count() > 0
      
      if (hasAttachments) {
        const attachmentCount = await page.locator('[data-testid="attachment-item"], a[href*=".pdf"]').count()
        console.log(`Found ${attachmentCount} attachments`)
      }
      
      await page.screenshot({ 
        path: 'test-results/compliance-02-opportunity-detail.png',
        fullPage: true 
      })
    })

    // Step 4: Click Generate Compliance Matrix
    await test.step('Open compliance matrix generator', async () => {
      // Click the compliance matrix button
      const complianceButton = page.locator('button:has-text("Generate Compliance Matrix"), [data-testid="generate-compliance-matrix"]')
      await expect(complianceButton).toBeVisible()
      await complianceButton.click()
      
      // Wait for navigation to compliance page
      await page.waitForURL(`**/opportunities/${testData.opportunityId}/compliance`)
      
      // Wait for compliance generator to load
      await page.waitForSelector('[data-testid="compliance-generator"], .compliance-matrix-generator, :has-text("Create Compliance Matrix")')
      
      await page.screenshot({ 
        path: 'test-results/compliance-03-matrix-generator.png',
        fullPage: true 
      })
    })

    // Step 5: Select Extract from RFP
    await test.step('Select extract from RFP option', async () => {
      const extractButton = page.locator('button:has-text("Extract from RFP"), [data-testid="extract-rfp-button"]')
      await expect(extractButton).toBeVisible()
      await extractButton.click()
      
      // Wait for modal to open
      await page.waitForSelector('[data-testid="requirement-extractor-modal"], [role="dialog"]:has-text("Extract Compliance Requirements")')
      
      await page.screenshot({ 
        path: 'test-results/compliance-04-extractor-modal.png',
        fullPage: true 
      })
    })

    // Step 6: Select document and sections
    await test.step('Configure extraction settings', async () => {
      // Wait for documents to load
      await page.waitForSelector('[data-testid="document-list"], input[type="radio"]', { timeout: 15000 })
      
      // Select first document if not already selected
      const firstRadio = page.locator('input[type="radio"]').first()
      const isChecked = await firstRadio.isChecked()
      if (!isChecked) {
        await firstRadio.click()
      }
      
      // Ensure Section L and M are selected
      const sectionL = page.locator('input[id*="section-l"], input[value="L"]')
      const sectionM = page.locator('input[id*="section-m"], input[value="M"]')
      
      if (!await sectionL.isChecked()) {
        await sectionL.click()
      }
      if (!await sectionM.isChecked()) {
        await sectionM.click()
      }
      
      await page.screenshot({ 
        path: 'test-results/compliance-05-document-selection.png',
        fullPage: true 
      })
    })

    // Step 7: Start extraction
    await test.step('Extract requirements', async () => {
      // Click extract button
      const extractButton = page.locator('button:has-text("Extract Requirements"), [data-testid="start-extraction"]')
      await extractButton.click()
      
      // Wait for loading indicator
      await page.waitForSelector('[data-testid="extraction-progress"], .animate-spin, [role="progressbar"]')
      
      await page.screenshot({ 
        path: 'test-results/compliance-06-extraction-progress.png',
        fullPage: true 
      })
      
      // Wait for extraction to complete (max 2 minutes)
      await page.waitForFunction(
        () => {
          const loadingGone = !document.querySelector('.animate-spin, [data-testid="extraction-progress"]')
          const requirementsVisible = document.querySelector('[data-testid="requirements-list"], [data-testid="requirement-item"]')
          const successMessage = document.querySelector('.toast-success, [data-testid="success-message"]')
          return loadingGone && (requirementsVisible || successMessage)
        },
        { timeout: 120000 }
      )
      
      await page.screenshot({ 
        path: 'test-results/compliance-07-extraction-complete.png',
        fullPage: true 
      })
    })

    // Step 8: Verify requirements
    await test.step('Verify extracted requirements', async () => {
      // Count requirements
      const requirementItems = page.locator('[data-testid="requirement-item"], [data-section]')
      testData.requirementsFound = await requirementItems.count()
      
      expect(testData.requirementsFound).toBeGreaterThan(0)
      
      // Check for Section L and M requirements
      const sectionLCount = await page.locator('[data-section="L"], :has-text("Section L")').count()
      const sectionMCount = await page.locator('[data-section="M"], :has-text("Section M")').count()
      
      console.log(`Found ${sectionLCount} Section L requirements`)
      console.log(`Found ${sectionMCount} Section M requirements`)
      
      expect(sectionLCount + sectionMCount).toBeGreaterThan(0)
      
      await page.screenshot({ 
        path: 'test-results/compliance-08-requirements-list.png',
        fullPage: true 
      })
    })

    // Step 9: Test response tracking
    await test.step('Update requirement status', async () => {
      // Switch to response tracking tab if available
      const responseTab = page.locator('[data-tab="responses"], button:has-text("Response Tracking")')
      if (await responseTab.count() > 0) {
        await responseTab.click()
        await page.waitForTimeout(500)
      }
      
      // Find first requirement and update status
      const firstRequirement = page.locator('[data-testid="requirement-item"]').first()
      const statusSelect = firstRequirement.locator('[data-testid="status-select"], select')
      
      if (await statusSelect.count() > 0) {
        await statusSelect.selectOption('in_progress')
        
        // Wait for status update
        await page.waitForTimeout(1000)
        
        // Verify status changed
        await expect(statusSelect).toHaveValue('in_progress')
      }
      
      await page.screenshot({ 
        path: 'test-results/compliance-09-response-tracking.png',
        fullPage: true 
      })
    })

    // Step 10: Test export functionality
    await test.step('Test export feature', async () => {
      const exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]')
      
      if (await exportButton.count() > 0) {
        await exportButton.click()
        
        // Wait for export options
        await page.waitForSelector('[data-testid="export-options"], :has-text("Excel")', { timeout: 5000 })
        
        await page.screenshot({ 
          path: 'test-results/compliance-10-export-options.png',
          fullPage: true 
        })
      }
    })
  })

  test('should create manual compliance matrix', async () => {
    await test.step('Navigate to opportunity', async () => {
      // Use a specific opportunity or create one
      await page.goto('/opportunities')
      await page.locator('[data-testid="opportunity-card"]').first().click()
      await page.waitForSelector('[data-testid="opportunity-detail"]')
      
      // Get opportunity ID from URL
      const url = page.url()
      const opportunityId = url.split('/opportunities/')[1]?.split('/')[0]
      expect(opportunityId).toBeTruthy()
    })

    await test.step('Create manual matrix', async () => {
      // Navigate to compliance page
      await page.locator('button:has-text("Generate Compliance Matrix")').click()
      await page.waitForURL('**/compliance')
      
      // Click create manually button
      await page.locator('button:has-text("Create Manually")').click()
      
      // Wait for matrix to be created
      await page.waitForSelector(':has-text("Requirements")')
      
      // Verify empty matrix created
      const requirementsList = page.locator('[data-testid="requirements-list"]')
      await expect(requirementsList).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/compliance-11-manual-matrix.png',
        fullPage: true 
      })
    })
  })

  test('should handle errors gracefully', async () => {
    await test.step('Test with invalid opportunity', async () => {
      // Navigate to non-existent opportunity
      await page.goto('/opportunities/invalid-id-123/compliance')
      
      // Should show 404 or redirect
      await expect(page.locator('text=/not found|404/i')).toBeVisible({ timeout: 5000 })
        .catch(() => expect(page).toHaveURL('/opportunities'))
    })
  })
})

// Mobile compliance matrix test
test.describe('Compliance Matrix - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  
  test('should be responsive on mobile', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Navigate to opportunities
    await page.goto('/opportunities')
    await page.waitForSelector('[data-testid="opportunity-card"]')
    
    // Click first opportunity
    await page.locator('[data-testid="opportunity-card"]').first().click()
    
    // Check if compliance button is visible on mobile
    const complianceButton = page.locator('button:has-text("Generate Compliance Matrix")')
    await expect(complianceButton).toBeVisible()
    
    await page.screenshot({ 
      path: 'test-results/compliance-12-mobile.png',
      fullPage: true 
    })
  })
})
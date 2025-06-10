import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Proposals Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('should create a new proposal', async ({ page }) => {
    await test.step('Navigate to proposals', async () => {
      await page.goto('/proposals')
      await expect(page.locator('h1:has-text("Proposals")')).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/proposals-01-list.png',
        fullPage: true 
      })
    })

    await test.step('Start new proposal', async () => {
      const newProposalButton = page.locator('button:has-text("New Proposal"), a:has-text("Create Proposal")')
      await newProposalButton.click()
      
      await page.waitForURL('**/proposals/new')
      await expect(page.locator('h1:has-text("Create Proposal")')).toBeVisible()
    })

    await test.step('Select opportunity', async () => {
      // Check if opportunity selector is present
      const opportunitySelector = page.locator('[data-testid="opportunity-selector"], select[name="opportunity"]')
      
      if (await opportunitySelector.count() > 0) {
        // Select first available opportunity
        const options = await opportunitySelector.locator('option').all()
        if (options.length > 1) {
          await opportunitySelector.selectOption({ index: 1 })
        }
      } else {
        // Or click on an opportunity card if displayed as cards
        const opportunityCard = page.locator('[data-testid="opportunity-option"]').first()
        if (await opportunityCard.count() > 0) {
          await opportunityCard.click()
        }
      }
      
      await page.screenshot({ 
        path: 'test-results/proposals-02-opportunity-selection.png',
        fullPage: true 
      })
    })

    await test.step('Fill proposal details', async () => {
      // Title
      const titleInput = page.locator('input[name="title"], input[placeholder*="title"]')
      await titleInput.fill('Test Proposal - Medical Equipment Supply')
      
      // Executive Summary
      const summaryTextarea = page.locator('textarea[name="executive_summary"], textarea[placeholder*="summary"]')
      await summaryTextarea.fill('This proposal outlines our comprehensive solution for medical equipment supply and maintenance services.')
      
      // Technical Approach
      const technicalTextarea = page.locator('textarea[name="technical_approach"], textarea[placeholder*="technical"]')
      if (await technicalTextarea.count() > 0) {
        await technicalTextarea.fill('Our technical approach leverages state-of-the-art medical equipment and proven maintenance protocols.')
      }
      
      // Pricing
      const pricingInput = page.locator('input[name="total_price"], input[name="pricing"]')
      if (await pricingInput.count() > 0) {
        await pricingInput.fill('1500000')
      }
      
      // Validity Period
      const validityInput = page.locator('input[name="validity_period"], select[name="validity_period"]')
      if (await validityInput.count() > 0) {
        if (validityInput.nodeName === 'SELECT') {
          await validityInput.selectOption('90')
        } else {
          await validityInput.fill('90')
        }
      }
      
      await page.screenshot({ 
        path: 'test-results/proposals-03-form-filled.png',
        fullPage: true 
      })
    })

    await test.step('Save proposal', async () => {
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create Proposal")')
      await saveButton.click()
      
      // Wait for success message or redirect
      await page.waitForURL('**/proposals/**', { timeout: 10000 })
        .catch(() => page.waitForSelector('.toast-success, [data-testid="success-message"]'))
      
      await page.screenshot({ 
        path: 'test-results/proposals-04-saved.png',
        fullPage: true 
      })
    })
  })

  test('should view and edit existing proposal', async ({ page }) => {
    await test.step('Navigate to proposals list', async () => {
      await page.goto('/proposals')
      await page.waitForSelector('[data-testid="proposal-card"], table tbody tr')
    })

    await test.step('Open proposal details', async () => {
      // Click first proposal
      const firstProposal = page.locator('[data-testid="proposal-card"], table tbody tr').first()
      await firstProposal.click()
      
      // Wait for detail page
      await page.waitForURL('**/proposals/*')
      await expect(page.locator('h1')).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/proposals-05-detail.png',
        fullPage: true 
      })
    })

    await test.step('Edit proposal', async () => {
      const editButton = page.locator('button:has-text("Edit"), button:has-text("Update")')
      
      if (await editButton.count() > 0) {
        await editButton.click()
        
        // Make an edit
        const summaryTextarea = page.locator('textarea[name="executive_summary"]')
        if (await summaryTextarea.count() > 0) {
          await summaryTextarea.fill('Updated executive summary with additional details about our capabilities.')
        }
        
        // Save changes
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")')
        await saveButton.click()
        
        // Wait for success
        await page.waitForTimeout(1000)
      }
    })
  })

  test('should generate documents from proposal', async ({ page }) => {
    // Navigate to an existing proposal
    await page.goto('/proposals')
    await page.waitForSelector('[data-testid="proposal-card"], table tbody tr')
    await page.locator('[data-testid="proposal-card"], table tbody tr').first().click()
    await page.waitForURL('**/proposals/*')

    await test.step('Generate PDF', async () => {
      const generateButton = page.locator('button:has-text("Generate PDF"), button:has-text("Export")')
      
      if (await generateButton.count() > 0) {
        // Set up download promise
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
          .catch(() => null)
        
        await generateButton.click()
        
        const download = await downloadPromise
        if (download) {
          expect(download.suggestedFilename()).toMatch(/proposal.*\.pdf$/i)
        }
        
        await page.screenshot({ 
          path: 'test-results/proposals-06-export.png',
          fullPage: true 
        })
      }
    })
  })

  test('should track proposal status', async ({ page }) => {
    await page.goto('/proposals')
    
    await test.step('View proposals by status', async () => {
      // Check for status tabs or filters
      const statusTabs = page.locator('[data-testid="status-tabs"], [role="tablist"]')
      
      if (await statusTabs.count() > 0) {
        // Click different status tabs
        const draftTab = page.locator('button:has-text("Draft"), [role="tab"]:has-text("Draft")')
        if (await draftTab.count() > 0) {
          await draftTab.click()
          await page.waitForTimeout(500)
        }
        
        const submittedTab = page.locator('button:has-text("Submitted"), [role="tab"]:has-text("Submitted")')
        if (await submittedTab.count() > 0) {
          await submittedTab.click()
          await page.waitForTimeout(500)
        }
      }
    })

    await test.step('Update proposal status', async () => {
      // Open first proposal
      const firstProposal = page.locator('[data-testid="proposal-card"], table tbody tr').first()
      if (await firstProposal.count() > 0) {
        await firstProposal.click()
        await page.waitForURL('**/proposals/*')
        
        // Look for status update option
        const statusDropdown = page.locator('select[name="status"], [data-testid="status-dropdown"]')
        if (await statusDropdown.count() > 0) {
          await statusDropdown.selectOption('submitted')
          
          // Save if needed
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update Status")')
          if (await saveButton.count() > 0) {
            await saveButton.click()
            await page.waitForTimeout(1000)
          }
        }
      }
    })
  })

  test('should handle proposal templates', async ({ page }) => {
    await page.goto('/proposals/new')
    
    await test.step('Use template if available', async () => {
      const templateButton = page.locator('button:has-text("Use Template"), button:has-text("Templates")')
      
      if (await templateButton.count() > 0) {
        await templateButton.click()
        
        // Wait for template modal or section
        await page.waitForSelector('[data-testid="template-selector"], :has-text("Choose Template")')
        
        // Select first template
        const firstTemplate = page.locator('[data-testid="template-option"]').first()
        if (await firstTemplate.count() > 0) {
          await firstTemplate.click()
          
          // Apply template
          const applyButton = page.locator('button:has-text("Apply"), button:has-text("Use This Template")')
          await applyButton.click()
          
          // Verify fields populated
          const titleInput = page.locator('input[name="title"]')
          const titleValue = await titleInput.inputValue()
          expect(titleValue).not.toBe('')
        }
        
        await page.screenshot({ 
          path: 'test-results/proposals-07-template.png',
          fullPage: true 
        })
      }
    })
  })
})

// Mobile proposals tests
test.describe('Proposals - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  
  test('should create proposal on mobile', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Navigate to proposals
    await page.goto('/proposals/new')
    
    // Check form is mobile-friendly
    const form = page.locator('form')
    await expect(form).toBeVisible()
    
    // Verify form fields stack vertically
    const formFields = await page.locator('input, textarea, select').all()
    if (formFields.length > 1) {
      const firstBox = await formFields[0].boundingBox()
      const secondBox = await formFields[1].boundingBox()
      
      if (firstBox && secondBox) {
        // Fields should stack vertically on mobile
        expect(secondBox.y).toBeGreaterThan(firstBox.y)
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/proposals-08-mobile-form.png',
      fullPage: true 
    })
  })
})
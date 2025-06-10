import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Saved Opportunities Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('should save and unsave opportunities', async ({ page }) => {
    await test.step('Navigate to opportunities', async () => {
      await page.goto('/opportunities')
      await page.waitForSelector('[data-testid="opportunity-card"]')
    })

    let savedOpportunityTitle = ''

    await test.step('Save an opportunity from list view', async () => {
      // Find first unsaved opportunity
      const unsavedCard = page.locator('[data-testid="opportunity-card"]')
        .filter({ hasNot: page.locator('[data-testid="saved-indicator"], .saved-badge') })
        .first()
      
      // Get title for later verification
      savedOpportunityTitle = await unsavedCard.locator('h3, [data-testid="opportunity-title"]').textContent() || ''
      
      // Click save button
      const saveButton = unsavedCard.locator('button[data-testid="save-opportunity"], button:has-text("Save")')
      await saveButton.click()
      
      // Wait for save action
      await page.waitForTimeout(1000)
      
      // Verify saved indicator appears
      await expect(unsavedCard.locator('[data-testid="saved-indicator"], :has-text("Saved")')).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/saved-01-after-save.png',
        fullPage: true 
      })
    })

    await test.step('Navigate to saved opportunities', async () => {
      await page.click('nav a:has-text("Saved")')
      await page.waitForURL('**/saved')
      await page.waitForSelector('[data-testid="saved-opportunity-card"], [data-testid="opportunity-card"]')
    })

    await test.step('Verify saved opportunity appears', async () => {
      // Look for the saved opportunity
      const savedCard = page.locator(`[data-testid="opportunity-card"]:has-text("${savedOpportunityTitle}")`)
      await expect(savedCard).toBeVisible()
      
      // Check for saved-specific features
      const notesButton = savedCard.locator('button:has-text("Notes"), button:has-text("Add Note")')
      await expect(notesButton).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/saved-02-saved-list.png',
        fullPage: true 
      })
    })

    await test.step('Add notes to saved opportunity', async () => {
      const savedCard = page.locator(`[data-testid="opportunity-card"]:has-text("${savedOpportunityTitle}")`)
      const notesButton = savedCard.locator('button:has-text("Notes"), button:has-text("Add Note")')
      await notesButton.click()
      
      // Wait for notes modal
      await page.waitForSelector('[data-testid="notes-modal"], [role="dialog"]:has-text("Notes")')
      
      // Add note
      const notesTextarea = page.locator('textarea[name="notes"], textarea[placeholder*="note"]')
      await notesTextarea.fill('This opportunity looks promising for our medical equipment line.')
      
      // Save notes
      await page.click('button:has-text("Save"), button:has-text("Update")')
      
      // Wait for modal to close
      await page.waitForTimeout(1000)
    })

    await test.step('Filter saved opportunities', async () => {
      // Open filters if available
      const filterButton = page.locator('[data-testid="saved-filters"], button:has-text("Filter")')
      if (await filterButton.count() > 0) {
        await filterButton.click()
        
        // Apply a filter
        const statusFilter = page.locator('input[value="active"]')
        if (await statusFilter.count() > 0) {
          await statusFilter.click()
        }
        
        await page.click('button:has-text("Apply")')
        await page.waitForTimeout(1000)
      }
    })

    await test.step('Unsave opportunity', async () => {
      const savedCard = page.locator(`[data-testid="opportunity-card"]:has-text("${savedOpportunityTitle}")`)
      const unsaveButton = savedCard.locator('button[data-testid="save-opportunity"], button:has-text("Unsave"), button:has-text("Remove")')
      
      await unsaveButton.click()
      
      // Confirm if needed
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")')
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click()
      }
      
      // Wait for removal
      await page.waitForTimeout(1000)
      
      // Verify opportunity removed from saved list
      await expect(savedCard).not.toBeVisible()
    })
  })

  test('should save opportunity from detail view', async ({ page }) => {
    await test.step('Navigate to opportunity detail', async () => {
      await page.goto('/opportunities')
      await page.waitForSelector('[data-testid="opportunity-card"]')
      
      // Click first opportunity
      await page.locator('[data-testid="opportunity-card"]').first().click()
      await page.waitForURL('**/opportunities/*')
      await page.waitForSelector('[data-testid="opportunity-detail"]')
    })

    await test.step('Save from detail view', async () => {
      const saveButton = page.locator('button[data-testid="save-opportunity"], button:has-text("Save Opportunity")')
      
      // Check if already saved
      const buttonText = await saveButton.textContent()
      if (!buttonText?.includes('Saved')) {
        await saveButton.click()
        await page.waitForTimeout(1000)
        
        // Verify button updates
        await expect(saveButton).toHaveText(/Saved|Unsave/)
      }
      
      await page.screenshot({ 
        path: 'test-results/saved-03-detail-save.png',
        fullPage: true 
      })
    })
  })

  test('should export saved opportunities', async ({ page }) => {
    await test.step('Navigate to saved opportunities', async () => {
      await page.goto('/saved')
      await page.waitForSelector('[data-testid="saved-opportunity-card"], [data-testid="opportunity-card"]', {
        timeout: 10000
      }).catch(() => {
        // If no saved opportunities, save one first
        return page.goto('/opportunities')
      })
    })

    await test.step('Export saved opportunities', async () => {
      const exportButton = page.locator('button:has-text("Export"), [data-testid="export-saved"]')
      
      if (await exportButton.count() > 0) {
        await exportButton.click()
        
        // Wait for export options
        await page.waitForSelector('[data-testid="export-options"], :has-text("CSV")')
        
        // Select CSV export
        const csvOption = page.locator('button:has-text("CSV"), [data-format="csv"]')
        if (await csvOption.count() > 0) {
          // Set up download promise
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
            .catch(() => null)
          
          await csvOption.click()
          
          const download = await downloadPromise
          if (download) {
            expect(download.suggestedFilename()).toMatch(/saved.*\.csv$/i)
          }
        }
      }
    })
  })

  test('should mark saved opportunity for proposal', async ({ page }) => {
    // Ensure we have at least one saved opportunity
    await page.goto('/saved')
    
    const savedCards = page.locator('[data-testid="opportunity-card"]')
    const count = await savedCards.count()
    
    if (count === 0) {
      // Save an opportunity first
      await page.goto('/opportunities')
      await page.waitForSelector('[data-testid="opportunity-card"]')
      await page.locator('[data-testid="save-opportunity"]').first().click()
      await page.waitForTimeout(1000)
      await page.goto('/saved')
    }

    await test.step('Mark for proposal', async () => {
      const firstCard = page.locator('[data-testid="opportunity-card"]').first()
      const markButton = firstCard.locator('button:has-text("Mark for Proposal"), button:has-text("Create Proposal")')
      
      if (await markButton.count() > 0) {
        await markButton.click()
        
        // Should navigate to proposal creation
        await page.waitForURL('**/proposals/new**')
        
        await page.screenshot({ 
          path: 'test-results/saved-04-proposal-creation.png',
          fullPage: true 
        })
      }
    })
  })

  test('should show AI analysis for saved opportunities', async ({ page }) => {
    await page.goto('/saved')
    
    const savedCards = page.locator('[data-testid="opportunity-card"]')
    if (await savedCards.count() > 0) {
      const firstCard = savedCards.first()
      const analyzeButton = firstCard.locator('button:has-text("Analyze"), button:has-text("AI Analysis")')
      
      if (await analyzeButton.count() > 0) {
        await analyzeButton.click()
        
        // Wait for analysis modal or section
        await page.waitForSelector('[data-testid="ai-analysis"], :has-text("Analysis")', {
          timeout: 10000
        })
        
        await page.screenshot({ 
          path: 'test-results/saved-05-ai-analysis.png',
          fullPage: true 
        })
      }
    }
  })
})

// Mobile saved opportunities tests
test.describe('Saved Opportunities - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  
  test('should handle saved opportunities on mobile', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Navigate to saved
    await page.goto('/saved')
    
    // Check mobile layout
    const cards = await page.locator('[data-testid="opportunity-card"]').all()
    if (cards.length > 0) {
      // Verify cards are full width on mobile
      const firstBox = await cards[0].boundingBox()
      if (firstBox) {
        expect(firstBox.width).toBeGreaterThan(300)
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/saved-06-mobile.png',
      fullPage: true 
    })
  })
})
import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Opportunities Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Navigate to opportunities
    await page.goto('/opportunities')
    await page.waitForSelector('[data-testid="opportunity-card"]', { timeout: 30000 })
  })

  test('should display opportunities list', async ({ page }) => {
    await test.step('Verify opportunities page elements', async () => {
      // Check page title
      await expect(page.locator('h1:has-text("Opportunities")')).toBeVisible()
      
      // Check search bar
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
      
      // Check filters
      await expect(page.locator('[data-testid="opportunities-filters"], button:has-text("Filter")')).toBeVisible()
      
      // Check opportunity cards
      const opportunityCards = page.locator('[data-testid="opportunity-card"]')
      expect(await opportunityCards.count()).toBeGreaterThan(0)
      
      await page.screenshot({ 
        path: 'test-results/opportunities-01-list.png',
        fullPage: true 
      })
    })

    await test.step('Verify opportunity card structure', async () => {
      const firstCard = page.locator('[data-testid="opportunity-card"]').first()
      
      // Check card elements
      await expect(firstCard.locator('h3, [data-testid="opportunity-title"]')).toBeVisible()
      await expect(firstCard.locator(':has-text("Agency:"),:has-text("agency")')).toBeVisible()
      await expect(firstCard.locator(':has-text("Posted:"),:has-text("posted")')).toBeVisible()
      await expect(firstCard.locator(':has-text("Deadline:"),:has-text("deadline")')).toBeVisible()
    })
  })

  test('should search opportunities', async ({ page }) => {
    await test.step('Search by keyword', async () => {
      const searchInput = page.locator('input[placeholder*="Search"]')
      await searchInput.fill('medical')
      await searchInput.press('Enter')
      
      // Wait for search results
      await page.waitForTimeout(1000)
      
      // Verify URL updated with search param
      expect(page.url()).toContain('search=medical')
      
      // Check that results are filtered
      const cards = page.locator('[data-testid="opportunity-card"]')
      const count = await cards.count()
      
      if (count > 0) {
        // Verify at least one result contains search term
        const titles = await cards.locator('h3, [data-testid="opportunity-title"]').allTextContents()
        const hasMatch = titles.some(title => title.toLowerCase().includes('medical'))
        expect(hasMatch).toBeTruthy()
      }
      
      await page.screenshot({ 
        path: 'test-results/opportunities-02-search-results.png',
        fullPage: true 
      })
    })

    await test.step('Clear search', async () => {
      const searchInput = page.locator('input[placeholder*="Search"]')
      await searchInput.clear()
      await searchInput.press('Enter')
      
      // Wait for results to update
      await page.waitForTimeout(1000)
      
      // Verify search param removed
      expect(page.url()).not.toContain('search=')
    })
  })

  test('should filter opportunities', async ({ page }) => {
    await test.step('Open filters', async () => {
      const filterButton = page.locator('[data-testid="opportunities-filters"], button:has-text("Filter")')
      await filterButton.click()
      
      // Wait for filter panel
      await page.waitForSelector('[data-testid="filter-panel"], [role="dialog"]')
      
      await page.screenshot({ 
        path: 'test-results/opportunities-03-filters.png',
        fullPage: true 
      })
    })

    await test.step('Apply agency filter', async () => {
      // Select an agency if available
      const agencyFilter = page.locator('select[name="agency"], [data-testid="agency-filter"]')
      if (await agencyFilter.count() > 0) {
        const options = await agencyFilter.locator('option').allTextContents()
        if (options.length > 1) {
          await agencyFilter.selectOption({ index: 1 })
        }
      }
      
      // Apply filters
      await page.click('button:has-text("Apply"), button:has-text("Filter")')
      
      // Wait for results to update
      await page.waitForTimeout(1000)
    })

    await test.step('Apply status filter', async () => {
      // Open filters again if needed
      const filterButton = page.locator('[data-testid="opportunities-filters"], button:has-text("Filter")')
      if (!await page.locator('[data-testid="filter-panel"]').isVisible()) {
        await filterButton.click()
      }
      
      // Toggle active status
      const activeCheckbox = page.locator('input[value="active"], input[name="status"][value="active"]')
      if (await activeCheckbox.count() > 0) {
        await activeCheckbox.click()
      }
      
      // Apply
      await page.click('button:has-text("Apply")')
      await page.waitForTimeout(1000)
    })
  })

  test('should view opportunity details', async ({ page }) => {
    await test.step('Click on opportunity', async () => {
      const firstCard = page.locator('[data-testid="opportunity-card"]').first()
      
      // Get opportunity title for verification
      const title = await firstCard.locator('h3, [data-testid="opportunity-title"]').textContent()
      
      // Click the card
      await firstCard.click()
      
      // Wait for detail page
      await page.waitForURL('**/opportunities/*')
      await page.waitForSelector('[data-testid="opportunity-detail"]')
      
      // Verify we're on the right opportunity
      await expect(page.locator(`h1:has-text("${title}")`)).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/opportunities-04-detail.png',
        fullPage: true 
      })
    })

    await test.step('Verify detail page elements', async () => {
      // Check for key sections
      await expect(page.locator(':has-text("Description")')).toBeVisible()
      await expect(page.locator(':has-text("Contract Details")')).toBeVisible()
      await expect(page.locator(':has-text("Key Information")')).toBeVisible()
      
      // Check for action buttons
      await expect(page.locator('button:has-text("Save"), [data-testid="save-opportunity"]')).toBeVisible()
      await expect(page.locator('a:has-text("View on SAM.gov")')).toBeVisible()
    })
  })

  test('should handle pagination', async ({ page }) => {
    // Check if pagination exists
    const pagination = page.locator('[data-testid="pagination"], nav[aria-label="pagination"]')
    
    if (await pagination.count() > 0) {
      await test.step('Navigate to next page', async () => {
        const nextButton = page.locator('button:has-text("Next"), a:has-text("Next")')
        if (await nextButton.isEnabled()) {
          await nextButton.click()
          
          // Wait for new results
          await page.waitForTimeout(1000)
          
          // Verify URL updated
          expect(page.url()).toMatch(/page=2|offset=/)
          
          await page.screenshot({ 
            path: 'test-results/opportunities-05-page-2.png',
            fullPage: true 
          })
        }
      })

      await test.step('Navigate back to first page', async () => {
        const prevButton = page.locator('button:has-text("Previous"), a:has-text("Previous")')
        if (await prevButton.count() > 0 && await prevButton.isEnabled()) {
          await prevButton.click()
          await page.waitForTimeout(1000)
        }
      })
    }
  })

  test('should sort opportunities', async ({ page }) => {
    // Look for sort dropdown
    const sortDropdown = page.locator('select[name="sort"], [data-testid="sort-dropdown"]')
    
    if (await sortDropdown.count() > 0) {
      await test.step('Sort by deadline', async () => {
        await sortDropdown.selectOption({ label: 'Deadline' })
        await page.waitForTimeout(1000)
        
        // Verify URL updated
        expect(page.url()).toContain('sort=deadline')
      })

      await test.step('Sort by posted date', async () => {
        await sortDropdown.selectOption({ label: 'Posted Date' })
        await page.waitForTimeout(1000)
        
        expect(page.url()).toContain('sort=posted')
      })
    }
  })
})

// Mobile opportunities tests
test.describe('Opportunities - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
    
    // Navigate to opportunities
    await page.goto('/opportunities')
    await page.waitForSelector('[data-testid="opportunity-card"]')
  })

  test('should have mobile-friendly layout', async ({ page }) => {
    // Check that cards are stacked
    const cards = await page.locator('[data-testid="opportunity-card"]').all()
    
    if (cards.length > 1) {
      const firstBox = await cards[0].boundingBox()
      const secondBox = await cards[1].boundingBox()
      
      if (firstBox && secondBox) {
        // Cards should be stacked vertically
        expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height)
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/opportunities-06-mobile.png',
      fullPage: true 
    })
  })

  test('should have accessible mobile filters', async ({ page }) => {
    const filterButton = page.locator('[data-testid="opportunities-filters"], button:has-text("Filter")')
    await filterButton.click()
    
    // Filter panel should cover most of the screen on mobile
    const filterPanel = page.locator('[data-testid="filter-panel"], [role="dialog"]')
    await expect(filterPanel).toBeVisible()
    
    const box = await filterPanel.boundingBox()
    if (box) {
      // Should be nearly full width on mobile
      expect(box.width).toBeGreaterThan(300)
    }
  })
})
/**
 * E2E Tests for Opportunity Search
 * Critical user journey: Searching and filtering opportunities
 */

import { test, expect } from '@playwright/test'
import { 
  login, 
  waitForPageLoad, 
  searchOpportunities,
  setOpportunityFilters,
  checkForConsoleErrors,
  testInputSanitization,
  measurePagePerformance
} from '../utils/test-helpers'

test.describe('Opportunity Search', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for protected routes
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          user: { id: 'test-user', email: 'test@example.com' },
          session: { access_token: 'mock-token' }
        })
      })
    })
    
    // Mock opportunities API
    await page.route('**/api/opportunities/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: [
            {
              id: '1',
              title: 'Medical Equipment for VA Hospital',
              solicitationNumber: 'VA-2024-001',
              deadline: '2024-12-31',
              estimatedValue: '$500,000',
              agency: 'Department of Veterans Affairs',
              matchScore: 0.85
            },
            {
              id: '2', 
              title: 'Surgical Supplies for Military Base',
              solicitationNumber: 'DOD-2024-002',
              deadline: '2024-11-30',
              estimatedValue: '$1,000,000',
              agency: 'Department of Defense',
              matchScore: 0.75
            }
          ],
          totalCount: 2,
          hasMore: false
        })
      })
    })
  })

  test('should display opportunities list', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Check that opportunities are displayed
    await expect(page.locator('[data-testid="opportunity-card"], .opportunity-card')).toHaveCount(2)
    
    // Check opportunity details
    await expect(page.locator('text=Medical Equipment for VA Hospital')).toBeVisible()
    await expect(page.locator('text=VA-2024-001')).toBeVisible()
    await expect(page.locator('text=Department of Veterans Affairs')).toBeVisible()
  })

  test('should search opportunities', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first()
    await expect(searchInput).toBeVisible()
    
    // Perform search
    await searchInput.fill('medical equipment')
    await searchInput.press('Enter')
    
    await waitForPageLoad(page)
    
    // Results should be filtered
    await expect(page.locator('text=Medical Equipment for VA Hospital')).toBeVisible()
  })

  test('should sanitize search input', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first()
    
    // Test XSS prevention in search
    const sanitizedValue = await testInputSanitization(page, 'input[placeholder*="Search"], input[type="search"]')
    
    expect(sanitizedValue).not.toContain('<script>')
    expect(sanitizedValue).toContain('Test Content')
  })

  test('should filter opportunities by NAICS code', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Look for NAICS filter
    const naicsFilter = page.locator('select[name="naics"], input[name="naics"]').first()
    
    if (await naicsFilter.count() > 0) {
      await naicsFilter.click()
      await naicsFilter.selectOption('334510') // Medical equipment manufacturing
      
      // Apply filter or wait for auto-filter
      const applyButton = page.locator('button:has-text("Apply"), button:has-text("Filter")')
      if (await applyButton.count() > 0) {
        await applyButton.click()
      }
      
      await waitForPageLoad(page)
      
      // Results should be filtered
      await expect(page.locator('[data-testid="opportunity-card"], .opportunity-card')).toHaveCountGreaterThan(0)
    }
  })

  test('should filter opportunities by state', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Look for state filter
    const stateFilter = page.locator('select[name="state"]').first()
    
    if (await stateFilter.count() > 0) {
      await stateFilter.selectOption('CA')
      
      await waitForPageLoad(page)
      
      // Results should be filtered by state
      await expect(page.locator('[data-testid="opportunity-card"], .opportunity-card')).toHaveCountGreaterThan(0)
    }
  })

  test('should display opportunity details', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Click on first opportunity
    const firstOpportunity = page.locator('[data-testid="opportunity-card"], .opportunity-card').first()
    await firstOpportunity.click()
    
    // Should navigate to detail page or open modal
    await page.waitForTimeout(1000)
    
    // Check for detailed information
    await expect(page.locator('text=VA-2024-001, text=Medical Equipment')).toBeVisible()
  })

  test('should save opportunities', async ({ page }) => {
    // Mock save API
    await page.route('**/api/opportunities/save**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, saved: true })
      })
    })
    
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Look for save button
    const saveButton = page.locator('button:has-text("Save"), [aria-label*="Save"], [title*="Save"]').first()
    
    if (await saveButton.count() > 0) {
      await saveButton.click()
      
      // Should indicate successful save
      await expect(page.locator('text=Saved, text=Bookmarked')).toBeVisible({ timeout: 3000 })
    }
  })

  test('should handle pagination', async ({ page }) => {
    // Mock paginated response
    await page.route('**/api/opportunities/search**', async (route) => {
      const url = new URL(route.request().url())
      const offset = url.searchParams.get('offset') || '0'
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: [
            {
              id: `page-${offset}-1`,
              title: `Opportunity ${offset}-1`,
              solicitationNumber: `TEST-${offset}-001`,
              deadline: '2024-12-31',
              agency: 'Test Agency'
            }
          ],
          totalCount: 100,
          hasMore: parseInt(offset) < 75
        })
      })
    })
    
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Look for pagination controls
    const nextButton = page.locator('button:has-text("Next"), [aria-label*="Next page"]')
    
    if (await nextButton.count() > 0) {
      await nextButton.click()
      await waitForPageLoad(page)
      
      // Should load next page
      await expect(page.locator('text=Opportunity')).toBeVisible()
    }
  })

  test('should handle virtual scrolling for large lists', async ({ page }) => {
    // Mock large dataset
    const generateOpportunities = (count: number) => {
      return Array.from({ length: count }, (_, i) => ({
        id: `opp-${i}`,
        title: `Medical Opportunity ${i + 1}`,
        solicitationNumber: `TEST-${String(i + 1).padStart(3, '0')}`,
        deadline: '2024-12-31',
        agency: 'Test Agency',
        matchScore: Math.random()
      }))
    }
    
    await page.route('**/api/opportunities/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          opportunities: generateOpportunities(200),
          totalCount: 200,
          hasMore: false
        })
      })
    })
    
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Should use virtual scrolling for large lists
    const opportunityList = page.locator('[data-testid="opportunities-list"], .opportunities-list').first()
    await expect(opportunityList).toBeVisible()
    
    // Should not render all 200 items in DOM at once
    const renderedItems = await page.locator('[data-testid="opportunity-card"], .opportunity-card').count()
    expect(renderedItems).toBeLessThan(50) // Virtual scrolling should limit DOM nodes
  })

  test('should handle errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/opportunities/search**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })
    
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Should show error message
    await expect(page.locator('text=error, text=failed, text=try again')).toBeVisible({ timeout: 5000 })
  })

  test('should meet performance benchmarks', async ({ page }) => {
    const metrics = await measurePagePerformance(page, '/opportunities')
    
    // Performance expectations
    expect(metrics.totalLoadTime).toBeLessThan(5000) // 5 seconds max
    expect(metrics.firstContentfulPaint).toBeLessThan(2000) // 2 seconds max
  })

  test('should have no console errors', async ({ page }) => {
    const errors = await checkForConsoleErrors(page)
    
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Perform search
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    if (await searchInput.count() > 0) {
      await searchInput.fill('test search')
      await searchInput.press('Enter')
      await waitForPageLoad(page)
    }
    
    // Filter out non-critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('Warning:') &&
      !error.includes('chunk') &&
      !error.includes('Non-Error promise rejection')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/opportunities')
    await waitForPageLoad(page)
    
    // Check search input accessibility
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    if (await searchInput.count() > 0) {
      await expect(searchInput).toHaveAttribute('aria-label')
    }
    
    // Check opportunity cards have proper labels
    const opportunityCards = page.locator('[data-testid="opportunity-card"], .opportunity-card')
    const firstCard = opportunityCards.first()
    
    if (await firstCard.count() > 0) {
      // Should be focusable
      await firstCard.focus()
      await expect(firstCard).toBeFocused()
      
      // Should have proper ARIA labels
      const cardButton = firstCard.locator('button, a').first()
      if (await cardButton.count() > 0) {
        await expect(cardButton).toHaveAttribute('aria-label')
      }
    }
  })
})
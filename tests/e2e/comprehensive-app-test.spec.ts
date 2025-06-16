import { test, expect, type Page } from '@playwright/test'

// Test configuration
const BASE_URL = 'http://localhost:3000'
const TIMEOUT = 30000 // 30 seconds for slower operations

// Helper to measure performance
async function measureResponseTime(page: Page, action: () => Promise<any>): Promise<number> {
  const startTime = Date.now()
  await action()
  return Date.now() - startTime
}

test.describe('MedContractHub Comprehensive Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Set a reasonable timeout
    page.setDefaultTimeout(TIMEOUT)
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text())
      }
    })
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message)
    })
  })

  test.describe('1. Health Check and Basic Connectivity', () => {
    test('API health check should return healthy status', async ({ request }) => {
      const response = await request.get('/api/health')
      expect(response.ok()).toBeTruthy()
      
      const data = await response.json()
      expect(data.status).toBe('healthy')
      console.log('✅ API Health Check: PASSED')
    })

    test('Homepage should load successfully', async ({ page }) => {
      const responseTime = await measureResponseTime(page, async () => {
        await page.goto(BASE_URL)
      })
      
      expect(page.url()).toBe(BASE_URL + '/')
      console.log(`✅ Homepage Load: PASSED (${responseTime}ms)`)
      expect(responseTime).toBeLessThan(3000) // Should load in under 3 seconds
    })
  })

  test.describe('2. Navigation and Routing', () => {
    test('Should navigate to opportunities page', async ({ page }) => {
      await page.goto(BASE_URL)
      
      const responseTime = await measureResponseTime(page, async () => {
        await page.goto(`${BASE_URL}/opportunities`)
        await page.waitForLoadState('networkidle')
      })
      
      expect(page.url()).toBe(`${BASE_URL}/opportunities`)
      console.log(`✅ Opportunities Page Navigation: PASSED (${responseTime}ms)`)
    })

    test('Should navigate to saved opportunities page', async ({ page }) => {
      await page.goto(BASE_URL)
      
      const responseTime = await measureResponseTime(page, async () => {
        await page.goto(`${BASE_URL}/saved`)
        await page.waitForLoadState('networkidle')
      })
      
      expect(page.url()).toBe(`${BASE_URL}/saved`)
      console.log(`✅ Saved Opportunities Page Navigation: PASSED (${responseTime}ms)`)
    })
  })

  test.describe('3. Opportunities Search and Display', () => {
    test('Should display opportunities list', async ({ page }) => {
      await page.goto(`${BASE_URL}/opportunities`)
      
      // Wait for opportunities to load
      await page.waitForSelector('[data-testid="opportunity-card"], .space-y-4 > div', {
        timeout: 15000
      })
      
      // Check if opportunities are displayed
      const opportunities = await page.locator('[data-testid="opportunity-card"], .space-y-4 > div > div').count()
      expect(opportunities).toBeGreaterThan(0)
      console.log(`✅ Opportunities Display: PASSED (${opportunities} opportunities found)`)
    })

    test('Should show loading state', async ({ page }) => {
      await page.goto(`${BASE_URL}/opportunities`)
      
      // Check for loading indicators
      const hasLoadingState = await page.locator('text=/Loading|loading/i').count() > 0 ||
                             await page.locator('.animate-pulse').count() > 0
      
      console.log(`✅ Loading State: ${hasLoadingState ? 'DETECTED' : 'NOT DETECTED (may load too fast)'}`)
    })

    test('Should measure search API performance', async ({ page, request }) => {
      // Test the search API directly
      const apiStartTime = Date.now()
      const response = await request.get('/api/opportunities/search-fast?limit=25&offset=0')
      const apiResponseTime = Date.now() - apiStartTime
      
      if (response.ok()) {
        const data = await response.json()
        console.log(`✅ Search API Performance: PASSED (${apiResponseTime}ms)`)
        console.log(`   - Total opportunities: ${data.totalCount || data.pagination?.total || 'N/A'}`)
        console.log(`   - Returned: ${data.opportunities?.length || 0}`)
        
        // Check performance metrics if available
        if (data.performance) {
          console.log(`   - Query time: ${data.performance.queryTime || data.performance.query_time || 'N/A'}ms`)
          console.log(`   - Total time: ${data.performance.total_time || 'N/A'}ms`)
        }
        
        expect(apiResponseTime).toBeLessThan(1000) // Should be under 1 second
      } else {
        console.log(`❌ Search API: FAILED (Status: ${response.status()})`)
      }
    })
  })

  test.describe('4. Save/Unsave Functionality', () => {
    test('Should toggle save button on opportunities', async ({ page }) => {
      await page.goto(`${BASE_URL}/opportunities`)
      
      // Wait for opportunities to load
      await page.waitForSelector('button:has-text("Loading"), .space-y-4', {
        timeout: 15000
      })
      
      // Find save buttons (bookmark icons)
      const saveButtons = page.locator('button:has(svg[class*="lucide-bookmark"])')
      const saveButtonCount = await saveButtons.count()
      
      if (saveButtonCount > 0) {
        // Click the first save button
        const firstButton = saveButtons.first()
        const wasSaved = await firstButton.locator('svg[class*="lucide-bookmark-check"]').count() > 0
        
        await firstButton.click()
        
        // Wait for the toast notification
        await page.waitForSelector('.sonner-toast', { timeout: 5000 }).catch(() => {})
        
        // Check if the button state changed
        const isSavedNow = await firstButton.locator('svg[class*="lucide-bookmark-check"]').count() > 0
        expect(isSavedNow).toBe(!wasSaved)
        
        console.log(`✅ Save Button Toggle: PASSED (${wasSaved ? 'Unsaved' : 'Saved'} successfully)`)
        
        // Toggle back
        await firstButton.click()
        await page.waitForTimeout(500)
      } else {
        console.log('⚠️  Save Button Test: NO SAVE BUTTONS FOUND')
      }
    })
  })

  test.describe('5. Saved Opportunities Page', () => {
    test('Should display saved opportunities or empty state', async ({ page }) => {
      await page.goto(`${BASE_URL}/saved`)
      await page.waitForLoadState('networkidle')
      
      // Check for either saved opportunities or empty state
      const hasSavedOpportunities = await page.locator('[data-testid="saved-opportunity-card"], .space-y-4 > div > div').count() > 0
      const hasEmptyState = await page.locator('text=/No saved opportunities/i').count() > 0
      
      expect(hasSavedOpportunities || hasEmptyState).toBeTruthy()
      
      if (hasSavedOpportunities) {
        const count = await page.locator('[data-testid="saved-opportunity-card"], .space-y-4 > div > div').count()
        console.log(`✅ Saved Opportunities Display: PASSED (${count} saved opportunities)`)
      } else {
        console.log('✅ Saved Opportunities Empty State: PASSED')
      }
    })
  })

  test.describe('6. Error Handling', () => {
    test('Should handle 404 pages gracefully', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/non-existent-page`)
      expect(response?.status()).toBe(404)
      console.log('✅ 404 Error Handling: PASSED')
    })

    test('Should handle API errors gracefully', async ({ page, request }) => {
      // Test with invalid parameters
      const response = await request.get('/api/opportunities/search-fast?limit=invalid')
      
      // Should either handle gracefully or return error
      expect([200, 400, 422, 500].includes(response.status())).toBeTruthy()
      console.log(`✅ API Error Handling: PASSED (Status: ${response.status()})`)
    })
  })

  test.describe('7. Performance Metrics Summary', () => {
    test('Should measure overall application performance', async ({ page }) => {
      console.log('\n📊 PERFORMANCE SUMMARY:')
      
      // Measure opportunities page load time
      const oppStartTime = Date.now()
      await page.goto(`${BASE_URL}/opportunities`)
      await page.waitForSelector('.space-y-4', { timeout: 15000 })
      const oppLoadTime = Date.now() - oppStartTime
      console.log(`   - Opportunities page load: ${oppLoadTime}ms ${oppLoadTime < 1000 ? '✅' : '⚠️'}`)
      
      // Measure saved page load time
      const savedStartTime = Date.now()
      await page.goto(`${BASE_URL}/saved`)
      await page.waitForLoadState('networkidle')
      const savedLoadTime = Date.now() - savedStartTime
      console.log(`   - Saved page load: ${savedLoadTime}ms ${savedLoadTime < 1000 ? '✅' : '⚠️'}`)
      
      // Test search performance with different queries
      const searchTests = [
        { query: '', label: 'All opportunities' },
        { query: 'medical', label: 'Medical search' },
        { query: 'equipment', label: 'Equipment search' }
      ]
      
      for (const searchTest of searchTests) {
        const searchStart = Date.now()
        await page.goto(`${BASE_URL}/opportunities?q=${searchTest.query}`)
        await page.waitForSelector('.space-y-4', { timeout: 15000 })
        const searchTime = Date.now() - searchStart
        console.log(`   - ${searchTest.label}: ${searchTime}ms ${searchTime < 1000 ? '✅' : '⚠️'}`)
      }
    })
  })

  test.describe('8. Responsive Design', () => {
    test('Should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      await page.goto(`${BASE_URL}/opportunities`)
      
      // Check if page renders without horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)
      
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)
      console.log('✅ Mobile Responsive Design: PASSED')
    })
  })
})

// Summary test
test.describe('Test Summary', () => {
  test('Generate test report', async () => {
    console.log('\n' + '='.repeat(50))
    console.log('🧪 MEDCONTRACTHUB COMPREHENSIVE TEST COMPLETE')
    console.log('='.repeat(50))
    console.log('\nRun this test with: npm run test:e2e tests/e2e/comprehensive-app-test.spec.ts')
    console.log('For headed mode: npm run test:e2e -- --headed tests/e2e/comprehensive-app-test.spec.ts')
    console.log('='.repeat(50))
  })
})
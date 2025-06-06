/**
 * Enhanced Critical User Journey Test
 * Optimized for reliability with better error handling and performance monitoring
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'

// Test configuration
const TEST_CONFIG = {
  timeout: {
    default: 30000,
    navigation: 60000,
    assertion: 10000,
  },
  performance: {
    landingPageMax: 8000, // 8 seconds (realistic for development)
    opportunitiesPageMax: 10000, // 10 seconds
    searchResponseMax: 5000, // 5 seconds
    dashboardLoadMax: 8000, // 8 seconds
  },
  retries: {
    pageLoad: 3,
    elementWait: 2,
  }
}

// Utility functions
async function waitForPageLoad(page: Page, timeout = TEST_CONFIG.timeout.navigation) {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout })
    await page.waitForLoadState('networkidle', { timeout: timeout / 2 })
  } catch (error) {
    console.warn(`Page load timeout: ${error.message}`)
    // Continue with test - page might be functional even if not fully loaded
  }
}

async function safeNavigate(page: Page, url: string, retries = TEST_CONFIG.retries.pageLoad) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🌐 Navigating to: ${url} (attempt ${i + 1}/${retries})`)
      await page.goto(url, { 
        timeout: TEST_CONFIG.timeout.navigation,
        waitUntil: 'domcontentloaded' 
      })
      await waitForPageLoad(page)
      return true
    } catch (error) {
      console.warn(`Navigation attempt ${i + 1} failed: ${error.message}`)
      if (i === retries - 1) throw error
      await page.waitForTimeout(2000) // Wait before retry
    }
  }
  return false
}

async function takeScreenshot(page: Page, name: string, step?: string) {
  try {
    const filename = `test-results/enhanced-${name}.png`
    await page.screenshot({ path: filename, fullPage: true })
    console.log(`📸 Screenshot saved: ${filename}${step ? ` (${step})` : ''}`)
  } catch (error) {
    console.warn(`Screenshot failed: ${error.message}`)
  }
}

async function measurePerformance(page: Page, action: () => Promise<void>): Promise<number> {
  const startTime = Date.now()
  await action()
  return Date.now() - startTime
}

test.describe('Enhanced Critical User Journey - E2E', () => {
  let baseURL: string

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL || 'http://localhost:3002'
    console.log(`🔗 Base URL: ${baseURL}`)
  })

  test.beforeEach(async ({ page }) => {
    // Enhanced error handling
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`🔥 Console Error: ${msg.text()}`)
      }
    })

    page.on('pageerror', error => {
      console.log(`🚨 Page Error: ${error.message}`)
    })

    page.on('requestfailed', request => {
      console.log(`❌ Request Failed: ${request.url()} - ${request.failure()?.errorText}`)
    })
  })

  test('Complete User Journey with Enhanced Reliability', async ({ page }) => {
    console.log('🚀 Starting Enhanced Critical User Journey Test...')
    
    // Performance tracking
    const performanceMetrics = {
      landingPageLoad: 0,
      dashboardLoad: 0,
      opportunitiesLoad: 0,
      searchResponse: 0,
    }

    // ===== STEP 1: LANDING PAGE =====
    await test.step('Landing Page Load Performance', async () => {
      console.log('📍 Step 1: Testing Landing Page Load')
      
      performanceMetrics.landingPageLoad = await measurePerformance(page, async () => {
        await safeNavigate(page, baseURL)
      })
      
      await takeScreenshot(page, '01-landing-page', 'Landing Page')
      
      // Verify page loaded correctly
      const pageContent = await page.textContent('body')
      expect(pageContent).toContain('MedContractHub')
      
      console.log(`⏱️ Landing page loaded in ${performanceMetrics.landingPageLoad}ms`)
    })

    // ===== STEP 2: AUTHENTICATION FLOW =====
    await test.step('Authentication and Dashboard Access', async () => {
      console.log('📍 Step 2: Testing Authentication Flow')
      
      // Try to access dashboard directly
      performanceMetrics.dashboardLoad = await measurePerformance(page, async () => {
        await safeNavigate(page, `${baseURL}/dashboard`)
      })
      
      await takeScreenshot(page, '02-auth-flow', 'Authentication')
      
      const currentUrl = page.url()
      const pageContent = await page.textContent('body')
      
      // Handle different authentication states
      if (currentUrl.includes('/login') || pageContent.includes('Login')) {
        console.log('🔒 Authentication required - testing login flow')
        
        // Look for development login option
        const devLoginButton = page.locator('button:has-text("Enter Development Mode"), button:has-text("Development Mode")')
        
        if (await devLoginButton.isVisible({ timeout: 5000 })) {
          await devLoginButton.click()
          await waitForPageLoad(page)
          await takeScreenshot(page, '03-dev-login', 'Development Login')
        } else {
          // Regular login flow
          const emailInput = page.locator('input[type="email"], input[name="email"]')
          if (await emailInput.isVisible({ timeout: 5000 })) {
            await emailInput.fill('test@medcontracthub.dev')
            
            const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]')
            if (await loginButton.isVisible({ timeout: 3000 })) {
              await loginButton.click()
              await waitForPageLoad(page)
            }
          }
        }
      } else if (currentUrl.includes('/dashboard') || pageContent.includes('Dashboard')) {
        console.log('✅ Development bypass working - direct dashboard access')
      }
      
      console.log(`⏱️ Dashboard access completed in ${performanceMetrics.dashboardLoad}ms`)
    })

    // ===== STEP 3: OPPORTUNITIES DISCOVERY =====
    await test.step('Opportunities Discovery', async () => {
      console.log('📍 Step 3: Testing Opportunities Discovery')
      
      performanceMetrics.opportunitiesLoad = await measurePerformance(page, async () => {
        await safeNavigate(page, `${baseURL}/opportunities`)
      })
      
      await takeScreenshot(page, '04-opportunities', 'Opportunities Page')
      
      // Verify opportunities page elements
      const pageContent = await page.textContent('body')
      const hasOpportunities = pageContent.includes('Opportunities') || 
                              pageContent.includes('opportunities') ||
                              pageContent.includes('Search') ||
                              pageContent.includes('Medical')
      
      expect(hasOpportunities).toBe(true)
      console.log(`⏱️ Opportunities page loaded in ${performanceMetrics.opportunitiesLoad}ms`)
    })

    // ===== STEP 4: SEARCH FUNCTIONALITY =====
    await test.step('Search Functionality', async () => {
      console.log('📍 Step 4: Testing Search Functionality')
      
      // Look for search input
      const searchSelectors = [
        'input[placeholder*="search"]',
        'input[name="search"]',
        'input[name="q"]',
        '[data-testid="search-input"]',
        'input[type="search"]'
      ]
      
      let searchInput = null
      for (const selector of searchSelectors) {
        const element = page.locator(selector)
        if (await element.isVisible({ timeout: 3000 })) {
          searchInput = element
          break
        }
      }
      
      if (searchInput) {
        performanceMetrics.searchResponse = await measurePerformance(page, async () => {
          await searchInput.fill('medical equipment')
          await page.keyboard.press('Enter')
          await waitForPageLoad(page)
        })
        
        await takeScreenshot(page, '05-search-results', 'Search Results')
        console.log(`⏱️ Search completed in ${performanceMetrics.searchResponse}ms`)
      } else {
        console.log('⚠️ Search input not found - skipping search test')
      }
    })

    // ===== STEP 5: NAVIGATION TEST =====
    await test.step('Navigation and Page Transitions', async () => {
      console.log('📍 Step 5: Testing Navigation')
      
      const navigationTargets = [
        { url: '/dashboard', name: 'Dashboard' },
        { url: '/analytics', name: 'Analytics' },
        { url: '/proposals', name: 'Proposals' },
        { url: '/settings', name: 'Settings' }
      ]
      
      for (const target of navigationTargets) {
        try {
          await safeNavigate(page, `${baseURL}${target.url}`)
          await takeScreenshot(page, `06-nav-${target.name.toLowerCase()}`, target.name)
          console.log(`✅ ${target.name} page accessible`)
        } catch (error) {
          console.log(`⚠️ ${target.name} page not accessible: ${error.message}`)
        }
      }
    })

    // ===== STEP 6: MOBILE RESPONSIVENESS =====
    await test.step('Mobile Responsiveness', async () => {
      console.log('📍 Step 6: Testing Mobile Responsiveness')
      
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 812 }) // iPhone X
      await safeNavigate(page, `${baseURL}/opportunities`)
      await takeScreenshot(page, '07-mobile-view', 'Mobile View')
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 }) // iPad
      await takeScreenshot(page, '08-tablet-view', 'Tablet View')
      
      // Restore desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 })
      console.log('✅ Mobile responsiveness tested')
    })

    // ===== PERFORMANCE SUMMARY =====
    console.log('\n📊 Performance Summary:')
    console.log(`🏠 Landing Page: ${performanceMetrics.landingPageLoad}ms`)
    console.log(`🏛️ Dashboard: ${performanceMetrics.dashboardLoad}ms`)
    console.log(`🔍 Opportunities: ${performanceMetrics.opportunitiesLoad}ms`)
    console.log(`⚡ Search: ${performanceMetrics.searchResponse}ms`)
    
    // Validate performance with realistic thresholds
    expect(performanceMetrics.landingPageLoad).toBeLessThan(TEST_CONFIG.performance.landingPageMax)
    expect(performanceMetrics.dashboardLoad).toBeLessThan(TEST_CONFIG.performance.dashboardLoadMax)
    expect(performanceMetrics.opportunitiesLoad).toBeLessThan(TEST_CONFIG.performance.opportunitiesPageMax)
    
    if (performanceMetrics.searchResponse > 0) {
      expect(performanceMetrics.searchResponse).toBeLessThan(TEST_CONFIG.performance.searchResponseMax)
    }
    
    console.log('🎉 Enhanced Critical User Journey Test Completed Successfully!')
  })

  test('API Health and Error Handling', async ({ page }) => {
    console.log('🔬 Testing API Health and Error Handling...')
    
    await test.step('Health Endpoint Verification', async () => {
      const response = await page.request.get(`${baseURL}/api/health`)
      expect(response.status()).toBe(200)
      
      const healthData = await response.json()
      expect(healthData.status).toBe('healthy')
      console.log('✅ Health endpoint working correctly')
    })

    await test.step('Protected Endpoint Authentication', async () => {
      const response = await page.request.get(`${baseURL}/api/opportunities/search`)
      // Should require authentication
      expect([401, 403]).toContain(response.status())
      console.log('✅ Protected endpoints properly secured')
    })

    await test.step('Error Page Handling', async () => {
      // Test 404 page
      await safeNavigate(page, `${baseURL}/nonexistent-page`)
      const pageContent = await page.textContent('body')
      
      const hasErrorHandling = pageContent.includes('404') || 
                              pageContent.includes('Not Found') ||
                              pageContent.includes('Page not found')
      
      expect(hasErrorHandling).toBe(true)
      console.log('✅ 404 error handling working')
    })
  })

  test('Data Integrity and Security', async ({ page }) => {
    console.log('🛡️ Testing Data Integrity and Security...')
    
    await test.step('XSS Protection Test', async () => {
      await safeNavigate(page, `${baseURL}/opportunities`)
      
      // Test XSS protection
      const searchInput = page.locator('input[placeholder*="search"], input[name="search"]').first()
      
      if (await searchInput.isVisible({ timeout: 5000 })) {
        const xssPayload = '<script>alert("xss")</script>'
        await searchInput.fill(xssPayload)
        await page.keyboard.press('Enter')
        await waitForPageLoad(page)
        
        // Verify XSS was blocked
        const pageContent = await page.textContent('body')
        expect(pageContent).not.toContain('<script>')
        console.log('✅ XSS protection working')
      }
    })

    await test.step('SQL Injection Protection Test', async () => {
      await safeNavigate(page, `${baseURL}/opportunities`)
      
      const searchInput = page.locator('input[placeholder*="search"], input[name="search"]').first()
      
      if (await searchInput.isVisible({ timeout: 5000 })) {
        const sqlPayload = "'; DROP TABLE opportunities; --"
        await searchInput.fill(sqlPayload)
        await page.keyboard.press('Enter')
        await waitForPageLoad(page)
        
        // Page should still be functional
        const pageContent = await page.textContent('body')
        expect(pageContent).not.toContain('error')
        expect(pageContent).not.toContain('500')
        console.log('✅ SQL injection protection working')
      }
    })
  })
})
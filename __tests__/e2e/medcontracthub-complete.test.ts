import { test, expect, Page } from '@playwright/test'

// Test configuration
const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

// Helper to wait for network idle
async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 })
}

// Helper to take screenshot with timestamp
async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({ 
    path: `test-results/${name}-${timestamp}.png`,
    fullPage: true 
  })
}

test.describe('MedContractHub - Complete Application Test', () => {
  // Configure test settings
  test.use({
    // Slow down actions for visibility when running headed
    actionTimeout: 20000,
    navigationTimeout: 30000,
    // Viewport size
    viewport: { width: 1280, height: 720 }
  })

  test.beforeEach(async ({ page }) => {
    // Set up request interception for debugging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('API Request:', request.method(), request.url())
      }
    })

    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        console.error('API Error:', response.status(), response.url())
      }
    })
  })

  test('Complete User Journey - Authentication to Proposal Creation', async ({ page }) => {
    // ========== LANDING PAGE ==========
    await test.step('1. Visit Landing Page', async () => {
      console.log('🏠 Navigating to landing page...')
      await page.goto('/')
      await waitForNetworkIdle(page)
      
      // Verify page loaded
      await expect(page).toHaveTitle(/MedContractHub/)
      
      // Check for key landing page elements
      const heroSection = page.locator('[class*="hero"], h1')
      await expect(heroSection.first()).toBeVisible()
      
      await takeScreenshot(page, '01-landing-page')
      
      // Check for login button
      const loginButton = page.locator('a[href="/login"], button:has-text("Sign In"), button:has-text("Login")')
      await expect(loginButton.first()).toBeVisible()
    })

    // ========== AUTHENTICATION ==========
    await test.step('2. Login Process', async () => {
      console.log('🔐 Starting login process...')
      
      // Navigate to login
      await page.goto('/login')
      await waitForNetworkIdle(page)
      
      // Verify login page
      const loginTitle = page.locator('h1:has-text("Sign In"), h2:has-text("Sign In"), h1:has-text("Login")')
      await expect(loginTitle.first()).toBeVisible()
      
      // Fill login form
      const emailInput = page.locator('input[name="email"], input[type="email"]')
      const passwordInput = page.locator('input[name="password"], input[type="password"]')
      
      await emailInput.fill(TEST_USER.email)
      await passwordInput.fill(TEST_USER.password)
      
      await takeScreenshot(page, '02-login-form-filled')
      
      // Submit login
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")')
      await submitButton.click()
      
      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 15000 })
      await waitForNetworkIdle(page)
      
      // Verify successful login
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
      console.log('✅ Login successful')
      
      await takeScreenshot(page, '03-dashboard-after-login')
    })

    // ========== DASHBOARD EXPLORATION ==========
    await test.step('3. Explore Dashboard', async () => {
      console.log('📊 Exploring dashboard features...')
      
      // Check main dashboard elements
      const statsCards = page.locator('[data-testid*="stat"], [class*="stat"], [class*="card"]')
      const cardCount = await statsCards.count()
      console.log(`Found ${cardCount} dashboard cards`)
      
      if (cardCount > 0) {
        await expect(statsCards.first()).toBeVisible()
      }
      
      // Check navigation menu
      const navMenu = page.locator('nav, [role="navigation"]')
      await expect(navMenu).toBeVisible()
      
      // Verify key navigation items
      const navItems = ['Dashboard', 'Opportunities', 'Saved', 'Proposals', 'Analytics']
      for (const item of navItems) {
        const navLink = page.locator(`nav >> text=${item}`)
        if (await navLink.count() > 0) {
          await expect(navLink.first()).toBeVisible()
        }
      }
      
      // Check for recent activity section
      const activitySection = page.locator(':has-text("Recent Activity"), :has-text("Recent")')
      if (await activitySection.count() > 0) {
        console.log('📌 Recent activity section found')
      }
      
      await takeScreenshot(page, '04-dashboard-overview')
    })

    // ========== OPPORTUNITIES SEARCH ==========
    await test.step('4. Search Opportunities', async () => {
      console.log('🔍 Navigating to opportunities...')
      
      // Navigate to opportunities
      await page.click('nav >> text=Opportunities')
      await page.waitForURL('**/opportunities')
      await waitForNetworkIdle(page)
      
      // Verify opportunities page
      await expect(page.locator('h1:has-text("Opportunities")')).toBeVisible()
      
      // Wait for search functionality
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]')
      await expect(searchInput).toBeVisible({ timeout: 10000 })
      
      // Perform search
      console.log('🔎 Searching for medical supplies...')
      await searchInput.fill('medical supplies')
      await searchInput.press('Enter')
      
      // Wait for results
      await page.waitForTimeout(2000)
      
      // Check for results
      const opportunityCards = page.locator('[data-testid*="opportunity"], [class*="opportunity"], article, [role="article"]')
      const resultCount = await opportunityCards.count()
      console.log(`Found ${resultCount} opportunities`)
      
      if (resultCount > 0) {
        await expect(opportunityCards.first()).toBeVisible()
        
        // Click on first opportunity for details
        console.log('📄 Viewing opportunity details...')
        await opportunityCards.first().click()
        await page.waitForTimeout(1500)
        
        // Check if modal or detail page opened
        const detailTitle = page.locator('h1[class*="title"], h2[class*="title"], [data-testid*="title"]')
        if (await detailTitle.count() > 0) {
          await takeScreenshot(page, '05-opportunity-details')
          
          // Look for save button
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Add to Saved"), button[aria-label*="Save"]')
          if (await saveButton.count() > 0 && await saveButton.isVisible()) {
            console.log('💾 Saving opportunity...')
            await saveButton.click()
            await page.waitForTimeout(1000)
          }
          
          // Close modal or go back
          const closeButton = page.locator('button[aria-label*="Close"], button:has-text("Close"), button:has-text("Back")')
          if (await closeButton.count() > 0 && await closeButton.isVisible()) {
            await closeButton.click()
          } else {
            await page.keyboard.press('Escape')
          }
        }
      }
      
      await takeScreenshot(page, '06-opportunities-search-results')
    })

    // ========== SAVED OPPORTUNITIES ==========
    await test.step('5. Check Saved Opportunities', async () => {
      console.log('📑 Checking saved opportunities...')
      
      // Navigate to saved
      await page.click('nav >> text=Saved')
      await page.waitForURL('**/saved')
      await waitForNetworkIdle(page)
      
      // Verify saved page
      await expect(page.locator('h1:has-text("Saved")')).toBeVisible()
      
      // Check for saved items
      const savedItems = page.locator('[data-testid*="saved"], [class*="saved"], article')
      const savedCount = await savedItems.count()
      console.log(`Found ${savedCount} saved items`)
      
      if (savedCount > 0) {
        // Test remove functionality
        const removeButton = page.locator('button:has-text("Remove"), button[aria-label*="Remove"]').first()
        if (await removeButton.count() > 0 && await removeButton.isVisible()) {
          console.log('🗑️ Testing remove functionality...')
          const initialCount = await savedItems.count()
          await removeButton.click()
          await page.waitForTimeout(1000)
          const newCount = await savedItems.count()
          console.log(`Items after removal: ${newCount} (was ${initialCount})`)
        }
      }
      
      await takeScreenshot(page, '07-saved-opportunities')
    })

    // ========== PROPOSALS ==========
    await test.step('6. Proposals Section', async () => {
      console.log('📝 Exploring proposals...')
      
      // Navigate to proposals
      await page.click('nav >> text=Proposals')
      await page.waitForURL('**/proposals')
      await waitForNetworkIdle(page)
      
      // Verify proposals page
      await expect(page.locator('h1:has-text("Proposals")')).toBeVisible()
      
      // Check for create button
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Proposal"), a[href*="new"]')
      if (await createButton.count() > 0) {
        console.log('➕ Found create proposal button')
        
        // Click to test navigation
        await createButton.first().click()
        await page.waitForTimeout(2000)
        
        // Check if we're on new proposal page
        if (page.url().includes('/new')) {
          console.log('📋 On new proposal page')
          await takeScreenshot(page, '08-new-proposal-page')
          
          // Go back to proposals list
          await page.goBack()
        }
      }
      
      // Check existing proposals
      const proposalItems = page.locator('[data-testid*="proposal"], [class*="proposal"], tr, article')
      const proposalCount = await proposalItems.count()
      console.log(`Found ${proposalCount} proposals`)
      
      await takeScreenshot(page, '09-proposals-list')
    })

    // ========== ANALYTICS ==========
    await test.step('7. Analytics Dashboard', async () => {
      console.log('📈 Viewing analytics...')
      
      // Navigate to analytics
      await page.click('nav >> text=Analytics')
      await page.waitForURL('**/analytics')
      await waitForNetworkIdle(page)
      
      // Verify analytics page
      await expect(page.locator('h1:has-text("Analytics")')).toBeVisible()
      
      // Wait for charts to load
      await page.waitForTimeout(3000)
      
      // Check for chart elements
      const charts = page.locator('canvas, svg[class*="chart"], [data-testid*="chart"], .recharts-wrapper')
      const chartCount = await charts.count()
      console.log(`Found ${chartCount} charts`)
      
      // Check for metrics
      const metrics = page.locator('[data-testid*="metric"], [class*="metric"], [class*="stat"]')
      const metricCount = await metrics.count()
      console.log(`Found ${metricCount} metrics`)
      
      await takeScreenshot(page, '10-analytics-dashboard')
    })

    // ========== SETTINGS ==========
    await test.step('8. Settings Configuration', async () => {
      console.log('⚙️ Checking settings...')
      
      // Navigate to settings
      await page.click('nav >> text=Settings')
      await page.waitForURL('**/settings')
      await waitForNetworkIdle(page)
      
      // Verify settings page
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible()
      
      // Check settings sections
      const sections = ['Profile', 'Notifications', 'Security', 'API', 'Billing']
      for (const section of sections) {
        const sectionElement = page.locator(`text=${section}`)
        if (await sectionElement.count() > 0) {
          console.log(`✓ Found ${section} section`)
        }
      }
      
      // Test tab navigation if present
      const tabs = page.locator('[role="tab"], button[class*="tab"]')
      if (await tabs.count() > 1) {
        console.log('📑 Testing tab navigation...')
        await tabs.nth(1).click()
        await page.waitForTimeout(1000)
      }
      
      await takeScreenshot(page, '11-settings-page')
    })

    // ========== USER MENU & LOGOUT ==========
    await test.step('9. User Menu and Logout', async () => {
      console.log('👤 Testing user menu...')
      
      // Find user menu
      const userMenu = page.locator('[data-testid*="user"], button[aria-label*="Account"], button:has-text("Account"), [class*="avatar"]')
      
      if (await userMenu.count() > 0 && await userMenu.first().isVisible()) {
        await userMenu.first().click()
        await page.waitForTimeout(500)
        
        // Check for user email display
        const emailDisplay = page.locator(`text=${TEST_USER.email}`)
        if (await emailDisplay.count() > 0) {
          console.log('✓ User email displayed in menu')
        }
        
        // Find logout button
        const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")')
        if (await logoutButton.count() > 0 && await logoutButton.isVisible()) {
          console.log('🚪 Logging out...')
          await takeScreenshot(page, '12-user-menu-open')
          
          await logoutButton.click()
          
          // Wait for redirect to login
          await page.waitForURL('**/login', { timeout: 10000 })
          console.log('✅ Successfully logged out')
          
          await takeScreenshot(page, '13-logged-out')
        }
      }
    })
  })

  // ========== MOBILE RESPONSIVENESS TEST ==========
  test('Mobile Responsiveness', async ({ page }) => {
    console.log('📱 Testing mobile responsiveness...')
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await test.step('Mobile Navigation', async () => {
      // Navigate to home
      await page.goto('/')
      await waitForNetworkIdle(page)
      
      // Look for mobile menu
      const mobileMenu = page.locator('[data-testid*="mobile"], button[aria-label*="menu"], button[class*="burger"]')
      
      if (await mobileMenu.count() > 0 && await mobileMenu.isVisible()) {
        console.log('📱 Found mobile menu button')
        await mobileMenu.click()
        await page.waitForTimeout(500)
        
        // Check if menu opened
        const mobileNav = page.locator('nav[class*="mobile"], [class*="drawer"], [class*="sidebar"]')
        if (await mobileNav.count() > 0) {
          await expect(mobileNav.first()).toBeVisible()
          await takeScreenshot(page, 'mobile-01-menu-open')
        }
      }
      
      await takeScreenshot(page, 'mobile-02-homepage')
    })
    
    await test.step('Mobile Login', async () => {
      // Navigate to login
      await page.goto('/login')
      await waitForNetworkIdle(page)
      
      // Check form layout
      const loginForm = page.locator('form')
      await expect(loginForm).toBeVisible()
      
      await takeScreenshot(page, 'mobile-03-login-page')
    })
  })

  // ========== PERFORMANCE TEST ==========
  test('Performance Metrics', async ({ page }) => {
    console.log('⚡ Testing performance...')
    
    await test.step('Measure Page Load Times', async () => {
      const pages = [
        { name: 'Landing', url: '/' },
        { name: 'Login', url: '/login' },
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Opportunities', url: '/opportunities' }
      ]
      
      for (const pageInfo of pages) {
        const startTime = Date.now()
        await page.goto(pageInfo.url)
        await waitForNetworkIdle(page)
        const loadTime = Date.now() - startTime
        
        console.log(`${pageInfo.name} page load time: ${loadTime}ms`)
        expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds
      }
    })
    
    await test.step('Check Core Web Vitals', async () => {
      await page.goto('/')
      
      // Measure LCP (Largest Contentful Paint)
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]
            resolve(lastEntry.startTime)
          }).observe({ entryTypes: ['largest-contentful-paint'] })
        })
      })
      
      console.log(`LCP: ${lcp}ms`)
      expect(lcp).toBeLessThan(2500) // Good LCP is under 2.5s
    })
  })

  // ========== ERROR HANDLING TEST ==========
  test('Error Handling', async ({ page }) => {
    console.log('❌ Testing error handling...')
    
    await test.step('Network Error Handling', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort())
      
      // Try to login
      await page.goto('/login')
      await page.fill('input[name="email"]', TEST_USER.email)
      await page.fill('input[name="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')
      
      // Should show error message
      const errorMessage = page.locator('text=/error|failed|problem|unable/i')
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 })
      
      console.log('✓ Network error handled gracefully')
      await takeScreenshot(page, 'error-01-network-failure')
    })
    
    await test.step('404 Page Handling', async () => {
      // Navigate to non-existent page
      await page.goto('/this-page-does-not-exist-12345')
      
      // Should show 404 or redirect
      const notFound = page.locator('text=/404|not found|page not found/i')
      if (await notFound.count() > 0) {
        console.log('✓ 404 page displayed')
        await takeScreenshot(page, 'error-02-404-page')
      }
    })
  })

  // ========== ACCESSIBILITY TEST ==========
  test('Accessibility Compliance', async ({ page }) => {
    console.log('♿ Testing accessibility...')
    
    await test.step('Keyboard Navigation', async () => {
      await page.goto('/')
      
      // Tab through interactive elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(100)
      }
      
      // Check focused element
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName
      })
      console.log(`Focused element after tabbing: ${focusedElement}`)
    })
    
    await test.step('ARIA Labels', async () => {
      // Check buttons have accessible labels
      const buttons = await page.locator('button').all()
      let buttonsWithLabels = 0
      
      for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
        const text = await button.textContent()
        const ariaLabel = await button.getAttribute('aria-label')
        if (text || ariaLabel) {
          buttonsWithLabels++
        }
      }
      
      console.log(`Buttons with accessible labels: ${buttonsWithLabels}/${Math.min(buttons.length, 5)}`)
    })
    
    await test.step('Alt Text on Images', async () => {
      const images = await page.locator('img').all()
      let imagesWithAlt = 0
      
      for (const img of images) {
        const alt = await img.getAttribute('alt')
        if (alt) {
          imagesWithAlt++
        }
      }
      
      console.log(`Images with alt text: ${imagesWithAlt}/${images.length}`)
    })
  })
})

// ========== CONFIGURATION FOR HEADED MODE ==========
test.describe('Visual Testing Mode', () => {
  test.use({
    // Slower timeouts for demonstration
    actionTimeout: 30000,
    navigationTimeout: 40000
  })

  test('Demo Mode - Slow Visual Test', async ({ page }) => {
    console.log('🎬 Running in demo mode with slow actions...')
    
    await test.step('Slow Login Demo', async () => {
      await page.goto('/login')
      await page.waitForTimeout(2000) // Pause to see page
      
      // Type slowly
      await page.locator('input[name="email"]').type(TEST_USER.email, { delay: 100 })
      await page.waitForTimeout(1000)
      
      await page.locator('input[name="password"]').type(TEST_USER.password, { delay: 100 })
      await page.waitForTimeout(1000)
      
      // Highlight submit button before clicking
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.hover()
      await page.waitForTimeout(1000)
      
      await submitButton.click()
      await page.waitForURL('**/dashboard')
      
      console.log('✅ Demo login complete')
    })
  })
})
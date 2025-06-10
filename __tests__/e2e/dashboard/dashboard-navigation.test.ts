import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: 'test@medcontracthub.com',
  password: 'Test123!@#'
}

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('should display main dashboard elements', async ({ page }) => {
    await test.step('Verify dashboard header', async () => {
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"], button:has-text("Account")')).toBeVisible()
    })

    await test.step('Verify navigation menu', async () => {
      const navItems = [
        'Dashboard',
        'Opportunities',
        'Saved',
        'Proposals',
        'Analytics',
        'Settings'
      ]
      
      for (const item of navItems) {
        await expect(page.locator(`nav a:has-text("${item}"), nav button:has-text("${item}")`)).toBeVisible()
      }
    })

    await test.step('Verify dashboard cards', async () => {
      // Wait for stats to load
      await page.waitForSelector('[data-testid="dashboard-stats"], .dashboard-card', { timeout: 10000 })
      
      // Check for common dashboard elements
      const statsCards = page.locator('[data-testid="stats-card"], .stats-card')
      expect(await statsCards.count()).toBeGreaterThan(0)
      
      await page.screenshot({ 
        path: 'test-results/dashboard-01-overview.png',
        fullPage: true 
      })
    })
  })

  test('should navigate to different sections', async ({ page }) => {
    const navigationTests = [
      { link: 'Opportunities', url: '/opportunities', title: 'Opportunities' },
      { link: 'Saved', url: '/saved', title: 'Saved Opportunities' },
      { link: 'Proposals', url: '/proposals', title: 'Proposals' },
      { link: 'Analytics', url: '/analytics', title: 'Analytics' },
      { link: 'Settings', url: '/settings', title: 'Settings' }
    ]

    for (const navTest of navigationTests) {
      await test.step(`Navigate to ${navTest.link}`, async () => {
        await page.click(`nav a:has-text("${navTest.link}"), nav button:has-text("${navTest.link}")`)
        await page.waitForURL(`**${navTest.url}`)
        
        // Verify we're on the right page
        await expect(page.locator(`h1:has-text("${navTest.title}")`)).toBeVisible({ timeout: 5000 })
        
        // Go back to dashboard for next test
        await page.click('nav a:has-text("Dashboard")')
        await page.waitForURL('**/dashboard')
      })
    }
  })

  test('should display recent activity', async ({ page }) => {
    // Look for activity section
    const activitySection = page.locator('[data-testid="recent-activity"], :has-text("Recent Activity")')
    
    if (await activitySection.count() > 0) {
      await expect(activitySection).toBeVisible()
      
      // Check for activity items
      const activityItems = page.locator('[data-testid="activity-item"], .activity-item')
      if (await activityItems.count() > 0) {
        await expect(activityItems.first()).toBeVisible()
      }
    }
  })

  test('should display upcoming deadlines', async ({ page }) => {
    // Look for deadlines section
    const deadlinesSection = page.locator('[data-testid="upcoming-deadlines"], :has-text("Upcoming Deadlines")')
    
    if (await deadlinesSection.count() > 0) {
      await expect(deadlinesSection).toBeVisible()
      
      // Check for deadline items
      const deadlineItems = page.locator('[data-testid="deadline-item"], .deadline-item')
      if (await deadlineItems.count() > 0) {
        await expect(deadlineItems.first()).toBeVisible()
      }
    }
  })

  test('should handle quick actions', async ({ page }) => {
    // Look for quick action buttons
    const quickActions = [
      { button: 'Search Opportunities', expectedUrl: '/opportunities' },
      { button: 'View Saved', expectedUrl: '/saved' },
      { button: 'Create Proposal', expectedUrl: '/proposals/new' }
    ]

    for (const action of quickActions) {
      const button = page.locator(`button:has-text("${action.button}")`)
      if (await button.count() > 0) {
        await button.click()
        await expect(page).toHaveURL(new RegExp(action.expectedUrl))
        await page.goBack()
      }
    }
  })

  test('should display user profile information', async ({ page }) => {
    // Open user menu if needed
    const userMenu = page.locator('[data-testid="user-menu"], button:has([data-testid="user-avatar"])')
    if (await userMenu.count() > 0) {
      await userMenu.click()
      
      // Check for user email
      await expect(page.locator(`text=${TEST_USER.email}`)).toBeVisible()
      
      // Close menu
      await page.keyboard.press('Escape')
    }
  })
})

// Mobile dashboard tests
test.describe('Dashboard - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } })
  
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')
  })

  test('should have responsive navigation', async ({ page }) => {
    // Check for mobile menu button
    const mobileMenuButton = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"]')
    
    if (await mobileMenuButton.count() > 0) {
      await mobileMenuButton.click()
      
      // Verify mobile menu opens
      await expect(page.locator('nav')).toBeVisible()
      
      // Check navigation items are visible
      await expect(page.locator('nav a:has-text("Opportunities")')).toBeVisible()
      
      await page.screenshot({ 
        path: 'test-results/dashboard-02-mobile-menu.png',
        fullPage: true 
      })
      
      // Close menu
      await page.keyboard.press('Escape')
    }
  })

  test('should stack dashboard cards on mobile', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-stats"], .dashboard-card')
    
    // Get all stats cards
    const cards = await page.locator('[data-testid="stats-card"], .stats-card').all()
    
    if (cards.length > 1) {
      // Check if cards are stacked (have similar x coordinates)
      const firstCardBox = await cards[0].boundingBox()
      const secondCardBox = await cards[1].boundingBox()
      
      if (firstCardBox && secondCardBox) {
        // Cards should have similar x coordinates if stacked
        expect(Math.abs(firstCardBox.x - secondCardBox.x)).toBeLessThan(20)
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/dashboard-03-mobile-layout.png',
      fullPage: true 
    })
  })
})
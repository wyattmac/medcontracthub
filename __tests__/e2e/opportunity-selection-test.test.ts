import { test, expect } from '@playwright/test'

test.describe('Opportunity Selection Error Debug', () => {
  test('Debug clicking on opportunity contract', async ({ page }) => {
    console.log('🔍 Testing opportunity selection...')
    
    // Capture console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        console.error('❌ Browser console error:', msg.text())
      }
    })
    
    // Capture page errors
    page.on('pageerror', error => {
      console.error('❌ Page error:', error.message)
    })
    
    // Monitor network failures
    page.on('requestfailed', request => {
      console.error('❌ Request failed:', request.url())
    })
    
    // Step 1: Navigate to opportunities
    console.log('\n1️⃣ Navigating to opportunities page...')
    await page.goto('http://localhost:3000/opportunities')
    
    // Handle login if needed
    if (page.url().includes('/login')) {
      console.log('🔐 Handling login...')
      await page.fill('input[type="email"]', 'test@medcontracthub.com')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard')
      await page.goto('http://localhost:3000/opportunities')
    }
    
    // Wait for opportunities to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // Give time for data to load
    
    console.log('📍 Current URL:', page.url())
    
    // Step 2: Find opportunity links/cards
    console.log('\n2️⃣ Looking for opportunity cards...')
    
    // Try multiple selectors for opportunities
    const selectors = [
      'a[href*="/opportunities/"]',  // Direct links to opportunity details
      '.hover\\:shadow-md.transition-shadow a', // Links within cards
      '[data-testid="opportunity-card"] a',
      'h3 a', // Links in headings
      'h4 a',
      '[role="article"] a'
    ]
    
    let opportunityLink = null
    let selector = ''
    
    for (const sel of selectors) {
      const links = page.locator(sel)
      const count = await links.count()
      if (count > 0) {
        console.log(`✅ Found ${count} links with selector: ${sel}`)
        opportunityLink = links.first()
        selector = sel
        break
      }
    }
    
    if (!opportunityLink) {
      console.log('⚠️ No opportunity links found, looking for clickable cards...')
      
      // Try clickable card elements
      const cardSelectors = [
        '.hover\\:shadow-md.transition-shadow',
        '[data-testid="opportunity-card"]',
        'article.cursor-pointer',
        '[role="article"]'
      ]
      
      for (const sel of cardSelectors) {
        const cards = page.locator(sel)
        const count = await cards.count()
        if (count > 0) {
          console.log(`✅ Found ${count} cards with selector: ${sel}`)
          opportunityLink = cards.first()
          selector = sel
          break
        }
      }
    }
    
    if (opportunityLink) {
      // Get info about what we're clicking
      const elementInfo = await opportunityLink.evaluate(el => {
        return {
          tagName: el.tagName,
          href: (el as HTMLAnchorElement).href || 'N/A',
          text: el.textContent?.substring(0, 100),
          classList: Array.from(el.classList).join(' ')
        }
      })
      
      console.log('\n📋 Element info:')
      console.log('  Tag:', elementInfo.tagName)
      console.log('  Href:', elementInfo.href)
      console.log('  Text:', elementInfo.text)
      console.log('  Classes:', elementInfo.classList)
      
      // Take screenshot before clicking
      await page.screenshot({ path: 'test-results/before-click.png' })
      
      // Step 3: Click on the opportunity
      console.log('\n3️⃣ Clicking on opportunity...')
      
      try {
        // Click and wait for navigation
        await Promise.all([
          page.waitForNavigation({ timeout: 10000 }).catch(() => console.log('No navigation occurred')),
          opportunityLink.click()
        ])
        
        console.log('✅ Click completed')
        console.log('📍 New URL:', page.url())
        
        // Wait for any errors to appear
        await page.waitForTimeout(2000)
        
        // Take screenshot after clicking
        await page.screenshot({ path: 'test-results/after-click.png' })
        
        // Check if we're on an error page
        const errorIndicators = [
          'text=/error|Error/i',
          'text=/not found|Not Found/i',
          'text=/something went wrong/i',
          'text=/unable to load/i',
          '[data-testid="error"]',
          '.error-message'
        ]
        
        for (const errorSel of errorIndicators) {
          const errorElement = page.locator(errorSel)
          if (await errorElement.count() > 0) {
            const errorText = await errorElement.first().textContent()
            console.error(`\n❌ ERROR FOUND: ${errorText}`)
          }
        }
        
      } catch (error) {
        console.error('\n❌ Error during click:', error)
      }
      
    } else {
      console.error('❌ No opportunity links or cards found to click!')
      
      // Debug: Get page structure
      console.log('\n🔍 Page structure debug:')
      const pageText = await page.locator('body').textContent()
      console.log('Page contains "opportunity":', pageText?.toLowerCase().includes('opportunity'))
      
      const allLinks = await page.locator('a').count()
      console.log(`Total links on page: ${allLinks}`)
      
      // List all hrefs
      const hrefs = await page.locator('a').evaluateAll(links => 
        links.map(a => (a as HTMLAnchorElement).href).filter(h => h.includes('opportunities'))
      )
      console.log('Opportunity-related links:', hrefs)
    }
    
    // Step 4: Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 ERROR ANALYSIS SUMMARY:')
    console.log('='.repeat(50))
    console.log(`Console errors found: ${consoleErrors.length}`)
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`)
      })
    }
    
    // Check current page state
    const currentUrl = page.url()
    if (currentUrl.includes('/opportunities/') && !currentUrl.endsWith('/opportunities')) {
      console.log('\n✅ Successfully navigated to opportunity detail page')
      console.log(`Opportunity ID: ${currentUrl.split('/').pop()}`)
    } else {
      console.log('\n⚠️ Did not navigate to opportunity detail page')
      console.log(`Still on: ${currentUrl}`)
    }
    
    console.log('\n💡 Check screenshots:')
    console.log('  - test-results/before-click.png')
    console.log('  - test-results/after-click.png')
  })
})
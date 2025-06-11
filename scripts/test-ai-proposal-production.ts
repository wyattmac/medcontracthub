#!/usr/bin/env npx tsx

/**
 * Production-Ready Test for AI Proposal Generator
 * Tests the complete user flow with proper authentication
 */

import { chromium, Browser, Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_EMAIL = 'test@medcontracthub.com'

interface TestResult {
  step: string
  success: boolean
  duration: number
  error?: string
  details?: any
}

class ProposalGeneratorTester {
  private results: TestResult[] = []
  private browser: Browser | null = null
  private page: Page | null = null
  private startTime: number = Date.now()

  async runFullTest() {
    console.log('🧪 Production-Ready AI Proposal Generator Test')
    console.log('============================================\n')

    try {
      // 1. Environment Check
      await this.checkEnvironment()

      // 2. Start Browser
      await this.initBrowser()

      // 3. Authentication Flow
      await this.testAuthentication()

      // 4. Navigate to Opportunities
      await this.testOpportunityNavigation()

      // 5. Select Opportunity
      await this.testOpportunitySelection()

      // 6. Create Proposal
      await this.testProposalCreation()

      // 7. AI Generation
      await this.testAIGeneration()

      // 8. Save Proposal
      await this.testProposalSave()

      // 9. Verify Saved Data
      await this.testDataPersistence()

      // Print Results
      this.printResults()

    } catch (error) {
      console.error('❌ Test suite failed:', error)
      this.results.push({
        step: 'Test Suite',
        success: false,
        duration: Date.now() - this.startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      if (this.browser) {
        await this.browser.close()
      }
    }
  }

  private async checkEnvironment() {
    const stepStart = Date.now()
    console.log('📋 Checking environment...')

    try {
      // Check required environment variables
      const required = ['ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      const missing = required.filter(key => !process.env[key])
      
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`)
      }

      // Check API health
      const response = await fetch(`${BASE_URL}/api/health`)
      if (!response.ok) {
        throw new Error('API health check failed')
      }

      const health = await response.json()
      console.log('✅ Environment healthy:', health.status)

      this.results.push({
        step: 'Environment Check',
        success: true,
        duration: Date.now() - stepStart,
        details: health
      })
    } catch (error) {
      this.results.push({
        step: 'Environment Check',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async initBrowser() {
    const stepStart = Date.now()
    console.log('🌐 Starting browser...')

    try {
      this.browser = await chromium.launch({
        headless: process.env.CI === 'true',
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      this.page = await this.browser.newPage()
      await this.page.setViewportSize({ width: 1280, height: 800 })

      // Set up console logging
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('Browser console error:', msg.text())
        }
      })

      this.results.push({
        step: 'Browser Initialization',
        success: true,
        duration: Date.now() - stepStart
      })
    } catch (error) {
      this.results.push({
        step: 'Browser Initialization',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async testAuthentication() {
    const stepStart = Date.now()
    console.log('🔐 Testing authentication...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      // Navigate to login
      await this.page.goto(`${BASE_URL}/login`)
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 })

      // Take screenshot before login
      await this.page.screenshot({ path: 'login-page.png' })

      // Perform mock login
      await this.page.fill('input[type="email"]', TEST_EMAIL)
      
      // Submit the form by pressing Enter or clicking the button
      await this.page.press('input[type="email"]', 'Enter')

      // Wait for navigation - mock login uses window.location.href
      await this.page.waitForURL('**/dashboard', { timeout: 10000 })
      
      // Check if we've been redirected
      const currentUrl = this.page.url()
      console.log('Current URL after login:', currentUrl)
      
      // If still on login page, wait a moment and check again
      if (currentUrl.includes('/login')) {
        await this.page.waitForTimeout(2000)
        const newUrl = this.page.url()
        if (newUrl.includes('/login')) {
          throw new Error('Failed to redirect after login - still on login page')
        }
      }

      console.log('✅ Authentication successful')

      this.results.push({
        step: 'Authentication',
        success: true,
        duration: Date.now() - stepStart,
        details: { redirectUrl: currentUrl }
      })
    } catch (error) {
      await this.page?.screenshot({ path: 'auth-error.png' })
      this.results.push({
        step: 'Authentication',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async testOpportunityNavigation() {
    const stepStart = Date.now()
    console.log('📋 Navigating to opportunities...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      await this.page.goto(`${BASE_URL}/opportunities`)
      
      // Wait for opportunities to load - look for various possible selectors
      await this.page.waitForSelector('table tbody tr, [data-testid="opportunity-card"], .opportunity-card, [href*="/opportunities/"]', { 
        timeout: 15000 
      })

      // Count opportunities - check table rows or cards
      const tableRows = await this.page.locator('table tbody tr').count()
      const opportunityCards = await this.page.locator('[data-testid="opportunity-card"], .opportunity-card').count()
      const opportunityLinks = await this.page.locator('a[href*="/opportunities/"]').count()
      
      const opportunityCount = Math.max(tableRows, opportunityCards, opportunityLinks)

      if (opportunityCount === 0) {
        throw new Error('No opportunities found')
      }

      console.log(`✅ Found ${opportunityCount} opportunities`)

      this.results.push({
        step: 'Opportunity Navigation',
        success: true,
        duration: Date.now() - stepStart,
        details: { count: opportunityCount }
      })
    } catch (error) {
      await this.page?.screenshot({ path: 'opportunities-error.png' })
      this.results.push({
        step: 'Opportunity Navigation',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async testOpportunitySelection() {
    const stepStart = Date.now()
    console.log('🎯 Selecting opportunity...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      // Take screenshot to see what we're working with
      await this.page.screenshot({ path: 'opportunities-page.png' })

      // Find and click the first opportunity link in the table
      const firstLink = await this.page.locator('table tbody tr:first-child a[href*="/opportunities/"]').first()
      
      if (await firstLink.count() > 0) {
        const href = await firstLink.getAttribute('href')
        console.log(`Clicking opportunity link: ${href}`)
        await firstLink.click()
      } else {
        // Fallback: try to find any link to an opportunity
        const anyOpportunityLink = await this.page.locator('a[href*="/opportunities/"]:not([href="/opportunities"])').first()
        if (await anyOpportunityLink.count() > 0) {
          await anyOpportunityLink.click()
        } else {
          throw new Error('Could not find any opportunity link to click')
        }
      }
      
      // Wait for detail page
      await this.page.waitForSelector('button:has-text("Mark for Proposal"), button:has-text("Create Proposal")', { 
        timeout: 10000 
      })

      // Get opportunity details
      const title = await this.page.textContent('h1')
      console.log(`✅ Selected opportunity: ${title}`)

      this.results.push({
        step: 'Opportunity Selection',
        success: true,
        duration: Date.now() - stepStart,
        details: { title }
      })
    } catch (error) {
      await this.page?.screenshot({ path: 'opportunity-selection-error.png' })
      this.results.push({
        step: 'Opportunity Selection',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async testProposalCreation() {
    const stepStart = Date.now()
    console.log('📝 Creating proposal...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      // Click Mark for Proposal
      await this.page.click('button:has-text("Mark for Proposal")')
      
      // Wait for proposal form
      await this.page.waitForSelector('[data-testid="proposal-form"], form', { 
        timeout: 10000 
      })

      console.log('✅ Proposal form loaded')

      this.results.push({
        step: 'Proposal Creation',
        success: true,
        duration: Date.now() - stepStart
      })
    } catch (error) {
      await this.page?.screenshot({ path: 'proposal-creation-error.png' })
      this.results.push({
        step: 'Proposal Creation',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private async testAIGeneration() {
    const stepStart = Date.now()
    console.log('🤖 Testing AI generation...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      // Look for AI Generator tab/button
      const aiTabLocator = this.page.locator('button:has-text("AI Generator"), [data-testid="ai-generator-tab"]')
      const aiTabCount = await aiTabLocator.count()
      
      if (aiTabCount === 0) {
        throw new Error('AI Generator not found in UI')
      }

      await aiTabLocator.first().click()
      await this.page.waitForTimeout(1000)

      // Check if RFP document is required
      const rfpRequiredCount = await this.page.locator('.rfp-required-message').count()
      if (rfpRequiredCount > 0) {
        console.log('⚠️  RFP document required for generation')
        
        // For testing, we'll simulate having processed an RFP
        // In production, user would upload a real document
      }

      // Select section to generate
      const sectionSelectorCount = await this.page.locator('select[name="section"], [data-testid="section-selector"]').count()
      if (sectionSelectorCount > 0) {
        await this.page.selectOption('select[name="section"], [data-testid="section-selector"]', 'executive_summary')
      }

      // Add test context
      const contextFieldCount = await this.page.locator('textarea[name="additionalContext"]').count()
      if (contextFieldCount > 0) {
        await this.page.fill('textarea[name="additionalContext"]', 'This is a test generation for a medical supply contract.')
      }

      // Click generate button
      const generateButtonLocator = this.page.locator('button:has-text("Generate"), [data-testid="generate-button"]')
      const generateButtonCount = await generateButtonLocator.count()
      if (generateButtonCount === 0) {
        throw new Error('Generate button not found')
      }

      console.log('⏳ Starting AI generation...')
      await generateButtonLocator.first().click()

      // Wait for generation to complete (max 60 seconds)
      try {
        await this.page.waitForSelector(
          '[data-testid="generation-result"], .generation-complete', 
          { timeout: 60000 }
        )
        
        // Check if content was generated
        const generatedContent = await this.page.textContent(
          '[data-testid="generated-content"], .generated-content'
        )

        if (!generatedContent || generatedContent.length < 100) {
          throw new Error('Generated content too short or empty')
        }

        console.log('✅ AI generation successful')
        console.log(`   Generated ${generatedContent.length} characters`)

        // Check metrics if available
        const metricElements = await this.page.locator('.generation-metric').all()
        const metrics = await Promise.all(
          metricElements.map(async el => ({
            label: await el.locator('.metric-label').textContent(),
            value: await el.locator('.metric-value').textContent()
          }))
        )

        this.results.push({
          step: 'AI Generation',
          success: true,
          duration: Date.now() - stepStart,
          details: {
            contentLength: generatedContent.length,
            metrics
          }
        })
      } catch (timeoutError) {
        // Check if there's an error message
        const errorMessage = await this.page.textContent(
          '.error-message, [data-testid="generation-error"]'
        ).catch(() => null)

        throw new Error(errorMessage || 'Generation timed out')
      }
    } catch (error) {
      await this.page?.screenshot({ path: 'ai-generation-error.png' })
      this.results.push({
        step: 'AI Generation',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Don't throw here - we want to continue testing other features
      console.error('⚠️  AI Generation failed:', error)
    }
  }

  private async testProposalSave() {
    const stepStart = Date.now()
    console.log('💾 Saving proposal...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      // Find save button
      const saveButtonLocator = this.page.locator('button:has-text("Save"), [data-testid="save-proposal"]')
      const saveButtonCount = await saveButtonLocator.count()
      if (saveButtonCount === 0) {
        throw new Error('Save button not found')
      }

      await saveButtonLocator.first().click()

      // Wait for save confirmation
      await this.page.waitForSelector(
        '[data-testid="save-success"], .save-success-message',
        { timeout: 10000 }
      )

      console.log('✅ Proposal saved successfully')

      this.results.push({
        step: 'Proposal Save',
        success: true,
        duration: Date.now() - stepStart
      })
    } catch (error) {
      await this.page?.screenshot({ path: 'save-error.png' })
      this.results.push({
        step: 'Proposal Save',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async testDataPersistence() {
    const stepStart = Date.now()
    console.log('🔍 Verifying data persistence...')

    try {
      if (!this.page) throw new Error('Page not initialized')

      // Navigate to proposals list
      await this.page.goto(`${BASE_URL}/proposals`)
      await this.page.waitForSelector('[data-testid="proposal-card"], .proposal-card', {
        timeout: 10000
      })

      // Check if our proposal appears
      const proposalCount = await this.page.locator(
        '[data-testid="proposal-card"], .proposal-card'
      ).count()

      console.log(`✅ Found ${proposalCount} proposals`)

      this.results.push({
        step: 'Data Persistence',
        success: true,
        duration: Date.now() - stepStart,
        details: { proposalCount }
      })
    } catch (error) {
      this.results.push({
        step: 'Data Persistence',
        success: false,
        duration: Date.now() - stepStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private printResults() {
    console.log('\n📊 Test Results Summary')
    console.log('======================\n')

    const totalDuration = Date.now() - this.startTime
    const successCount = this.results.filter(r => r.success).length
    const failureCount = this.results.filter(r => !r.success).length

    // Print individual results
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌'
      const duration = `${result.duration}ms`
      console.log(`${icon} ${result.step.padEnd(25)} ${duration.padStart(10)}`)
      
      if (!result.success && result.error) {
        console.log(`   └─ Error: ${result.error}`)
      }
      
      if (result.details) {
        console.log(`   └─ Details: ${JSON.stringify(result.details)}`)
      }
    })

    // Print summary
    console.log('\n' + '─'.repeat(50))
    console.log(`Total Duration: ${totalDuration}ms`)
    console.log(`Success: ${successCount}`)
    console.log(`Failures: ${failureCount}`)
    console.log(`Overall: ${failureCount === 0 ? '✅ PASSED' : '❌ FAILED'}`)

    // Performance warnings
    if (totalDuration > 120000) {
      console.warn('\n⚠️  Warning: Total test duration exceeded 2 minutes')
    }

    const slowSteps = this.results.filter(r => r.duration > 30000)
    if (slowSteps.length > 0) {
      console.warn('\n⚠️  Slow steps detected:')
      slowSteps.forEach(step => {
        console.warn(`   - ${step.step}: ${step.duration}ms`)
      })
    }
  }
}

// Run the test
async function main() {
  const tester = new ProposalGeneratorTester()
  await tester.runFullTest()
}

main().catch(console.error)
/**
 * Global setup for Playwright E2E tests
 * Sets up test environment and authentication
 */

import { chromium, type FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...')
  
  // Verify test environment
  const baseURL = config.webServer?.url || process.env.E2E_BASE_URL || 'http://localhost:3000'
  
  try {
    // Launch browser for setup
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Verify app is running
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    
    // Check if landing page loads
    const title = await page.title()
    if (!title.includes('MedContractHub')) {
      throw new Error('Application not loaded correctly')
    }
    
    console.log('✅ Application is running and accessible')
    
    // Create test user session if needed
    await setupTestAuth(page)
    
    await browser.close()
    
    console.log('✅ E2E environment setup complete')
    
  } catch (error) {
    console.error('❌ E2E setup failed:', error)
    throw error
  }
}

async function setupTestAuth(page: any) {
  // Skip auth setup if we're not testing with auth
  if (process.env.E2E_SKIP_AUTH === 'true') {
    return
  }
  
  try {
    // You can pre-create test users or setup auth state here
    console.log('ℹ️  Auth setup skipped - will use individual test authentication')
  } catch (error) {
    console.warn('⚠️  Auth setup failed, tests will handle authentication individually:', error)
  }
}

export default globalSetup
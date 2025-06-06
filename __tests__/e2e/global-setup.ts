/**
 * Global Setup for Playwright E2E Tests
 * Prepares the test environment for critical user journey testing
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up global test environment...')
  
  // Create a browser instance for setup
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Verify the application is running
    console.log('🌐 Verifying application availability...')
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'
    
    await page.goto(baseURL, { timeout: 30000 })
    console.log('✅ Application is accessible')
    
    // Check for critical API endpoints
    const healthCheck = await page.request.get(`${baseURL}/api/health`)
    if (healthCheck.ok()) {
      console.log('✅ Health check endpoint is working')
    } else {
      console.warn('⚠️  Health check endpoint not available')
    }
    
    // Clear any existing test data
    console.log('🧹 Cleaning up any existing test data...')
    
    // You could add database cleanup here if needed
    // await cleanupTestData()
    
    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
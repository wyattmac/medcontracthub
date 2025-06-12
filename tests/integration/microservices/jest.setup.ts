/**
 * Jest Setup for Microservices Integration Tests
 */

// Increase default timeout for integration tests
jest.setTimeout(60000)

// Set up environment variables for testing
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

console.error = (...args: any[]) => {
  // Filter out expected errors
  const errorString = args.join(' ')
  if (
    errorString.includes('WebSocket connection error') ||
    errorString.includes('Failed to fetch') ||
    errorString.includes('ECONNREFUSED')
  ) {
    return
  }
  originalConsoleError(...args)
}

console.warn = (...args: any[]) => {
  // Filter out expected warnings
  const warnString = args.join(' ')
  if (warnString.includes('experimental')) {
    return
  }
  originalConsoleWarn(...args)
}

// Global test utilities
global.testUtils = {
  /**
   * Wait for condition to be true
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error('Timeout waiting for condition')
  },

  /**
   * Retry function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: Error | undefined
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
        }
      }
    }
    
    throw lastError || new Error('Retry failed')
  }
}

// Declare global test utils type
declare global {
  var testUtils: {
    waitFor: (condition: () => boolean | Promise<boolean>, timeout?: number, interval?: number) => Promise<void>
    retry: <T>(fn: () => Promise<T>, maxRetries?: number, delay?: number) => Promise<T>
  }
}
/**
 * Global test setup
 */

// Polyfill Web APIs for Node.js test environment
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as any
global.ReadableStream = ReadableStream

// Mock Web APIs
Object.defineProperty(global, 'Request', {
  value: class MockRequest {
    url: string
    method: string
    headers: Map<string, string>
    
    constructor(url: string, options?: any) {
      this.url = url
      this.method = options?.method || 'GET'
      this.headers = new Map(Object.entries(options?.headers || {}))
    }
    
    json() { return Promise.resolve({}) }
    text() { return Promise.resolve('') }
  }
})

Object.defineProperty(global, 'Response', {
  value: class MockResponse {
    status: number
    headers: Map<string, string>
    body: any
    
    constructor(body?: any, options?: any) {
      this.body = body
      this.status = options?.status || 200
      this.headers = new Map(Object.entries(options?.headers || {}))
    }
    
    json() { return Promise.resolve(this.body) }
    text() { return Promise.resolve(JSON.stringify(this.body)) }
  }
})

// Mock Next.js
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
}))

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  trackEvent: jest.fn(),
  startApiTransaction: jest.fn(() => ({
    setStatus: jest.fn(),
    finish: jest.fn(),
  })),
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
  addBreadcrumb: jest.fn(),
}))

// Mock external APIs
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(() => Promise.resolve({
        content: [{ text: 'Mock AI response' }],
      })),
    },
  })),
}))

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.CSRF_SECRET = 'test-csrf-secret'

// Global test utilities
global.fetch = jest.fn()

// Jest DOM matchers
import '@testing-library/jest-dom'

// Console warnings/errors during tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  console.error = jest.fn()
  console.warn = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})
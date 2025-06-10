import '@testing-library/jest-dom'
import React from 'react'

// Make React available globally for tests
global.React = React

// Set up test environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.CSRF_SECRET = 'test-csrf-secret'
process.env.SAM_GOV_API_KEY = 'test-sam-api-key'

// Mock modules before any imports
jest.mock('@/lib/redis/client', () => require('./__tests__/mocks/redis'))
jest.mock('@/lib/errors/logger', () => require('./__tests__/mocks/logger'))
jest.mock('@/lib/utils/cache', () => require('./__tests__/mocks/cache'))
jest.mock('@/lib/monitoring/sentry', () => require('./__tests__/mocks/sentry'))
jest.mock('@/lib/supabase/client', () => require('./__tests__/mocks/supabase'))
jest.mock('@/lib/supabase/server', () => require('./__tests__/mocks/supabase'))
jest.mock('@/lib/security/csrf', () => require('./__tests__/mocks/csrf'))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/test-path'
  },
}))

// Mock NextResponse for API routes
jest.mock('next/server', () => require('./__tests__/mocks/next-server'))

// Define global mocks
global.fetch = jest.fn()

// Mock Anthropic AI
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
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock Web APIs for Next.js server components
global.Request = class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.headers = new Map(Object.entries(options.headers || {}))
    this.method = options.method || 'GET'
    this.ip = '127.0.0.1'
  }
}

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
  }
  
  json() {
    return Promise.resolve(JSON.parse(this.body))
  }
  
  text() {
    return Promise.resolve(this.body)
  }
}

global.Headers = class MockHeaders {
  constructor(init) {
    this._headers = new Map()
    if (init) {
      if (typeof init === 'object' && !Array.isArray(init)) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), String(value))
        })
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), String(value))
        })
      }
    }
  }
  
  get(key) {
    return this._headers.get(key.toLowerCase())
  }
  
  set(key, value) {
    this._headers.set(key.toLowerCase(), String(value))
  }
  
  has(key) {
    return this._headers.has(key.toLowerCase())
  }
  
  delete(key) {
    return this._headers.delete(key.toLowerCase())
  }
  
  forEach(callback) {
    this._headers.forEach((value, key) => callback(value, key, this))
  }
  
  entries() {
    return this._headers.entries()
  }
  
  keys() {
    return this._headers.keys()
  }
  
  values() {
    return this._headers.values()
  }
}

// Suppress console warnings in tests unless explicitly testing them
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalConsoleError.call(console, ...args)
  }
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('deprecated'))
    ) {
      return
    }
    originalConsoleWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})
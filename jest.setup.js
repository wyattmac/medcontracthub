import '@testing-library/jest-dom'

// Import global mocks before anything else
import './__tests__/setup/mocks'

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
jest.mock('next/server', () => {
  const actualNextServer = jest.requireActual('next/server')
  return {
    ...actualNextServer,
    NextResponse: {
      ...actualNextServer.NextResponse,
      json: jest.fn((body, init) => {
        const status = init?.status || 200
        const headers = new Map()
        
        // Add default headers
        headers.set('content-type', 'application/json')
        
        // Add any provided headers
        if (init?.headers) {
          Object.entries(init.headers).forEach(([key, value]) => {
            headers.set(key.toLowerCase(), value)
          })
        }
        
        return {
          status,
          headers: {
            get: (key) => headers.get(key.toLowerCase()),
            set: (key, value) => headers.set(key.toLowerCase(), value),
            has: (key) => headers.has(key.toLowerCase()),
            forEach: (callback) => headers.forEach((value, key) => callback(value, key))
          },
          ok: status >= 200 && status < 300,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        }
      }),
      redirect: jest.fn((url, status = 302) => ({
        status,
        headers: new Map([['location', url]]),
      })),
      error: jest.fn(() => ({
        status: 500,
        statusText: 'Internal Server Error',
      })),
    },
  }
})

// Define global mocks before importing modules
global.jest = require('jest')

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

global.Headers = class MockHeaders extends Map {
  get(key) {
    return super.get(key.toLowerCase())
  }
  
  set(key, value) {
    return super.set(key.toLowerCase(), value)
  }
  
  has(key) {
    return super.has(key.toLowerCase())
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
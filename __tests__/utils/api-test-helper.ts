/**
 * API Testing Helper Utilities
 * Provides comprehensive testing infrastructure for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { User } from '@supabase/supabase-js'

// Mock environment variables for testing
const TEST_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
const TEST_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'

export interface ApiTestContext {
  request: NextRequest
  mockUser: User | null
  mockSupabase: Partial<SupabaseClient>
  cleanup: () => Promise<void>
}

export interface MockUser {
  id: string
  email: string
  role?: 'user' | 'admin'
  company_id?: string
  naics_codes?: string[]
}

/**
 * Creates a mock Next.js request for testing
 */
export function createMockRequest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const baseUrl = 'http://localhost:3000'
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  
  const requestInit: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  }

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    requestInit.body = JSON.stringify(body)
  }

  // Create a mock that implements the NextRequest interface
  const mockRequest = {
    method,
    url: fullUrl,
    headers: new Headers(requestInit.headers),
    body: requestInit.body,
    json: jest.fn().mockResolvedValue(body || {}),
    text: jest.fn().mockResolvedValue(JSON.stringify(body || {})),
    formData: jest.fn().mockResolvedValue(new FormData()),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob()),
    clone: jest.fn().mockReturnThis(),
    nextUrl: {
      pathname: new URL(fullUrl).pathname,
      searchParams: new URL(fullUrl).searchParams,
      search: new URL(fullUrl).search,
      href: fullUrl
    },
    geo: undefined,
    ip: '127.0.0.1',
    cookies: new Map()
  }

  return mockRequest as any as NextRequest
}

/**
 * Creates a mock user for testing
 */
export function createMockUser(overrides: Partial<MockUser> = {}): User {
  return {
    id: 'test-user-123',
    email: 'test@example.com',
    aud: 'authenticated',
    role: '',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
    ...overrides
  } as User
}

/**
 * Creates a mock Supabase client for testing
 */
export function createMockSupabase(mockUser: User | null = null, mockData: any = {}): Partial<SupabaseClient> {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnValue(Promise.resolve({ data: mockData.profile, error: null })),
    insert: jest.fn().mockReturnValue(Promise.resolve({ data: mockData.insert, error: null })),
    update: jest.fn().mockReturnValue(Promise.resolve({ data: mockData.update, error: null })),
    delete: jest.fn().mockReturnValue(Promise.resolve({ data: mockData.delete, error: null })),
    rpc: jest.fn().mockReturnValue(Promise.resolve({ data: mockData.rpc, error: null }))
  }

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: mockUser },
        error: mockUser ? null : new Error('No user')
      })
    } as any,
    from: jest.fn().mockReturnValue({
      ...mockQuery,
      // Chain to return promise with data
      then: (callback: any) => callback({ data: mockData.queryResult, error: null })
    }),
    rpc: mockQuery.rpc
  }
}

/**
 * Sets up a complete API test context
 */
export async function setupApiTest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  options: {
    user?: Partial<MockUser>
    body?: any
    headers?: Record<string, string>
    mockData?: any
  } = {}
): Promise<ApiTestContext> {
  const mockUser = options.user ? createMockUser(options.user) : null
  const mockSupabase = createMockSupabase(mockUser, options.mockData)
  const request = createMockRequest(method, url, options.body, options.headers)

  // Mock Supabase client creation
  jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn().mockResolvedValue(mockSupabase)
  }))

  return {
    request,
    mockUser,
    mockSupabase,
    cleanup: async () => {
      jest.clearAllMocks()
    }
  }
}

/**
 * Asserts that an API response has the expected structure
 */
export function assertApiResponse(
  response: Response,
  expectedStatus: number,
  expectedStructure?: any
) {
  expect(response.status).toBe(expectedStatus)
  
  if (expectedStructure) {
    return response.json().then(data => {
      expect(data).toMatchObject(expectedStructure)
      return data
    })
  }
  
  return response.json()
}

/**
 * Asserts that an API error response has the expected structure
 */
export function assertApiError(
  response: Response,
  expectedStatus: number,
  expectedErrorCode?: string
) {
  expect(response.status).toBe(expectedStatus)
  
  return response.json().then(data => {
    expect(data).toHaveProperty('error')
    expect(data.error).toHaveProperty('message')
    expect(data.error).toHaveProperty('code')
    expect(data.error).toHaveProperty('requestId')
    expect(data.error).toHaveProperty('timestamp')
    
    if (expectedErrorCode) {
      expect(data.error.code).toBe(expectedErrorCode)
    }
    
    return data
  })
}

/**
 * Creates test data for opportunities
 */
export function createMockOpportunity(overrides: any = {}) {
  return {
    id: 'test-opp-123',
    title: 'Medical Equipment Procurement',
    notice_id: 'TEST123456',
    organization_name: 'Department of Veterans Affairs',
    naics_code: '339112',
    description: 'Procurement of medical diagnostic equipment',
    response_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    posted_date: new Date().toISOString(),
    type: 'Combined Synopsis/Solicitation',
    place_of_performance_state: 'CA',
    link: 'https://sam.gov/test',
    active: true,
    ...overrides
  }
}

/**
 * Creates test data for user profiles
 */
export function createMockProfile(overrides: any = {}) {
  return {
    id: 'test-user-123',
    company_id: 'test-company-123',
    role: 'user',
    companies: {
      naics_codes: ['339112', '334510']
    },
    ...overrides
  }
}

/**
 * Rate limiting test helper
 */
export async function testRateLimit(
  apiHandler: (req: NextRequest) => Promise<Response>,
  request: NextRequest,
  maxRequests: number = 5
) {
  const responses = []
  
  // Make requests up to the limit
  for (let i = 0; i < maxRequests + 1; i++) {
    const response = await apiHandler(request)
    responses.push(response)
  }
  
  // Last request should be rate limited
  expect(responses[responses.length - 1].status).toBe(429)
  
  return responses
}

/**
 * Authentication test helper
 */
export async function testAuthentication(
  apiHandler: (req: NextRequest) => Promise<Response>,
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET'
) {
  // Test without authentication
  const unauthRequest = createMockRequest(method, url)
  const unauthResponse = await apiHandler(unauthRequest)
  
  expect(unauthResponse.status).toBe(401)
  
  const errorData = await unauthResponse.json()
  expect(errorData.error.code).toBe('AUTHENTICATION_ERROR')
  
  return errorData
}

/**
 * Validation test helper
 */
export async function testValidation(
  apiHandler: (req: NextRequest) => Promise<Response>,
  url: string,
  invalidData: any,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET'
) {
  const context = await setupApiTest(method, url, {
    user: { id: 'test-user' },
    body: method !== 'GET' ? invalidData : undefined
  })
  
  const response = await apiHandler(context.request)
  
  expect(response.status).toBe(400)
  
  const errorData = await response.json()
  expect(errorData.error.code).toBe('VALIDATION_ERROR')
  
  await context.cleanup()
  return errorData
}
/**
 * API Testing Utilities
 * Common mocks and helpers for testing API routes
 */

import { NextRequest } from 'next/server'

// Mock user data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// Mock profile data
export const mockProfile = {
  id: 'user-123',
  company_id: 'company-123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  title: 'CEO',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// Mock company data
export const mockCompany = {
  id: 'company-123',
  name: 'Test Medical Supply Co',
  naics_codes: ['334510', '621999'],
  certifications: ['SDVOSB', 'HUBZone'],
  description: 'Medical device manufacturing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// Mock opportunity data
export const mockOpportunity = {
  id: 'opp-123',
  sam_opportunity_id: 'SAM-123',
  title: 'Medical Equipment Procurement',
  description: 'Purchase of medical diagnostic equipment',
  agency: 'Department of Veterans Affairs',
  office: 'Veterans Health Administration',
  solicitation_number: 'VA123456789',
  response_deadline: '2024-12-31T23:59:59Z',
  posted_date: '2024-01-01T00:00:00Z',
  naics_code: '334510',
  set_aside_type: 'SDVOSB',
  place_of_performance_city: 'Washington',
  place_of_performance_state: 'DC',
  estimated_value_min: 100000,
  estimated_value_max: 500000,
  status: 'active',
  sam_url: 'https://sam.gov/opportunity/123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// Mock saved opportunity
export const mockSavedOpportunity = {
  id: 'saved-123',
  user_id: 'user-123',
  opportunity_id: 'opp-123',
  notes: 'This looks promising',
  tags: ['medical', 'priority'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// Mock AI analysis
export const mockAIAnalysis = {
  winProbability: 0.75,
  competitionLevel: 'Medium',
  strengths: ['Strong NAICS match', 'SDVOSB certification'],
  challenges: ['High competition', 'Complex requirements'],
  recommendations: ['Highlight veteran status', 'Partner with subcontractor'],
  complianceRequirements: ['FAR 52.219-9', 'DFARS 252.225-7001'],
  estimatedBidRange: { min: 450000, max: 500000 }
}

// Create mock Supabase client
export const createMockSupabaseClient = (overrides: any = {}) => {
  const defaultMock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null
      }),
      range: jest.fn().mockResolvedValue({
        data: [mockOpportunity],
        error: null,
        count: 1
      })
    }),
    rpc: jest.fn().mockResolvedValue({
      data: null,
      error: null
    })
  }

  return {
    ...defaultMock,
    ...overrides
  }
}

// Create mock NextRequest
export const createMockNextRequest = (
  url = 'https://example.com/api/test',
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
): NextRequest => {
  const fullUrl = new URL(url)
  
  // Add search params if provided
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value)
    })
  }

  const mockRequest = {
    url: fullUrl.toString(),
    method: options.method || 'GET',
    headers: new Map(Object.entries(options.headers || {})),
    nextUrl: fullUrl,
    ip: '127.0.0.1',
    json: jest.fn().mockResolvedValue(options.body || {}),
    text: jest.fn().mockResolvedValue(JSON.stringify(options.body || {})),
    formData: jest.fn().mockResolvedValue(new FormData())
  } as any

  // Add headers.get method
  mockRequest.headers.get = function(key: string) {
    return this.get(key.toLowerCase()) || null
  }

  return mockRequest as NextRequest
}

// Mock route context for our route handler
export const createMockRouteContext = (overrides: any = {}) => {
  return {
    request: createMockNextRequest(),
    user: mockUser,
    supabase: createMockSupabaseClient(),
    requestId: 'req_test_123',
    params: {},
    ...overrides
  }
}

// Helper to extract JSON from NextResponse
export const extractResponseJson = async (response: Response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// Helper to create error response expectation
export const expectErrorResponse = (response: Response, statusCode: number, errorMessage?: string) => {
  expect(response.status).toBe(statusCode)
  if (errorMessage) {
    expect(response.body).toEqual(expect.objectContaining({
      error: expect.objectContaining({
        message: expect.stringContaining(errorMessage)
      })
    }))
  }
}

// Add a dummy test to prevent Jest error about no tests
describe('API Test Utils', () => {
  it('should export mock user data', () => {
    expect(mockUser).toBeDefined()
    expect(mockUser.id).toBe('user-123')
  })
  
  it('should create mock NextRequest', () => {
    const request = createMockNextRequest('https://example.com/test')
    expect(request.url).toBe('https://example.com/test')
  })
})

// Helper to create success response expectation  
export const expectSuccessResponse = (response: Response, expectedData?: any) => {
  expect(response.status).toBe(200)
  if (expectedData) {
    expect(response.body).toEqual(expect.objectContaining(expectedData))
  }
}

// Rate limit test helper
export const testRateLimit = async (
  apiFunction: (request: NextRequest) => Promise<Response>,
  requestBuilder: () => NextRequest,
  limit: number
) => {
  const responses = []
  
  // Make requests up to the limit
  for (let i = 0; i < limit; i++) {
    const response = await apiFunction(requestBuilder())
    responses.push(response)
  }
  
  // All should succeed
  responses.forEach(response => {
    expect(response.status).toBe(200)
  })
  
  // Next request should be rate limited
  const rateLimitedResponse = await apiFunction(requestBuilder())
  expect(rateLimitedResponse.status).toBe(429)
  
  return rateLimitedResponse
}

// Authentication test helper
export const testAuthRequired = async (
  apiFunction: (request: NextRequest) => Promise<Response>,
  requestBuilder: () => NextRequest
) => {
  // Mock unauthenticated user
  const mockSupabaseNoAuth = createMockSupabaseClient({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })
    }
  })
  
  // Replace the supabase client mock temporarily
  const originalMock = require('@/lib/supabase/server')
  jest.mocked(originalMock.createClient).mockResolvedValueOnce(mockSupabaseNoAuth)
  
  const response = await apiFunction(requestBuilder())
  expect(response.status).toBe(401)
  
  return response
}

// Validation test helper
export const testValidation = async (
  apiFunction: (request: NextRequest) => Promise<Response>,
  requestBuilder: (body: any) => NextRequest,
  invalidPayloads: { payload: any; expectedError: string }[]
) => {
  for (const { payload, expectedError } of invalidPayloads) {
    const response = await apiFunction(requestBuilder(payload))
    expect(response.status).toBe(400)
    
    const responseData = await extractResponseJson(response)
    expect(responseData.error.message).toContain(expectedError)
  }
}
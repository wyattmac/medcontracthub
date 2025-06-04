/**
 * Supabase Mock for Testing
 * Provides mock implementations for Supabase client
 */

export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { 
        user: {
          id: 'user-123',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      },
      error: null
    })
  },
  from: jest.fn((table: string) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockResolvedValue({ data: [], error: null })
  })),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null })
}

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabaseClient)
}))

// Export helper to configure mock responses
export const configureMockSupabase = (config: {
  auth?: {
    user?: any | null
    error?: any
  }
  queries?: Array<{
    table: string
    method: string
    response: { data: any, error: any }
  }>
  rpc?: {
    response: { data: any, error: any }
  }
}) => {
  // Reset all mocks
  jest.clearAllMocks()

  // Configure auth mock
  if (config.auth) {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: config.auth.user },
      error: config.auth.error || null
    })
  }

  // Configure query mocks
  if (config.queries) {
    config.queries.forEach(query => {
      const chainMock = mockSupabaseClient.from(query.table)
      if (query.method && chainMock[query.method]) {
        chainMock[query.method].mockResolvedValue(query.response)
      }
    })
  }

  // Configure RPC mock
  if (config.rpc) {
    mockSupabaseClient.rpc.mockResolvedValue(config.rpc.response)
  }
}
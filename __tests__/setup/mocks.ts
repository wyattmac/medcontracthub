/**
 * Global test mocks
 * These mocks are loaded before any tests run
 */

// Mock Next.js cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    getAll: jest.fn(() => []),
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(() => false),
    delete: jest.fn()
  }))
}))

// Mock Supabase client
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
  from: jest.fn((table: string) => {
    const queryBuilder = {
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
    }
    // Special handling for the database ping test
    if (table === 'profiles' && queryBuilder.select.mock.calls.length === 0) {
      queryBuilder.select = jest.fn((columns) => {
        if (columns === 'count') {
          return queryBuilder
        }
        return queryBuilder
      })
    }
    return queryBuilder
  }),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null })
}

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
  createServiceClient: jest.fn(() => mockSupabaseClient),
  createServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient))
}))

// Mock the API logger
jest.mock('@/lib/errors/logger', () => ({
  apiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  aiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}))

// Mock rate limiting
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 3600000
  }),
  rateLimitConfigs: {
    auth: { interval: 60000, uniqueTokenPerInterval: 5 },
    api: { interval: 60000, uniqueTokenPerInterval: 100 },
    search: { interval: 60000, uniqueTokenPerInterval: 50 },
    sync: { interval: 3600000, uniqueTokenPerInterval: 10 },
    ai: { interval: 60000, uniqueTokenPerInterval: 20 }
  },
  createRateLimitHeaders: jest.fn().mockReturnValue(new Headers())
}))

// Mock CSRF protection - must be done before importing any modules that use it
jest.mock('@/lib/security/csrf', () => ({
  csrfProtection: jest.fn().mockImplementation(async () => ({
    success: true
  })),
  generateCSRFToken: jest.fn().mockReturnValue('mock-csrf-token'),
  verifyCSRFToken: jest.fn().mockReturnValue(true),
  verifyCSRFFromRequest: jest.fn().mockReturnValue(true)
}))

// Mock environment validation
jest.mock('@/lib/security/env-validator', () => ({
  validateEnvironment: jest.fn(),
  getEnv: jest.fn().mockReturnValue({
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CSRF_SECRET: 'test-csrf-secret'
  })
}))

// Mock sanitization
jest.mock('@/lib/security/sanitization', () => ({
  sanitizeRequestBody: jest.fn((body) => body),
  sanitizeText: jest.fn((text) => text),
  sanitizeBasic: jest.fn((text) => text),
  sanitizeRich: jest.fn((text) => text)
}))

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: 'Mocked AI response' }]
        })
      }
    }))
  }
})

// Mock usage tracking
jest.mock('@/lib/usage/tracker', () => ({
  withUsageCheck: jest.fn((userId, feature, units, callback) => {
    // For AI analysis, return the mocked result directly without executing callback
    if (feature === 'ai_analysis') {
      return Promise.resolve({
        matchReasoning: 'Strong NAICS match and certifications align well',
        competitionLevel: 'medium',
        winProbability: 75,
        keyRequirements: ['Medical device experience', 'FDA compliance'],
        recommendations: ['Highlight veteran status', 'Partner with local suppliers'],
        riskFactors: ['High competition', 'Complex requirements'],
        proposalStrategy: 'Focus on unique capabilities and past performance',
        estimatedEffort: 'medium',
        timelineAnalysis: '3 months until deadline, adequate time for preparation'
      })
    }
    // For other features, execute callback normally
    return callback()
  }),
  trackUsage: jest.fn().mockResolvedValue(true),
  checkUsageLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 100 })
}))
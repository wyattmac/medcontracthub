/**
 * Enhanced test helpers for API routes
 */

import { mockSupabaseClient } from '../setup/mocks'

export interface MockTableConfig {
  table: string
  method?: string
  response: { data: any; error: any }
}

/**
 * Configure mock responses for specific Supabase tables
 */
export function configureMockTables(configs: MockTableConfig[]) {
  const mocksByTable: Record<string, any> = {}
  
  configs.forEach(config => {
    if (!mocksByTable[config.table]) {
      mocksByTable[config.table] = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(config.response),
        maybeSingle: jest.fn().mockResolvedValue(config.response),
        then: jest.fn().mockResolvedValue(config.response)
      }
    }
    
    if (config.method && mocksByTable[config.table][config.method]) {
      mocksByTable[config.table][config.method].mockResolvedValue(config.response)
    }
  })
  
  mockSupabaseClient.from.mockImplementation((table: string) => {
    return mocksByTable[table] || {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null })
    }
  })
}

/**
 * Configure mock auth state
 */
export function configureMockAuth(user: any | null = null, error: any = null) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user },
    error
  })
}

/**
 * Reset all mocks to default state
 */
export function resetMocks() {
  jest.clearAllMocks()
  
  // Reset auth to default authenticated state
  configureMockAuth({
    id: 'user-123',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated'
  })
  
  // Reset RPC to default
  mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })
}
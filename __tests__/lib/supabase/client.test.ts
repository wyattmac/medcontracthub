/**
 * Supabase client tests
 */

import { createClient } from '@/lib/supabase/client'

// Mock the actual Supabase client
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis()
    }))
  }))
}))

describe('Supabase Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create client with environment variables', () => {
    const client = createClient()
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
    expect(client.from).toBeDefined()
  })

  it('should use environment variables', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    
    const client = createClient()
    expect(client).toBeDefined()
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it('should provide auth methods', () => {
    const client = createClient()
    expect(typeof client.auth.getUser).toBe('function')
    expect(typeof client.auth.signOut).toBe('function')
    expect(typeof client.auth.onAuthStateChange).toBe('function')
  })

  it('should provide database query methods', () => {
    const client = createClient()
    const query = client.from('test_table')
    
    expect(typeof query.select).toBe('function')
    expect(typeof query.insert).toBe('function')
    expect(typeof query.update).toBe('function')
    expect(typeof query.delete).toBe('function')
  })

  it('should handle missing environment variables', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Should still create client (with undefined values)
    const client = createClient()
    expect(client).toBeDefined()
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })
})
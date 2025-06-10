/**
 * Database Test Helper Utilities
 * 
 * Provides mock Supabase clients, test data factories,
 * and utility functions for database testing
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { SecurityContext } from '@/lib/db/security'

/**
 * Create a mock Supabase client with controllable responses
 */
export function createMockSupabaseClient(overrides?: Partial<MockSupabaseConfig>): SupabaseClient<Database> {
  const config: MockSupabaseConfig = {
    responses: {},
    errors: {},
    delays: {},
    ...overrides
  }

  const mockQuery = (table: string) => {
    const queryState: any = {
      table,
      filters: [],
      selections: [],
      ordering: [],
      limit: undefined,
      offset: undefined,
      single: false
    }

    const methods = {
      select: jest.fn((columns?: string) => {
        queryState.selections.push(columns || '*')
        return methods
      }),
      insert: jest.fn((data: any) => {
        queryState.operation = 'insert'
        queryState.data = data
        return methods
      }),
      update: jest.fn((data: any) => {
        queryState.operation = 'update'
        queryState.data = data
        return methods
      }),
      upsert: jest.fn((data: any, options?: any) => {
        queryState.operation = 'upsert'
        queryState.data = data
        queryState.upsertOptions = options
        return methods
      }),
      delete: jest.fn(() => {
        queryState.operation = 'delete'
        return methods
      }),
      eq: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'eq', column, value })
        return methods
      }),
      neq: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'neq', column, value })
        return methods
      }),
      gt: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'gt', column, value })
        return methods
      }),
      gte: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'gte', column, value })
        return methods
      }),
      lt: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'lt', column, value })
        return methods
      }),
      lte: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'lte', column, value })
        return methods
      }),
      in: jest.fn((column: string, values: any[]) => {
        queryState.filters.push({ type: 'in', column, values })
        return methods
      }),
      contains: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'contains', column, value })
        return methods
      }),
      is: jest.fn((column: string, value: any) => {
        queryState.filters.push({ type: 'is', column, value })
        return methods
      }),
      or: jest.fn((filters: string) => {
        queryState.filters.push({ type: 'or', filters })
        return methods
      }),
      match: jest.fn((filter: Record<string, any>) => {
        queryState.filters.push({ type: 'match', filter })
        return methods
      }),
      order: jest.fn((column: string, options?: { ascending?: boolean }) => {
        queryState.ordering.push({ column, ascending: options?.ascending ?? true })
        return methods
      }),
      limit: jest.fn((count: number) => {
        queryState.limit = count
        return methods
      }),
      range: jest.fn((from: number, to: number) => {
        queryState.offset = from
        queryState.limit = to - from + 1
        return methods
      }),
      single: jest.fn(() => {
        queryState.single = true
        return methods
      }),
      maybeSingle: jest.fn(() => {
        queryState.maybeSingle = true
        return methods
      }),
      count: jest.fn((options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) => {
        queryState.count = options?.count
        queryState.head = options?.head
        return methods
      }),
      // Execute the query
      then: jest.fn((onFulfilled?: any, onRejected?: any) => {
        const key = `${table}.${queryState.operation || 'select'}`
        
        // Check for configured error - return as { data: null, error: errorObj }
        if (config.errors[key]) {
          const response = { data: null, error: config.errors[key] }
          const promise = Promise.resolve(response)
          return promise.then(onFulfilled, onRejected)
        }

        // Check for configured response
        let response = config.responses[key] || { data: null, error: null }
        
        // Add delay if configured
        const delay = config.delays[key] || 0
        const promise = delay > 0 
          ? new Promise(resolve => setTimeout(() => resolve(response), delay))
          : Promise.resolve(response)

        return promise.then(onFulfilled, onRejected)
      })
    }

    return methods as any
  }

  const client: any = {
    from: jest.fn(mockQuery),
    auth: {
      getUser: jest.fn(() => 
        Promise.resolve(config.user || { data: { user: null }, error: null })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))
    },
    rpc: jest.fn((functionName: string, params?: any) => {
      const key = `rpc.${functionName}`
      if (config.errors[key]) {
        return Promise.reject(config.errors[key])
      }
      return Promise.resolve({
        data: config.responses[key] || null,
        error: null
      })
    })
  }

  return client as SupabaseClient<Database>
}

export interface MockSupabaseConfig {
  responses: Record<string, any>
  errors: Record<string, any>
  delays: Record<string, number>
  user?: any
}

/**
 * Create a security context for testing
 */
export function createTestSecurityContext(overrides?: Partial<SecurityContext>): SecurityContext {
  return {
    userId: 'test-user-id',
    companyId: 'test-company-id',
    role: 'member',
    sessionId: 'test-session-id',
    ipAddress: '127.0.0.1',
    ...overrides
  }
}

/**
 * Create error scenarios for testing
 */
export class ErrorScenarios {
  static postgresErrors = {
    uniqueViolation: {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Key (email)=(test@example.com) already exists.'
    },
    foreignKeyViolation: {
      code: '23503',
      message: 'insert or update on table violates foreign key constraint',
      details: 'Key (company_id)=(invalid-id) is not present in table "companies".'
    },
    notNullViolation: {
      code: '23502',
      message: 'null value in column violates not-null constraint',
      details: 'Failing row contains null value in column "name".'
    },
    tableNotFound: {
      code: '42P01',
      message: 'relation "nonexistent_table" does not exist'
    },
    notFound: {
      code: 'PGRST116',
      message: 'The result contains 0 rows'
    }
  }

  static supabaseErrors = {
    networkError: new Error('Network request failed'),
    authError: {
      message: 'Invalid authentication credentials',
      status: 401
    },
    rateLimitError: {
      message: 'Rate limit exceeded',
      status: 429
    }
  }
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a test transaction wrapper
 */
export async function withTestTransaction<T>(
  client: SupabaseClient<Database>,
  callback: () => Promise<T>
): Promise<T> {
  // Since Supabase doesn't support transactions yet,
  // this is a placeholder that tracks operations for cleanup
  const operations: Array<() => Promise<void>> = []
  
  try {
    const result = await callback()
    return result
  } finally {
    // Cleanup operations in reverse order
    for (const cleanup of operations.reverse()) {
      try {
        await cleanup()
      } catch (error) {
        console.error('Cleanup failed:', error)
      }
    }
  }
}

/**
 * Assert query was called with expected parameters
 */
export function assertQueryCalled(
  mockClient: any,
  table: string,
  operation: string,
  filters?: any[]
) {
  expect(mockClient.from).toHaveBeenCalledWith(table)
  
  const query = mockClient.from.mock.results[0]?.value
  if (!query) {
    throw new Error(`No query found for table ${table}`)
  }

  if (operation === 'select') {
    expect(query.select).toHaveBeenCalled()
  } else if (operation === 'insert') {
    expect(query.insert).toHaveBeenCalled()
  } else if (operation === 'update') {
    expect(query.update).toHaveBeenCalled()
  } else if (operation === 'delete') {
    expect(query.delete).toHaveBeenCalled()
  }

  if (filters) {
    filters.forEach(filter => {
      if (filter.type === 'eq') {
        expect(query.eq).toHaveBeenCalledWith(filter.column, filter.value)
      }
      // Add more filter type assertions as needed
    })
  }
}

/**
 * Performance measurement helper
 */
export class PerformanceTracker {
  private marks: Map<string, number> = new Map()

  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark)
    const end = endMark ? this.marks.get(endMark) : performance.now()
    
    if (!start) {
      throw new Error(`Start mark ${startMark} not found`)
    }

    return end - start
  }

  clear(): void {
    this.marks.clear()
  }
}
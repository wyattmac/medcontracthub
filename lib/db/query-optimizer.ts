/**
 * Database Query Optimizer
 * Utilities for batching queries and optimizing database operations
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { dbLogger } from '@/lib/errors/logger'
import { DatabaseError } from '@/lib/errors/types'

/**
 * Batch loader for preventing N+1 queries
 */
export class BatchLoader<K, V> {
  private batch: Map<K, Array<(value: V | null) => void>> = new Map()
  private batchTimeout: NodeJS.Timeout | null = null
  
  constructor(
    private batchFn: (keys: K[]) => Promise<Map<K, V>>,
    private options: {
      maxBatchSize?: number
      batchWindow?: number
    } = {}
  ) {
    this.options.maxBatchSize = options.maxBatchSize || 100
    this.options.batchWindow = options.batchWindow || 10 // 10ms default
  }

  async load(key: K): Promise<V | null> {
    return new Promise((resolve) => {
      // Add to batch
      if (!this.batch.has(key)) {
        this.batch.set(key, [])
      }
      this.batch.get(key)!.push(resolve)

      // Schedule batch execution
      if (this.batch.size >= this.options.maxBatchSize!) {
        this.executeBatch()
      } else {
        this.scheduleBatch()
      }
    })
  }

  private scheduleBatch() {
    if (this.batchTimeout) return

    this.batchTimeout = setTimeout(() => {
      this.executeBatch()
    }, this.options.batchWindow)
  }

  private async executeBatch() {
    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }

    // Get current batch
    const currentBatch = this.batch
    this.batch = new Map()

    if (currentBatch.size === 0) return

    try {
      // Execute batch function
      const keys = Array.from(currentBatch.keys())
      const results = await this.batchFn(keys)

      // Resolve promises
      currentBatch.forEach((resolvers, key) => {
        const value = results.get(key) || null
        resolvers.forEach(resolve => resolve(value))
      })
    } catch (error) {
      // Reject all promises on error
      currentBatch.forEach((resolvers) => {
        resolvers.forEach(resolve => resolve(null))
      })
      dbLogger.error('Batch execution failed', error as Error)
    }
  }
}

/**
 * Create data loaders for common queries
 */
export function createDataLoaders(supabase: SupabaseClient) {
  return {
    // User loader
    userLoader: new BatchLoader<string, any>(async (userIds) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      if (error) {
        throw new DatabaseError('Failed to load users', undefined, error)
      }

      return new Map(data?.map(user => [user.id, user]) || [])
    }),

    // Company loader
    companyLoader: new BatchLoader<string, any>(async (companyIds) => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)

      if (error) {
        throw new DatabaseError('Failed to load companies', undefined, error)
      }

      return new Map(data?.map(company => [company.id, company]) || [])
    }),

    // Opportunity loader
    opportunityLoader: new BatchLoader<string, any>(async (opportunityIds) => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .in('id', opportunityIds)

      if (error) {
        throw new DatabaseError('Failed to load opportunities', undefined, error)
      }

      return new Map(data?.map(opp => [opp.id, opp]) || [])
    }),

    // Saved opportunities loader (by user)
    savedOpportunitiesLoader: new BatchLoader<string, any[]>(async (userIds) => {
      const { data, error } = await supabase
        .from('saved_opportunities')
        .select('*')
        .in('user_id', userIds)

      if (error) {
        throw new DatabaseError('Failed to load saved opportunities', undefined, error)
      }

      // Group by user_id
      const grouped = new Map<string, any[]>()
      data?.forEach(saved => {
        if (!grouped.has(saved.user_id)) {
          grouped.set(saved.user_id, [])
        }
        grouped.get(saved.user_id)!.push(saved)
      })

      return grouped
    })
  }
}

/**
 * Query batching utilities
 */
export const queryBatcher = {
  /**
   * Batch multiple queries into a single request
   */
  async batchQueries<T extends Record<string, Promise<any>>>(
    queries: T
  ): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
    const keys = Object.keys(queries) as (keyof T)[]
    const promises = keys.map(key => queries[key])
    
    const results = await Promise.all(promises)
    
    return keys.reduce((acc, key, index) => {
      acc[key] = results[index]
      return acc
    }, {} as any)
  },

  /**
   * Execute queries in parallel with concurrency control
   */
  async parallelQueries<T>(
    items: T[],
    queryFn: (item: T) => Promise<any>,
    concurrency: number = 5
  ): Promise<any[]> {
    const results: any[] = []
    const executing: Promise<void>[] = []

    for (const item of items) {
      const promise = queryFn(item).then(result => {
        results.push(result)
      })

      executing.push(promise)

      if (executing.length >= concurrency) {
        await Promise.race(executing)
        executing.splice(executing.findIndex(p => p === promise), 1)
      }
    }

    await Promise.all(executing)
    return results
  },

  /**
   * Chunk large queries
   */
  async chunkedQuery<T>(
    ids: string[],
    chunkSize: number = 100,
    queryFn: (chunk: string[]) => Promise<T[]>
  ): Promise<T[]> {
    const chunks: string[][] = []
    
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize))
    }

    const results = await Promise.all(
      chunks.map(chunk => queryFn(chunk))
    )

    return results.flat()
  }
}

/**
 * Database query optimizer
 */
export class QueryOptimizer {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Optimize opportunity queries with related data
   */
  async getOpportunitiesWithRelations(
    filters: any,
    limit: number = 25,
    offset: number = 0
  ) {
    // Single query with all relations
    let query = this.supabase
      .from('opportunities')
      .select(`
        *,
        saved_opportunities!left (
          id,
          user_id,
          created_at,
          notes,
          tags
        ),
        contract_documents!left (
          id,
          file_name,
          file_size,
          status,
          processed_at
        ),
        product_requirements!left (
          id,
          name,
          quantity,
          unit,
          specifications
        ),
        ai_analyses!left (
          id,
          analysis_type,
          result,
          created_at
        )
      `)

    // Apply filters
    if (filters.naicsCodes?.length) {
      query = query.overlaps('naics_codes', filters.naicsCodes)
    }

    if (filters.state) {
      query = query.ilike('place_of_performance_state', `%${filters.state}%`)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.searchQuery) {
      query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`)
    }

    // Pagination and ordering
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('posted_date', { ascending: false })
      .limit(limit)

    if (error) {
      throw new DatabaseError('Failed to fetch opportunities', undefined, error)
    }

    return { data, count }
  }

  /**
   * Bulk update operations
   */
  async bulkUpdate<T extends { id: string }>(
    table: string,
    updates: T[],
    onConflict?: string
  ): Promise<void> {
    if (updates.length === 0) return

    // PostgreSQL UPSERT for bulk updates
    const { error } = await this.supabase
      .from(table)
      .upsert(updates, {
        onConflict: onConflict || 'id',
        ignoreDuplicates: false
      })

    if (error) {
      throw new DatabaseError(`Bulk update failed for ${table}`, undefined, error)
    }
  }

  /**
   * Efficient count queries
   */
  async getCount(
    table: string,
    filters?: Record<string, any>
  ): Promise<number> {
    let query = this.supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value)
        } else {
          query = query.eq(key, value)
        }
      })
    }

    const { count, error } = await query

    if (error) {
      throw new DatabaseError(`Count query failed for ${table}`, undefined, error)
    }

    return count || 0
  }

  /**
   * Aggregate queries
   */
  async getAggregates(
    table: string,
    aggregates: {
      count?: boolean
      sum?: string[]
      avg?: string[]
      min?: string[]
      max?: string[]
    },
    filters?: Record<string, any>
  ): Promise<Record<string, any>> {
    // Build RPC call for custom aggregation
    const { data, error } = await this.supabase.rpc('get_aggregates', {
      p_table: table,
      p_aggregates: aggregates,
      p_filters: filters
    })

    if (error) {
      // Fallback to multiple queries if RPC not available
      return this.fallbackAggregates(table, aggregates, filters)
    }

    return data
  }

  /**
   * Fallback aggregation using multiple queries
   */
  private async fallbackAggregates(
    table: string,
    aggregates: any,
    filters?: any
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {}

    if (aggregates.count) {
      result.count = await this.getCount(table, filters)
    }

    // Note: Other aggregates would require custom RPC functions
    // or client-side calculation which is not efficient

    return result
  }
}

/**
 * Create optimized query client
 */
export function createOptimizedClient(supabase: SupabaseClient) {
  return {
    loaders: createDataLoaders(supabase),
    optimizer: new QueryOptimizer(supabase),
    batcher: queryBatcher
  }
}
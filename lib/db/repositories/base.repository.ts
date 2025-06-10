/**
 * Base Repository Class
 * 
 * Provides common database operations with built-in optimization,
 * error handling, and logging for all entity repositories
 * 
 * Uses Context7-based patterns for Supabase integration
 * Reference: /supabase/supabase - database query patterns
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { AppError, DatabaseError, NotFoundError, ValidationError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'
import { z } from 'zod'

export interface QueryOptions {
  select?: string
  orderBy?: { column: string; ascending?: boolean }[]
  limit?: number
  offset?: number
  filters?: Record<string, any>
  includes?: string[]
}

export interface PaginationOptions {
  page?: number
  pageSize?: number
  orderBy?: { column: string; ascending?: boolean }
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export interface TransactionOptions {
  isolationLevel?: 'read_committed' | 'repeatable_read' | 'serializable'
}

export abstract class BaseRepository<
  TTable extends keyof Database['public']['Tables'],
  TRow = Database['public']['Tables'][TTable]['Row'],
  TInsert = Database['public']['Tables'][TTable]['Insert'],
  TUpdate = Database['public']['Tables'][TTable]['Update']
> {
  protected readonly tableName: TTable
  protected readonly defaultSelect: string = '*'
  protected readonly logger = dbLogger
  
  constructor(
    protected readonly supabase: SupabaseClient<Database>,
    tableName: TTable
  ) {
    this.tableName = tableName
  }

  /**
   * Get a single record by ID
   */
  async findById(id: string, options?: QueryOptions): Promise<TRow | null> {
    try {
      const query = this.buildQuery(
        this.supabase.from(this.tableName).select(options?.select || this.defaultSelect),
        options
      ).eq('id', id).single()

      const { data, error } = await query

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw this.handleError(error, 'findById', { id })
      }

      return data as TRow
    } catch (error) {
      throw this.handleError(error, 'findById', { id })
    }
  }

  /**
   * Get all records with optional filtering and pagination
   */
  async findAll(options?: QueryOptions): Promise<TRow[]> {
    try {
      const query = this.buildQuery(
        this.supabase.from(this.tableName).select(options?.select || this.defaultSelect),
        options
      )

      const { data, error } = await query

      if (error) {
        throw this.handleError(error, 'findAll', { options })
      }

      return (data || []) as TRow[]
    } catch (error) {
      throw this.handleError(error, 'findAll', { options })
    }
  }

  /**
   * Get paginated records
   */
  async findPaginated(options: PaginationOptions = {}): Promise<PaginatedResult<TRow>> {
    const { page = 1, pageSize = 20, orderBy } = options
    const offset = (page - 1) * pageSize

    try {
      // Get total count
      const countQuery = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })

      const { count, error: countError } = await countQuery

      if (countError) {
        throw this.handleError(countError, 'findPaginated.count', { options })
      }

      // Get paginated data
      const dataQuery = this.buildQuery(
        this.supabase.from(this.tableName).select(this.defaultSelect),
        {
          limit: pageSize,
          offset,
          orderBy: orderBy ? [orderBy] : undefined
        }
      )

      const { data, error: dataError } = await dataQuery

      if (dataError) {
        throw this.handleError(dataError, 'findPaginated.data', { options })
      }

      const total = count || 0
      const totalPages = Math.ceil(total / pageSize)

      return {
        data: (data || []) as TRow[],
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      }
    } catch (error) {
      throw this.handleError(error, 'findPaginated', { options })
    }
  }

  /**
   * Create a new record
   */
  async create(data: TInsert): Promise<TRow> {
    try {
      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select(this.defaultSelect)
        .single()

      if (error) {
        throw this.handleError(error, 'create', { data })
      }

      this.logger.info(`Created ${String(this.tableName)} record`, { 
        id: (created as any).id 
      })

      return created as TRow
    } catch (error) {
      throw this.handleError(error, 'create', { data })
    }
  }

  /**
   * Create multiple records
   */
  async createMany(data: TInsert[]): Promise<TRow[]> {
    if (data.length === 0) return []

    try {
      const { data: created, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select(this.defaultSelect)

      if (error) {
        throw this.handleError(error, 'createMany', { count: data.length })
      }

      this.logger.info(`Created ${data.length} ${String(this.tableName)} records`)

      return (created || []) as TRow[]
    } catch (error) {
      throw this.handleError(error, 'createMany', { count: data.length })
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: TUpdate): Promise<TRow> {
    try {
      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select(this.defaultSelect)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`${String(this.tableName)} not found`)
        }
        throw this.handleError(error, 'update', { id, data })
      }

      this.logger.info(`Updated ${String(this.tableName)} record`, { id })

      return updated as TRow
    } catch (error) {
      throw this.handleError(error, 'update', { id, data })
    }
  }

  /**
   * Update multiple records
   */
  async updateMany(filter: Record<string, any>, data: TUpdate): Promise<TRow[]> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .update(data)

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value)
      })

      const { data: updated, error } = await query.select(this.defaultSelect)

      if (error) {
        throw this.handleError(error, 'updateMany', { filter, data })
      }

      this.logger.info(`Updated ${updated?.length || 0} ${String(this.tableName)} records`)

      return (updated || []) as TRow[]
    } catch (error) {
      throw this.handleError(error, 'updateMany', { filter, data })
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(`${String(this.tableName)} not found`)
        }
        throw this.handleError(error, 'delete', { id })
      }

      this.logger.info(`Deleted ${String(this.tableName)} record`, { id })
    } catch (error) {
      throw this.handleError(error, 'delete', { id })
    }
  }

  /**
   * Delete multiple records
   */
  async deleteMany(filter: Record<string, any>): Promise<number> {
    try {
      // First count records to be deleted
      const { count } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .match(filter)

      let query = this.supabase.from(this.tableName).delete()

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value)
      })

      const { error } = await query

      if (error) {
        throw this.handleError(error, 'deleteMany', { filter })
      }

      this.logger.info(`Deleted ${count || 0} ${String(this.tableName)} records`)

      return count || 0
    } catch (error) {
      throw this.handleError(error, 'deleteMany', { filter })
    }
  }

  /**
   * Check if a record exists
   */
  async exists(filter: Record<string, any>): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .match(filter)

      if (error) {
        throw this.handleError(error, 'exists', { filter })
      }

      return (count || 0) > 0
    } catch (error) {
      throw this.handleError(error, 'exists', { filter })
    }
  }

  /**
   * Count records with optional filtering
   */
  async count(filter?: Record<string, any>): Promise<number> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })

      if (filter) {
        query = query.match(filter)
      }

      const { count, error } = await query

      if (error) {
        throw this.handleError(error, 'count', { filter })
      }

      return count || 0
    } catch (error) {
      throw this.handleError(error, 'count', { filter })
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: SupabaseClient<Database>) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    // Note: Supabase doesn't support client-side transactions
    // This is a placeholder for future implementation when Supabase adds support
    // For now, we execute the callback with the regular client
    try {
      this.logger.debug('Executing pseudo-transaction', { 
        table: this.tableName,
        isolationLevel: options?.isolationLevel 
      })
      
      return await callback(this.supabase)
    } catch (error) {
      throw this.handleError(error, 'transaction')
    }
  }

  /**
   * Build query with common options
   */
  protected buildQuery(query: any, options?: QueryOptions): any {
    if (!options) return query

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value === null) {
          query = query.is(key, null)
        } else if (Array.isArray(value)) {
          query = query.in(key, value)
        } else {
          query = query.eq(key, value)
        }
      })
    }

    // Apply ordering
    if (options.orderBy) {
      options.orderBy.forEach(({ column, ascending = true }) => {
        query = query.order(column, { ascending })
      })
    }

    // Apply pagination
    if (options.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options.offset !== undefined) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    return query
  }

  /**
   * Handle and transform database errors
   */
  protected handleError(error: any, operation: string, context?: any): Error {
    this.logger.error(`Database error in ${String(this.tableName)}.${operation}`, error, context)

    if (error instanceof AppError) {
      return error
    }

    // Handle specific Postgres error codes
    if (error.code) {
      switch (error.code) {
        case '23505': // Unique violation
          return new DatabaseError(
            'A record with this value already exists',
            'UNIQUE_VIOLATION',
            { operation, table: this.tableName, ...context }
          )
        case '23503': // Foreign key violation
          return new DatabaseError(
            'Referenced record does not exist',
            'FOREIGN_KEY_VIOLATION',
            { operation, table: this.tableName, ...context }
          )
        case '23502': // Not null violation
          return new DatabaseError(
            'Required field is missing',
            'NOT_NULL_VIOLATION',
            { operation, table: this.tableName, ...context }
          )
        case '42P01': // Undefined table
          return new DatabaseError(
            'Database table not found',
            'TABLE_NOT_FOUND',
            { operation, table: this.tableName, ...context }
          )
        default:
          return new DatabaseError(
            error.message || 'Database operation failed',
            error.code,
            { operation, table: this.tableName, ...context }
          )
      }
    }

    return new DatabaseError(
      'An unexpected database error occurred',
      'UNKNOWN',
      { operation, table: this.tableName, originalError: error, ...context }
    )
  }

  /**
   * Validate data using Zod schema
   */
  protected async validate<T>(data: unknown, schema: z.ZodSchema<T>): Promise<T> {
    try {
      return await schema.parseAsync(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Data validation failed', error.errors)
      }
      throw error
    }
  }
}

// Type guard for checking if error has a code
interface PostgresError {
  code: string
  message: string
  details?: string
  hint?: string
}

function isPostgresError(error: any): error is PostgresError {
  return error && typeof error.code === 'string'
}
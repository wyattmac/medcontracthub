/**
 * Database Connection Pool Manager
 * Optimizes Supabase connections for high-traffic scenarios
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { dbLogger } from '@/lib/errors/logger'

interface IPoolOptions {
  maxConnections?: number
  minConnections?: number
  connectionTimeout?: number
  idleTimeout?: number
  maxRetries?: number
}

interface IPooledConnection {
  client: SupabaseClient
  id: string
  inUse: boolean
  lastUsed: number
  created: number
}

/**
 * Connection Pool for Supabase clients
 */
export class SupabaseConnectionPool {
  private connections: Map<string, IPooledConnection> = new Map()
  private waitingQueue: Array<(client: SupabaseClient) => void> = []
  private options: Required<IPoolOptions>
  private cleanupInterval?: NodeJS.Timeout

  constructor(
    private supabaseUrl: string,
    private supabaseKey: string,
    options: IPoolOptions = {}
  ) {
    this.options = {
      maxConnections: options.maxConnections || 10,
      minConnections: options.minConnections || 2,
      connectionTimeout: options.connectionTimeout || 30000, // 30 seconds
      idleTimeout: options.idleTimeout || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3
    }

    // Initialize minimum connections
    this.initializePool()

    // Start cleanup interval
    this.startCleanup()
  }

  /**
   * Initialize the connection pool
   */
  private async initializePool() {
    for (let i = 0; i < this.options.minConnections; i++) {
      this.createConnection()
    }
    dbLogger.info('Connection pool initialized', {
      minConnections: this.options.minConnections
    })
  }

  /**
   * Create a new connection
   */
  private createConnection(): IPooledConnection {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const client = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'x-connection-id': id
        }
      },
      db: {
        schema: 'public'
      }
    })

    const connection: IPooledConnection = {
      client,
      id,
      inUse: false,
      lastUsed: Date.now(),
      created: Date.now()
    }

    this.connections.set(id, connection)
    
    dbLogger.debug('Created new connection', { id })
    
    return connection
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<SupabaseClient> {
    // Try to find an available connection
    for (const [id, conn] of this.connections) {
      if (!conn.inUse) {
        conn.inUse = true
        conn.lastUsed = Date.now()
        dbLogger.debug('Acquired connection from pool', { id })
        return conn.client
      }
    }

    // If pool is not at max capacity, create new connection
    if (this.connections.size < this.options.maxConnections) {
      const conn = this.createConnection()
      conn.inUse = true
      return conn.client
    }

    // Otherwise, wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.indexOf(resolve)
        if (index > -1) {
          this.waitingQueue.splice(index, 1)
        }
        reject(new Error('Connection timeout - pool exhausted'))
      }, this.options.connectionTimeout)

      const wrappedResolve = (client: SupabaseClient) => {
        clearTimeout(timeout)
        resolve(client)
      }

      this.waitingQueue.push(wrappedResolve)
      
      dbLogger.warn('Connection pool exhausted, request queued', {
        poolSize: this.connections.size,
        queueLength: this.waitingQueue.length
      })
    })
  }

  /**
   * Release a connection back to the pool
   */
  release(client: SupabaseClient): void {
    // Find the connection
    let connectionId: string | null = null
    
    for (const [id, conn] of this.connections) {
      if (conn.client === client) {
        connectionId = id
        break
      }
    }

    if (!connectionId) {
      dbLogger.warn('Attempted to release unknown connection')
      return
    }

    const conn = this.connections.get(connectionId)!
    conn.inUse = false
    conn.lastUsed = Date.now()

    dbLogger.debug('Released connection to pool', { id: connectionId })

    // Check if anyone is waiting for a connection
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift()!
      conn.inUse = true
      resolve(conn.client)
    }
  }

  /**
   * Execute a function with a pooled connection
   */
  async withConnection<T>(
    fn: (client: SupabaseClient) => Promise<T>,
    retries: number = this.options.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      let client: SupabaseClient | null = null

      try {
        client = await this.acquire()
        const result = await fn(client)
        return result
      } catch (error) {
        lastError = error as Error
        dbLogger.warn('Connection execution failed', lastError, {
          attempt: attempt + 1,
          maxRetries: retries
        })
        
        // Wait before retry (exponential backoff)
        if (attempt < retries - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          )
        }
      } finally {
        if (client) {
          this.release(client)
        }
      }
    }

    throw lastError || new Error('Connection execution failed')
  }

  /**
   * Start cleanup interval
   */
  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000) // Run every minute
  }

  /**
   * Clean up idle connections
   */
  private cleanup() {
    const now = Date.now()
    const connectionsToRemove: string[] = []

    for (const [id, conn] of this.connections) {
      // Skip connections in use
      if (conn.inUse) continue

      // Skip if we're at minimum connections
      if (this.connections.size <= this.options.minConnections) break

      // Remove idle connections
      if (now - conn.lastUsed > this.options.idleTimeout) {
        connectionsToRemove.push(id)
      }
    }

    for (const id of connectionsToRemove) {
      this.connections.delete(id)
      dbLogger.debug('Removed idle connection', { id })
    }

    if (connectionsToRemove.length > 0) {
      dbLogger.info('Cleaned up idle connections', {
        removed: connectionsToRemove.length,
        remaining: this.connections.size
      })
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    let inUse = 0
    let idle = 0

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        inUse++
      } else {
        idle++
      }
    }

    return {
      total: this.connections.size,
      inUse,
      idle,
      waiting: this.waitingQueue.length,
      maxConnections: this.options.maxConnections,
      minConnections: this.options.minConnections
    }
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Clear waiting queue
    for (const resolve of this.waitingQueue) {
      resolve(null as any) // Force resolve with null
    }
    this.waitingQueue = []

    // Clear connections
    this.connections.clear()

    dbLogger.info('Connection pool closed')
  }
}

// Singleton instance
let poolInstance: SupabaseConnectionPool | null = null

/**
 * Get or create connection pool
 */
export function getConnectionPool(): SupabaseConnectionPool {
  if (!poolInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Supabase configuration missing')
    }

    poolInstance = new SupabaseConnectionPool(url, key, {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000')
    })
  }

  return poolInstance
}

/**
 * Execute with pooled connection
 */
export async function withPooledConnection<T>(
  fn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool()
  return pool.withConnection(fn)
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    if (poolInstance) {
      await poolInstance.close()
    }
  })
}
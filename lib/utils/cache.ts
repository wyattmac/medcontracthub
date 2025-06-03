/**
 * In-memory cache utility for API responses and expensive computations
 * Reduces database load and improves response times
 */

interface ICacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

export class MemoryCache {
  private cache: Map<string, ICacheEntry<any>>
  private maxSize: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(maxSize = 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    
    // Start cleanup process every 5 minutes
    this.startCleanup()
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data as T
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  set<T>(key: string, data: T, ttlSeconds = 300): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttlSeconds * 1000)
    })
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear entries matching a pattern
   */
  clearPattern(pattern: string | RegExp): number {
    let deletedCount = 0
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deletedCount++
      }
    }
    
    return deletedCount
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalSize = 0
    let expiredCount = 0
    const now = Date.now()
    
    for (const [, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredCount++
      }
      // Rough estimate of memory usage
      totalSize += JSON.stringify(entry.data).length
    }
    
    return {
      entries: this.cache.size,
      expiredEntries: expiredCount,
      approximateSizeBytes: totalSize,
      hitRate: this.calculateHitRate()
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          this.cache.delete(key)
        }
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Stop cleanup process
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }

  // Track hits and misses for monitoring
  private hits = 0
  private misses = 0

  private calculateHitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 0 : (this.hits / total) * 100
  }

  /**
   * Wrapper to track cache hits/misses
   */
  getWithStats<T>(key: string): T | null {
    const result = this.get<T>(key)
    if (result !== null) {
      this.hits++
    } else {
      this.misses++
    }
    return result
  }
}

/**
 * Create cache key from request parameters
 */
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  // Sort parameters for consistent key generation
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        acc[key] = params[key]
      }
      return acc
    }, {} as Record<string, any>)
  
  return `${prefix}:${JSON.stringify(sortedParams)}`
}

/**
 * Decorator for caching function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    ttlSeconds?: number
    keyGenerator?: (...args: Parameters<T>) => string
    cache?: MemoryCache
  } = {}
): T {
  const cache = options.cache || new MemoryCache()
  const ttl = options.ttlSeconds || 300
  const generateKey = options.keyGenerator || ((...args) => JSON.stringify(args))
  
  return ((...args: Parameters<T>) => {
    const key = generateKey(...args)
    const cached = cache.get(key)
    
    if (cached !== null) {
      return cached
    }
    
    const result = fn(...args)
    
    // Handle promises
    if (result instanceof Promise) {
      return result.then(data => {
        cache.set(key, data, ttl)
        return data
      })
    }
    
    cache.set(key, result, ttl)
    return result
  }) as T
}

// Global cache instances for different purposes
export const apiCache = new MemoryCache(500)
export const analysisCache = new MemoryCache(100)
export const searchCache = new MemoryCache(200)

// Clean up on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    apiCache.destroy()
    analysisCache.destroy()
    searchCache.destroy()
  })
}
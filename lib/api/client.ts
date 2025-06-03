/**
 * API Client Utilities with Timeout Handling
 */

export interface ApiClientConfig {
  timeout?: number
  retries?: number
  baseUrl?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Enhanced fetch with timeout and retry logic
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408)
    }
    
    throw error
  }
}

/**
 * API client with automatic retries and timeout handling
 */
export class ApiClient {
  private config: Required<ApiClientConfig>
  
  constructor(config: ApiClientConfig = {}) {
    this.config = {
      timeout: 30000,
      retries: 2,
      baseUrl: '',
      ...config
    }
  }
  
  async request<T>(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    const timeout = options.timeout || this.config.timeout
    
    let lastError: Error
    
    // Retry logic
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const { timeout: _, ...cleanOptions } = options
        const response = await fetchWithTimeout(url, {
          ...cleanOptions,
          timeout,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        })
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new ApiError(
            `HTTP ${response.status}: ${errorText}`,
            response.status,
            response
          )
        }
        
        // Handle JSON responses with timeout
        const data = await Promise.race([
          response.json(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('JSON parsing timeout')), 10000)
          )
        ])
        
        return data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // Don't retry on 4xx errors or last attempt
        if (
          (error instanceof ApiError && error.status >= 400 && error.status < 500) ||
          attempt === this.config.retries
        ) {
          break
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }
  
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }
  
  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

// Default API client instance
export const apiClient = new ApiClient({
  timeout: 30000,
  retries: 2
})

// Health check utility
export async function checkApiHealth(): Promise<{
  healthy: boolean
  responseTime: number
  error?: string
}> {
  const startTime = Date.now()
  
  try {
    await apiClient.get('/api/health')
    return {
      healthy: true,
      responseTime: Date.now() - startTime
    }
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
/**
 * Application Logger
 * Provides structured logging with different levels and contexts
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface ILogContext {
  [key: string]: any
}

interface ILogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: ILogContext
  error?: any
  stack?: string
}

class Logger {
  private serviceName: string
  private isDevelopment: boolean

  constructor(serviceName: string) {
    this.serviceName = serviceName
    this.isDevelopment = process.env.NODE_ENV !== 'production'
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: ILogContext,
    error?: any
  ): ILogEntry {
    const entry: ILogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.serviceName,
        environment: process.env.NODE_ENV,
        ...context
      }
    }

    if (error) {
      entry.error = error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        statusCode: (error as any).statusCode
      } : error
      
      if (error instanceof Error && error.stack) {
        entry.stack = error.stack
      }
    }

    return entry
  }

  private log(entry: ILogEntry): void {
    const output = this.isDevelopment
      ? this.formatForDevelopment(entry)
      : JSON.stringify(entry)

    switch (entry.level) {
      case 'debug':
        if (this.isDevelopment) console.debug(output)
        break
      case 'info':
        console.info(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'error':
        console.error(output)
        break
    }

    // In production, send to monitoring service
    if (!this.isDevelopment && entry.level === 'error') {
      this.sendToMonitoring(entry)
    }
  }

  private formatForDevelopment(entry: ILogEntry): string {
    const { timestamp, level, message, context, error, stack } = entry
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}]`
    
    let output = `${prefix} ${message}`
    
    if (context && Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .filter(([key]) => key !== 'service' && key !== 'environment')
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ')
      if (contextStr) output += ` | ${contextStr}`
    }
    
    if (error) {
      output += `\nError: ${JSON.stringify(error, null, 2)}`
    }
    
    if (stack && this.isDevelopment) {
      output += `\nStack: ${stack}`
    }
    
    return output
  }

  private sendToMonitoring(entry: ILogEntry): void {
    // TODO: Integrate with monitoring service
    // Example: Sentry, DataDog, CloudWatch, etc.
  }

  debug(message: string, context?: ILogContext): void {
    this.log(this.formatLogEntry('debug', message, context))
  }

  info(message: string, context?: ILogContext): void {
    this.log(this.formatLogEntry('info', message, context))
  }

  warn(message: string, context?: ILogContext): void {
    this.log(this.formatLogEntry('warn', message, context))
  }

  error(message: string, error?: any, context?: ILogContext): void {
    this.log(this.formatLogEntry('error', message, context, error))
  }

  // Utility method for timing operations
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: ILogContext
  ): Promise<T> {
    const start = Date.now()
    
    try {
      this.debug(`${operation} started`, context)
      const result = await fn()
      const duration = Date.now() - start
      this.info(`${operation} completed`, { ...context, duration })
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.error(`${operation} failed`, error, { ...context, duration })
      throw error
    }
  }
}

// Create loggers for different services
export const apiLogger = new Logger('API')
export const dbLogger = new Logger('Database')
export const authLogger = new Logger('Auth')
export const aiLogger = new Logger('AI')
export const syncLogger = new Logger('Sync')

// Default logger
export const logger = new Logger('App')
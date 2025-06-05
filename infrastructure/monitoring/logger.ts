/**
 * Centralized Logger
 * Structured logging with different levels and transports
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface ILogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  /**
   * Debug level logging
   */
  debug(message: string, context?: ILogContext) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context)
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: ILogContext) {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context)
    }
    
    if (this.isProduction) {
      // Send to logging service in production
      this.sendToLoggingService('info', message, context)
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: ILogContext) {
    console.warn(`[WARN] ${message}`, context)
    
    if (this.isProduction) {
      this.sendToLoggingService('warn', message, context)
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: any, context?: ILogContext) {
    console.error(`[ERROR] ${message}`, error, context)
    
    // Send to Sentry in production
    if (this.isProduction && error) {
      Sentry.captureException(error, {
        extra: {
          message,
          ...context
        }
      })
    }
    
    this.sendToLoggingService('error', message, {
      ...context,
      error: error?.stack || error?.message || error
    })
  }

  /**
   * Log with specific level
   */
  log(level: LogLevel, message: string, context?: ILogContext) {
    switch (level) {
      case 'debug':
        this.debug(message, context)
        break
      case 'info':
        this.info(message, context)
        break
      case 'warn':
        this.warn(message, context)
        break
      case 'error':
        this.error(message, undefined, context)
        break
    }
  }

  /**
   * Create a child logger with context
   */
  child(context: ILogContext): Logger {
    const childLogger = new Logger()
    const originalMethods = {
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger),
    }

    childLogger.debug = (message: string, ctx?: ILogContext) => {
      originalMethods.debug(message, { ...context, ...ctx })
    }

    childLogger.info = (message: string, ctx?: ILogContext) => {
      originalMethods.info(message, { ...context, ...ctx })
    }

    childLogger.warn = (message: string, ctx?: ILogContext) => {
      originalMethods.warn(message, { ...context, ...ctx })
    }

    childLogger.error = (message: string, error?: any, ctx?: ILogContext) => {
      originalMethods.error(message, error, { ...context, ...ctx })
    }

    return childLogger
  }

  /**
   * Send logs to external service
   */
  private async sendToLoggingService(
    level: LogLevel,
    message: string,
    context?: ILogContext
  ) {
    if (!this.isProduction) return

    try {
      // In production, you might send to services like:
      // - AWS CloudWatch
      // - Google Cloud Logging
      // - Datadog
      // - LogRocket
      
      // Example implementation:
      await fetch('/api/monitoring/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message,
          context,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        })
      })
    } catch (error) {
      // Don't throw errors from logging
      console.error('Failed to send log to service:', error)
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Specialized loggers
export const dbLogger = logger.child({ component: 'database' })
export const apiLogger = logger.child({ component: 'api' })
export const authLogger = logger.child({ component: 'auth' })
export const performanceLogger = logger.child({ component: 'performance' })
/**
 * Microservices Integration Test Setup
 * Provides helpers for testing all microservices in the architecture
 */

import axios, { AxiosInstance } from 'axios'
import { io, Socket } from 'socket.io-client'
import { Kafka, Producer, Consumer } from 'kafkajs'
import Redis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/errors/logger'

// Service endpoints configuration
const SERVICE_ENDPOINTS = {
  gateway: process.env.KONG_GATEWAY_URL || 'http://localhost:8080',
  app: process.env.APP_URL || 'http://localhost:3000',
  ocr: process.env.OCR_SERVICE_URL || 'http://localhost:8100',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:8200',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8300',
  realtime: process.env.REALTIME_SERVICE_URL || 'http://localhost:8400',
  worker: process.env.WORKER_SERVICE_URL || 'http://localhost:8500'
}

// Kafka configuration
const KAFKA_CONFIG = {
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  clientId: 'integration-tests'
}

export class MicroservicesTestSetup {
  private httpClients: Map<string, AxiosInstance> = new Map()
  private wsClient?: Socket
  private kafkaProducer?: Producer
  private kafkaConsumer?: Consumer
  private redisClient?: Redis
  private supabaseClient: any

  constructor() {
    this.initializeHttpClients()
    this.supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Initialize HTTP clients for all services
   */
  private initializeHttpClients() {
    Object.entries(SERVICE_ENDPOINTS).forEach(([service, url]) => {
      this.httpClients.set(service, axios.create({
        baseURL: url,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }))
    })
  }

  /**
   * Get HTTP client for a specific service
   */
  getHttpClient(service: keyof typeof SERVICE_ENDPOINTS): AxiosInstance {
    const client = this.httpClients.get(service)
    if (!client) {
      throw new Error(`HTTP client for service ${service} not found`)
    }
    return client
  }

  /**
   * Initialize WebSocket connection for real-time service
   */
  async connectWebSocket(token?: string): Promise<Socket> {
    if (this.wsClient?.connected) {
      return this.wsClient
    }

    this.wsClient = io(SERVICE_ENDPOINTS.realtime, {
      auth: token ? { token } : undefined,
      transports: ['websocket']
    })

    return new Promise((resolve, reject) => {
      this.wsClient!.on('connect', () => {
        logger.info('WebSocket connected')
        resolve(this.wsClient!)
      })

      this.wsClient!.on('connect_error', (error) => {
        logger.error('WebSocket connection error', error)
        reject(error)
      })
    })
  }

  /**
   * Initialize Kafka producer
   */
  async getKafkaProducer(): Promise<Producer> {
    if (this.kafkaProducer) {
      return this.kafkaProducer
    }

    const kafka = new Kafka(KAFKA_CONFIG)
    this.kafkaProducer = kafka.producer()
    await this.kafkaProducer.connect()
    return this.kafkaProducer
  }

  /**
   * Initialize Kafka consumer
   */
  async getKafkaConsumer(groupId: string): Promise<Consumer> {
    const kafka = new Kafka(KAFKA_CONFIG)
    const consumer = kafka.consumer({ groupId })
    await consumer.connect()
    return consumer
  }

  /**
   * Get Redis client
   */
  getRedisClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      })
    }
    return this.redisClient
  }

  /**
   * Get Supabase client
   */
  getSupabaseClient() {
    return this.supabaseClient
  }

  /**
   * Create test user and authenticate
   */
  async createTestUser(email?: string): Promise<{ user: any; token: string }> {
    const testEmail = email || `test-${Date.now()}@medcontracthub.com`
    const password = 'TestPassword123!'

    // Create user
    const { data: authData, error: authError } = await this.supabaseClient.auth.signUp({
      email: testEmail,
      password,
      options: {
        data: {
          company_name: 'Test Medical Company',
          naics_codes: ['621111', '621210']
        }
      }
    })

    if (authError) {
      throw new Error(`Failed to create test user: ${authError.message}`)
    }

    // Get session token
    const { data: sessionData } = await this.supabaseClient.auth.getSession()
    
    return {
      user: authData.user,
      token: sessionData.session?.access_token || ''
    }
  }

  /**
   * Clean up test user
   */
  async cleanupTestUser(userId: string) {
    try {
      await this.supabaseClient.auth.admin.deleteUser(userId)
    } catch (error) {
      logger.error('Failed to cleanup test user', error)
    }
  }

  /**
   * Wait for Kafka message
   */
  async waitForKafkaMessage(
    topic: string,
    filter?: (message: any) => boolean,
    timeout = 10000
  ): Promise<any> {
    const consumer = await this.getKafkaConsumer(`test-${Date.now()}`)
    await consumer.subscribe({ topic })

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        consumer.disconnect()
        reject(new Error('Timeout waiting for Kafka message'))
      }, timeout)

      consumer.run({
        eachMessage: async ({ message }) => {
          const value = JSON.parse(message.value?.toString() || '{}')
          if (!filter || filter(value)) {
            clearTimeout(timer)
            await consumer.disconnect()
            resolve(value)
          }
        }
      })
    })
  }

  /**
   * Check service health
   */
  async checkServiceHealth(service: keyof typeof SERVICE_ENDPOINTS): Promise<boolean> {
    try {
      const client = this.getHttpClient(service)
      const response = await client.get('/health')
      return response.status === 200
    } catch (error) {
      logger.error(`Service ${service} health check failed`, error)
      return false
    }
  }

  /**
   * Wait for all services to be ready
   */
  async waitForServices(services?: string[], maxRetries = 30, delay = 2000): Promise<void> {
    const servicesToCheck = services || Object.keys(SERVICE_ENDPOINTS)
    
    for (let i = 0; i < maxRetries; i++) {
      const healthChecks = await Promise.all(
        servicesToCheck.map(async (service) => ({
          service,
          healthy: await this.checkServiceHealth(service as any)
        }))
      )

      const unhealthy = healthChecks.filter(check => !check.healthy)
      
      if (unhealthy.length === 0) {
        logger.info('All services are healthy')
        return
      }

      logger.info(`Waiting for services: ${unhealthy.map(s => s.service).join(', ')}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    throw new Error('Services did not become healthy in time')
  }

  /**
   * Clean up all connections
   */
  async cleanup() {
    try {
      if (this.wsClient?.connected) {
        this.wsClient.disconnect()
      }
      if (this.kafkaProducer) {
        await this.kafkaProducer.disconnect()
      }
      if (this.redisClient) {
        this.redisClient.disconnect()
      }
    } catch (error) {
      logger.error('Cleanup error', error)
    }
  }
}

// Export singleton instance
export const testSetup = new MicroservicesTestSetup()

// Export authentication helper
export async function withAuth<T>(
  fn: (token: string, user: any) => Promise<T>
): Promise<T> {
  const { user, token } = await testSetup.createTestUser()
  try {
    return await fn(token, user)
  } finally {
    await testSetup.cleanupTestUser(user.id)
  }
}
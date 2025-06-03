#!/usr/bin/env tsx

/**
 * Queue Worker Startup Script
 * Run this to start processing background jobs
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { startWorkers } from '../lib/queue/worker'
import { checkRedisHealth } from '../lib/redis/client'
import { apiLogger } from '../lib/errors/logger'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

async function main() {
  console.log('🚀 Starting MedContractHub Queue Worker...\n')

  // Check Redis connection
  console.log('📡 Checking Redis connection...')
  const redisHealthy = await checkRedisHealth()
  
  if (!redisHealthy) {
    console.error('❌ Redis is not available. Please ensure Redis is running.')
    console.log('\nTo start Redis locally:')
    console.log('  brew services start redis')
    console.log('  # or')
    console.log('  redis-server')
    process.exit(1)
  }

  console.log('✅ Redis connection successful\n')

  // Start workers
  console.log('🏃 Starting queue workers...')
  try {
    startWorkers()
    console.log('✅ All workers started successfully\n')
    
    console.log('📊 Worker Configuration:')
    console.log(`  OCR Concurrency: ${process.env.OCR_CONCURRENCY || 2}`)
    console.log(`  Email Concurrency: ${process.env.EMAIL_CONCURRENCY || 5}`)
    console.log(`  Sync Concurrency: ${process.env.SYNC_CONCURRENCY || 1}`)
    console.log(`  Export Concurrency: ${process.env.EXPORT_CONCURRENCY || 3}`)
    console.log(`  Analytics Concurrency: ${process.env.ANALYTICS_CONCURRENCY || 2}`)
    
    console.log('\n🎯 Worker is running. Press Ctrl+C to stop.')
    console.log('📝 Logs are being written to the console.\n')

    // Keep the process alive
    process.stdin.resume()

  } catch (error) {
    console.error('❌ Failed to start workers:', error)
    process.exit(1)
  }
}

// Run the worker
main().catch((error) => {
  apiLogger.error('Worker startup failed', error)
  console.error('Fatal error:', error)
  process.exit(1)
})
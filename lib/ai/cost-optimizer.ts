/**
 * Cost Optimization Service for AI APIs
 * Manages API usage, caching, and cost tracking
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import crypto from 'crypto'
import { apiLogger } from '@/lib/errors/logger'
import { cache } from '@/lib/utils/cache'

interface ICostConfig {
  mistralOCR: {
    costPerPage: number
    maxPagesPerRequest: number
    cacheExpiryDays: number
  }
  claudeAI: {
    costPer1kInputTokens: number
    costPer1kOutputTokens: number
    maxTokensPerRequest: number
  }
  monthlyBudget: number
  alertThreshold: number // Percentage of budget
}

export class CostOptimizer {
  private supabase: ReturnType<typeof createClient<Database>>
  private config: ICostConfig = {
    mistralOCR: {
      costPerPage: 0.001, // Updated to $0.001 per page
      maxPagesPerRequest: 1000, // Updated to 1000 pages max
      cacheExpiryDays: 30
    },
    claudeAI: {
      costPer1kInputTokens: 0.003,
      costPer1kOutputTokens: 0.015,
      maxTokensPerRequest: 4000
    },
    monthlyBudget: 500, // $500/month default
    alertThreshold: 0.8 // Alert at 80% budget usage
  }

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Check if document has been processed recently
   */
  async checkDocumentCache(documentUrl: string): Promise<{
    cached: boolean
    data?: any
    cacheId?: string
  }> {
    try {
      // First check in-memory cache
      const memCacheKey = `ocr_cache_${documentUrl}`
      const memCached = cache.get(memCacheKey)
      if (memCached) {
        apiLogger.debug('Document found in memory cache', { documentUrl })
        return { cached: true, data: memCached }
      }

      // Check database cache
      const { data: cacheEntry } = await this.supabase
        .from('document_processing_cache')
        .select('*')
        .eq('document_url', documentUrl)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (cacheEntry) {
        // Update memory cache
        cache.set(memCacheKey, cacheEntry.ocr_result, 3600) // 1 hour memory cache
        
        apiLogger.info('Document found in database cache', { 
          documentUrl, 
          cacheId: cacheEntry.id,
          savedCost: this.config.mistralOCR.costPerPage * (cacheEntry.ocr_result?.pageCount || 1)
        })

        return {
          cached: true,
          data: cacheEntry.ocr_result,
          cacheId: cacheEntry.id
        }
      }

      return { cached: false }
    } catch (error) {
      apiLogger.error('Cache check failed', error as Error, { documentUrl })
      return { cached: false }
    }
  }

  /**
   * Cache processed document
   */
  async cacheDocument(
    documentUrl: string, 
    documentContent: Buffer,
    ocrResult: any,
    processingCost: number
  ): Promise<void> {
    try {
      // Generate document hash
      const documentHash = crypto
        .createHash('sha256')
        .update(documentContent)
        .digest('hex')

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + this.config.mistralOCR.cacheExpiryDays)

      await this.supabase
        .from('document_processing_cache')
        .upsert({
          document_url: documentUrl,
          document_hash: documentHash,
          ocr_result: ocrResult,
          processing_cost: processingCost,
          expires_at: expiresAt.toISOString(),
          extraction_version: '1.0'
        })

      // Also update memory cache
      const memCacheKey = `ocr_cache_${documentUrl}`
      cache.set(memCacheKey, ocrResult, 3600)

      apiLogger.info('Document cached successfully', { documentUrl, processingCost })
    } catch (error) {
      apiLogger.error('Failed to cache document', error as Error, { documentUrl })
    }
  }

  /**
   * Track API usage and costs
   */
  async trackUsage(params: {
    service: 'mistral_ocr' | 'claude_ai' | 'sam_gov'
    operation: string
    cost: number
    tokens?: number
    pages?: number
    entityType?: string
    entityId?: string
  }): Promise<void> {
    try {
      await this.supabase
        .from('api_usage_costs')
        .insert({
          service_name: params.service,
          operation_type: params.operation,
          cost_usd: params.cost,
          tokens_used: params.tokens,
          pages_processed: params.pages,
          entity_type: params.entityType,
          entity_id: params.entityId
        })

      // Check if we're approaching budget limit
      await this.checkBudgetAlert()
    } catch (error) {
      apiLogger.error('Failed to track API usage', error as Error, params)
    }
  }

  /**
   * Get current month's usage
   */
  async getCurrentMonthUsage(): Promise<{
    total: number
    byService: Record<string, number>
    percentageUsed: number
  }> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: usage } = await this.supabase
      .from('api_usage_costs')
      .select('service_name, cost_usd')
      .gte('created_at', startOfMonth.toISOString())

    const byService: Record<string, number> = {}
    let total = 0

    usage?.forEach(record => {
      byService[record.service_name] = (byService[record.service_name] || 0) + Number(record.cost_usd)
      total += Number(record.cost_usd)
    })

    return {
      total,
      byService,
      percentageUsed: (total / this.config.monthlyBudget) * 100
    }
  }

  /**
   * Check if we should alert about budget usage
   */
  private async checkBudgetAlert(): Promise<void> {
    const usage = await this.getCurrentMonthUsage()
    
    if (usage.percentageUsed >= this.config.alertThreshold * 100) {
      apiLogger.warn('API budget alert triggered', {
        currentUsage: usage.total,
        budget: this.config.monthlyBudget,
        percentageUsed: usage.percentageUsed
      })

      // TODO: Send email alert to admins
    }
  }

  /**
   * Estimate processing cost before execution
   */
  estimateOCRCost(pageCount: number): number {
    return pageCount * this.config.mistralOCR.costPerPage
  }

  /**
   * Estimate Claude AI cost
   */
  estimateClaudeCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.config.claudeAI.costPer1kInputTokens
    const outputCost = (outputTokens / 1000) * this.config.claudeAI.costPer1kOutputTokens
    return inputCost + outputCost
  }

  /**
   * Batch documents for processing to optimize API calls
   */
  async createProcessingBatch(
    documentUrls: string[],
    priority: number = 5
  ): Promise<string[]> {
    const batchIds: string[] = []

    for (const url of documentUrls) {
      // Check if already in cache
      const { cached } = await this.checkDocumentCache(url)
      if (cached) continue

      // Add to processing queue
      const { data } = await this.supabase
        .from('ocr_processing_queue')
        .insert({
          opportunity_id: '', // Will be set by processor
          document_url: url,
          priority,
          status: 'pending'
        })
        .select('id')
        .single()

      if (data) {
        batchIds.push(data.id)
      }
    }

    apiLogger.info('Processing batch created', {
      totalDocuments: documentUrls.length,
      newDocuments: batchIds.length,
      cachedDocuments: documentUrls.length - batchIds.length
    })

    return batchIds
  }

  /**
   * Get optimal batch size based on current usage
   */
  async getOptimalBatchSize(): Promise<number> {
    const usage = await this.getCurrentMonthUsage()
    const remainingBudget = this.config.monthlyBudget - usage.total
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - new Date().getDate()
    
    // Calculate daily budget remaining
    const dailyBudget = remainingBudget / Math.max(daysRemaining, 1)
    
    // Calculate batch size based on daily budget
    const batchSize = Math.floor(dailyBudget / this.config.mistralOCR.costPerPage)
    
    // Ensure minimum batch size of 10, max of configured limit
    return Math.min(
      Math.max(batchSize, 10),
      this.config.mistralOCR.maxPagesPerRequest
    )
  }

  /**
   * Get cost optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = []
    const usage = await this.getCurrentMonthUsage()

    // High usage warning
    if (usage.percentageUsed > 90) {
      recommendations.push('⚠️ API usage is over 90% of monthly budget. Consider upgrading your plan.')
    }

    // Service-specific recommendations
    if (usage.byService.mistral_ocr > usage.byService.claude_ai * 2) {
      recommendations.push('💡 OCR costs are high. Consider implementing more aggressive caching.')
    }

    if (usage.byService.claude_ai > 100) {
      recommendations.push('💡 Claude AI costs exceed $100. Review prompt efficiency and caching strategy.')
    }

    // Cache utilization
    const { data: cacheStats } = await this.supabase
      .from('document_processing_cache')
      .select('id', { count: 'exact' })

    if (cacheStats && cacheStats.length < 100) {
      recommendations.push('💡 Low cache utilization. Ensure documents are being cached properly.')
    }

    return recommendations
  }
}

// Export singleton instance
export const costOptimizer = new CostOptimizer()
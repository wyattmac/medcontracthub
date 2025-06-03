/**
 * Optimized SAM.gov Document Processor
 * Cost-effective processing with caching and batch operations
 */

import { mistralOCR } from '@/lib/ai/mistral-ocr-client'
import { costOptimizer } from '@/lib/ai/cost-optimizer'
import { Database } from '@/types/database.types'
import { createClient } from '@supabase/supabase-js'
import { ExternalAPIError, DatabaseError } from '@/lib/errors/types'
import { syncLogger } from '@/lib/errors/logger'
import crypto from 'crypto'

interface IProcessingOptions {
  priority?: number
  batchSize?: number
  skipCache?: boolean
  maxRetries?: number
}

interface IProcessingResult {
  documentId: string
  fileName: string
  cached: boolean
  requirements: any[]
  processingTime: number
  cost: number
}

export class OptimizedDocumentProcessor {
  private supabase: ReturnType<typeof createClient<Database>>
  private processingQueue: Array<{ opportunityId: string; documentUrl: string; priority: number }> = []
  private isProcessing: boolean = false

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Process opportunity documents with optimization
   */
  async processOpportunity(
    opportunityId: string,
    options: IProcessingOptions = {}
  ): Promise<{
    results: IProcessingResult[]
    totalCost: number
    cachedCount: number
    processedCount: number
  }> {
    const {
      priority = 5,
      batchSize,
      skipCache = false,
      maxRetries = 3
    } = options

    try {
      // Get opportunity and its documents
      const { data: opportunity, error } = await this.supabase
        .from('opportunities')
        .select('*, contract_documents(*)')
        .eq('id', opportunityId)
        .single()

      if (error || !opportunity) {
        throw new DatabaseError('Opportunity not found')
      }

      const resourceLinks = opportunity.additional_info?.resourceLinks || []
      if (resourceLinks.length === 0) {
        return {
          results: [],
          totalCost: 0,
          cachedCount: 0,
          processedCount: 0
        }
      }

      // Get optimal batch size if not specified
      const optimalBatchSize = batchSize || await costOptimizer.getOptimalBatchSize()
      
      const results: IProcessingResult[] = []
      let totalCost = 0
      let cachedCount = 0
      let processedCount = 0

      // Process documents in batches
      for (let i = 0; i < resourceLinks.length; i += optimalBatchSize) {
        const batch = resourceLinks.slice(i, i + optimalBatchSize)
        
        for (const documentUrl of batch) {
          const result = await this.processDocument(
            opportunityId,
            documentUrl,
            { skipCache, priority }
          )

          results.push(result)
          totalCost += result.cost
          
          if (result.cached) {
            cachedCount++
          } else {
            processedCount++
          }
        }

        // Delay between batches to avoid rate limits
        if (i + optimalBatchSize < resourceLinks.length) {
          await this.delay(1000) // 1 second delay
        }
      }

      // Track total cost
      await costOptimizer.trackUsage({
        service: 'mistral_ocr',
        operation: 'opportunity_processing',
        cost: totalCost,
        entityType: 'opportunity',
        entityId: opportunityId
      })

      // Create or update sourcing report
      await this.createSourcingReport(opportunityId, results)

      syncLogger.info('Opportunity processing completed', {
        opportunityId,
        totalDocuments: resourceLinks.length,
        cachedCount,
        processedCount,
        totalCost,
        savedCost: cachedCount * 0.01 // Assuming $0.01 per page average
      })

      return {
        results,
        totalCost,
        cachedCount,
        processedCount
      }

    } catch (error) {
      syncLogger.error('Opportunity processing failed', error as Error, { opportunityId })
      throw error
    }
  }

  /**
   * Process individual document with caching
   */
  private async processDocument(
    opportunityId: string,
    documentUrl: string,
    options: { skipCache?: boolean; priority?: number }
  ): Promise<IProcessingResult> {
    const startTime = Date.now()

    // Check cache first
    if (!options.skipCache) {
      const cacheResult = await costOptimizer.checkDocumentCache(documentUrl)
      if (cacheResult.cached) {
        return {
          documentId: cacheResult.cacheId || '',
          fileName: this.extractFileName(documentUrl),
          cached: true,
          requirements: cacheResult.data?.products || [],
          processingTime: Date.now() - startTime,
          cost: 0 // No cost for cached results
        }
      }
    }

    // Download document
    const documentBuffer = await this.downloadDocument(documentUrl)
    
    // Estimate cost before processing
    const estimatedPages = Math.ceil(documentBuffer.length / 50000) // Rough estimate
    const estimatedCost = costOptimizer.estimateOCRCost(estimatedPages)

    // Process with Mistral OCR
    const ocrResult = await mistralOCR.processDocumentBuffer(
      documentBuffer,
      this.extractFileName(documentUrl)
    )

    // Calculate actual cost
    const actualPages = ocrResult.structuredData?.metadata?.pageCount || estimatedPages
    const actualCost = costOptimizer.estimateOCRCost(actualPages)

    // Cache the result
    await costOptimizer.cacheDocument(
      documentUrl,
      documentBuffer,
      ocrResult,
      actualCost
    )

    // Save to database
    const { data: documentRecord } = await this.supabase
      .from('contract_documents')
      .insert({
        opportunity_id: opportunityId,
        file_name: this.extractFileName(documentUrl),
        file_url: documentUrl,
        file_type: 'application/pdf',
        file_size: documentBuffer.length,
        ocr_status: 'completed',
        ocr_result: ocrResult,
        extracted_requirements: ocrResult.structuredData?.products || []
      })
      .select()
      .single()

    // Extract and save requirements
    if (documentRecord && ocrResult.structuredData?.products) {
      await this.saveProductRequirements(
        documentRecord.id,
        ocrResult.structuredData.products
      )
    }

    return {
      documentId: documentRecord?.id || '',
      fileName: this.extractFileName(documentUrl),
      cached: false,
      requirements: ocrResult.structuredData?.products || [],
      processingTime: Date.now() - startTime,
      cost: actualCost
    }
  }

  /**
   * Save extracted product requirements
   */
  private async saveProductRequirements(
    documentId: string,
    products: any[]
  ): Promise<void> {
    const requirements = products.map(product => ({
      document_id: documentId,
      product_name: product.name || 'Unknown Product',
      specifications: product.specifications || {},
      quantity: parseInt(product.quantity) || 0,
      unit: product.unit || 'EA',
      required_certifications: product.certifications || [],
      required_standards: product.standards || [],
      packaging_requirements: product.packaging,
      delivery_date: product.deliveryDate ? new Date(product.deliveryDate).toISOString() : null
    }))

    if (requirements.length > 0) {
      const { error } = await this.supabase
        .from('product_requirements')
        .insert(requirements)

      if (error) {
        syncLogger.error('Failed to save product requirements', error)
      }
    }
  }

  /**
   * Create sourcing report
   */
  private async createSourcingReport(
    opportunityId: string,
    results: IProcessingResult[]
  ): Promise<void> {
    const totalRequirements = results.reduce(
      (sum, r) => sum + r.requirements.length,
      0
    )

    const reportData = {
      processedDocuments: results.map(r => ({
        documentId: r.documentId,
        fileName: r.fileName,
        cached: r.cached,
        requirementsFound: r.requirements.length,
        processingTimeMs: r.processingTime,
        cost: r.cost
      })),
      totalCost: results.reduce((sum, r) => sum + r.cost, 0),
      cachedDocuments: results.filter(r => r.cached).length,
      processingCompleted: new Date().toISOString()
    }

    await this.supabase
      .from('sourcing_reports')
      .upsert({
        opportunity_id: opportunityId,
        document_id: results[0]?.documentId,
        total_requirements: totalRequirements,
        requirements_sourced: 0,
        report_data: reportData
      })
  }

  /**
   * Download document from SAM.gov
   */
  private async downloadDocument(resourceUrl: string): Promise<Buffer> {
    const apiKey = process.env.SAM_GOV_API_KEY!
    const url = new URL(resourceUrl)
    url.searchParams.append('api_key', apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new ExternalAPIError('SAM.gov', `Download failed: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer)
  }

  /**
   * Extract filename from URL
   */
  private extractFileName(url: string): string {
    const urlParts = url.split('/')
    const fileId = urlParts[urlParts.length - 2]
    return `sam_doc_${fileId}.pdf`
  }

  /**
   * Add documents to processing queue (simple in-memory implementation)
   */
  async queueDocuments(
    opportunityId: string,
    documentUrls: string[],
    priority: number = 5
  ): Promise<string[]> {
    const jobIds: string[] = []

    for (const url of documentUrls) {
      const jobId = crypto.randomUUID()
      this.processingQueue.push({ opportunityId, documentUrl: url, priority })
      jobIds.push(jobId)
    }

    // Sort by priority
    this.processingQueue.sort((a, b) => b.priority - a.priority)
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue()
    }

    return jobIds
  }

  /**
   * Process queued documents
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.processingQueue.length > 0) {
      const job = this.processingQueue.shift()
      if (!job) continue

      try {
        await this.processDocument(job.opportunityId, job.documentUrl, {})
      } catch (error) {
        syncLogger.error('Queue processing failed', error as Error, job)
      }

      // Small delay between processing
      await this.delay(500)
    }

    this.isProcessing = false
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(days: number = 30): Promise<{
    totalDocuments: number
    cachedDocuments: number
    totalCost: number
    averageProcessingTime: number
    cacheHitRate: number
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get processed documents
    const { data: documents, count } = await this.supabase
      .from('contract_documents')
      .select('*', { count: 'exact' })
      .gte('created_at', since.toISOString())

    // Get cached documents
    const { count: cachedCount } = await this.supabase
      .from('document_processing_cache')
      .select('*', { count: 'exact' })
      .gte('created_at', since.toISOString())

    // Get costs
    const { data: costs } = await this.supabase
      .from('api_usage_costs')
      .select('cost_usd')
      .eq('service_name', 'mistral_ocr')
      .gte('created_at', since.toISOString())

    const totalCost = costs?.reduce((sum, c) => sum + Number(c.cost_usd), 0) || 0
    const cacheHitRate = count && cachedCount ? (cachedCount / count) * 100 : 0

    return {
      totalDocuments: count || 0,
      cachedDocuments: cachedCount || 0,
      totalCost,
      averageProcessingTime: 0, // Would need to track this
      cacheHitRate
    }
  }
}

// Export singleton instance
export const optimizedProcessor = new OptimizedDocumentProcessor()

// Export for testing
export { OptimizedDocumentProcessor }
/**
 * Optimized SAM.gov Document Processor
 * Cost-effective processing with caching and batch operations
 */

import { mistralDocumentOCR } from '@/lib/ai/mistral-document-ocr-client'
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

class OptimizedDocumentProcessor {
  private supabase: ReturnType<typeof createClient<Database>>
  private processingQueue: Array<{ opportunityId: string; companyId: string; documentUrl: string; priority: number }> = []
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
      // Get opportunity with saved_opportunity to get company_id
      const { data: opportunity, error } = await this.supabase
        .from('opportunities')
        .select(`
          *,
          contract_documents(*),
          saved_opportunities!inner(
            id,
            company_id
          )
        `)
        .eq('id', opportunityId)
        .single()

      if (error || !opportunity) {
        throw new DatabaseError('Opportunity not found')
      }

      // Get company_id from saved_opportunity
      const companyId = opportunity.saved_opportunities?.[0]?.company_id
      if (!companyId) {
        throw new DatabaseError('Company ID not found for opportunity')
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
            companyId,
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
      await this.createSourcingReport(opportunityId, companyId, results)

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
    companyId: string,
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
          requirements: cacheResult.data?.structuredData?.products || cacheResult.data?.products || [],
          processingTime: Date.now() - startTime,
          cost: 0 // No cost for cached results
        }
      }
    }

    // Download document
    const documentBuffer = await this.downloadDocument(documentUrl)
    const fileName = this.extractFileName(documentUrl)
    
    // Use new Mistral Document OCR with native PDF support
    const ocrResult = await mistralDocumentOCR.processDocument(
      { buffer: documentBuffer, fileName },
      { 
        structuredOutput: true,
        includeImageBase64: false // Don't need images for product extraction
      }
    )

    // Calculate actual cost ($0.001 per page)
    const actualCost = mistralDocumentOCR.calculateCost(ocrResult.metadata.pageCount)

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
        company_id: companyId,
        file_name: fileName,
        file_url: documentUrl,
        file_type: 'application/pdf',
        file_size: documentBuffer.length,
        ocr_status: 'completed',
        ocr_result: {
          pages: ocrResult.pages.length,
          metadata: ocrResult.metadata,
          structuredData: ocrResult.structuredData
        },
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
    companyId: string,
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
        company_id: companyId,
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
    
    // Check if it's a PDF
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('pdf')) {
      syncLogger.warn('PDF documents require conversion to images for OCR processing', { resourceUrl })
      // For now, we'll process PDFs as-is, but in production we'd convert to images
    }
    
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
    companyId: string,
    documentUrls: string[],
    priority: number = 5
  ): Promise<string[]> {
    const jobIds: string[] = []

    for (const url of documentUrls) {
      const jobId = crypto.randomUUID()
      this.processingQueue.push({ opportunityId, companyId, documentUrl: url, priority })
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
        await this.processDocument(job.opportunityId, job.companyId, job.documentUrl, {})
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
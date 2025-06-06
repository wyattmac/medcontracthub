/**
 * Smart Document Processing Pipeline
 * Optimizes data usage for OCR + AI bid writing workflows
 * Designed to minimize storage costs while maximizing processing efficiency
 */

import { createServiceClient } from '@/lib/supabase/server'
import { createSAMDocumentManager } from '@/lib/sam-gov/document-manager'
import { apiLogger } from '@/lib/errors/logger'
import { ExternalServiceError } from '@/lib/errors/types'

interface ProcessingOptions {
  priority: 'low' | 'medium' | 'high' | 'critical'
  maxFileSize: number
  ocrLanguages: string[]
  aiAnalysisDepth: 'summary' | 'detailed' | 'comprehensive'
  retentionDays: number
  autoCleanup: boolean
}

interface ProcessingResult {
  documentId: string
  ocrText: string
  aiAnalysis: any
  processingCost: {
    ocrCostUSD: number
    aiCostUSD: number
    storageCostUSD: number
    totalCostUSD: number
  }
  confidence: {
    ocrAccuracy: number
    aiRelevance: number
  }
  processedAt: string
  expiresAt: string
}

interface StorageStrategy {
  originalFile: 'delete' | 'archive' | 'keep'
  ocrResults: 'cache_24h' | 'cache_7d' | 'permanent'
  aiAnalysis: 'cache_30d' | 'permanent'
  intermediateFiles: 'delete_immediate' | 'delete_1h'
}

export class SmartProcessingPipeline {
  private supabase = createServiceClient()
  private documentManager = createSAMDocumentManager()

  // Cost-optimized processing strategies
  private readonly PROCESSING_STRATEGIES = {
    // High-value opportunities - comprehensive processing
    premium: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      ocrProvider: 'mistral', // $0.001/page
      aiProvider: 'claude', // Context-optimized
      storage: {
        originalFile: 'archive' as const,
        ocrResults: 'permanent' as const,
        aiAnalysis: 'permanent' as const,
        intermediateFiles: 'delete_1h' as const
      },
      retentionDays: 90
    },
    
    // Standard opportunities - balanced processing
    standard: {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      ocrProvider: 'mistral',
      aiProvider: 'claude',
      storage: {
        originalFile: 'delete' as const,
        ocrResults: 'cache_30d' as const,
        aiAnalysis: 'cache_30d' as const,
        intermediateFiles: 'delete_immediate' as const
      },
      retentionDays: 30
    },
    
    // Low-priority - minimal processing
    minimal: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ocrProvider: 'mistral',
      aiProvider: 'claude',
      storage: {
        originalFile: 'delete' as const,
        ocrResults: 'cache_7d' as const,
        aiAnalysis: 'cache_7d' as const,
        intermediateFiles: 'delete_immediate' as const
      },
      retentionDays: 7
    }
  }

  /**
   * Intelligent document processing with cost optimization
   */
  async processDocument(
    noticeId: string,
    documentId: string,
    userId: string,
    options: Partial<ProcessingOptions> = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Step 1: Check if we've already processed this document
      const existingResult = await this.getExistingProcessingResult(noticeId, documentId)
      if (existingResult && !this.isExpired(existingResult.expires_at)) {
        await this.recordProcessingUsage(userId, 'cache_hit', existingResult.processing_cost)
        return existingResult
      }

      // Step 2: Determine processing strategy based on opportunity value
      const strategy = await this.determineProcessingStrategy(noticeId, options.priority)
      
      // Step 3: Smart document filtering - only process relevant documents
      const shouldProcess = await this.shouldProcessDocument(noticeId, documentId, strategy)
      if (!shouldProcess.process) {
        throw new Error(`Document skipped: ${shouldProcess.reason}`)
      }

      // Step 4: Download document with size limits
      const downloadResult = await this.documentManager.downloadDocument(
        noticeId,
        documentId,
        userId,
        { maxSizeBytes: strategy.maxFileSize }
      )

      if (!downloadResult.success) {
        throw new Error('Document download failed')
      }

      // Step 5: OCR Processing (Mistral AI - cost-effective)
      const ocrResult = await this.performOCR(
        downloadResult.filePath!,
        downloadResult.metadata,
        strategy
      )

      // Step 6: AI Analysis (Claude - context-optimized)
      const aiAnalysis = await this.performAIAnalysis(
        ocrResult.text,
        noticeId,
        downloadResult.metadata,
        strategy
      )

      // Step 7: Calculate processing costs
      const processingCost = this.calculateProcessingCosts(
        downloadResult.metadata.fileSize || 0,
        ocrResult.pageCount,
        aiAnalysis.tokensUsed
      )

      // Step 8: Store results according to strategy
      const result = await this.storeProcessingResult(
        noticeId,
        documentId,
        userId,
        {
          ocrText: ocrResult.text,
          aiAnalysis: aiAnalysis.result,
          processingCost,
          confidence: {
            ocrAccuracy: ocrResult.confidence,
            aiRelevance: aiAnalysis.relevanceScore
          }
        },
        strategy
      )

      // Step 9: Cleanup according to strategy
      await this.performCleanup(downloadResult.filePath!, strategy.storage)

      // Step 10: Record usage for cost tracking
      await this.recordProcessingUsage(userId, 'new_processing', processingCost)

      const processingTime = Date.now() - startTime
      apiLogger.info('Document processing completed', {
        noticeId,
        documentId,
        userId,
        processingTime,
        strategy: strategy,
        cost: processingCost.totalCostUSD
      })

      return result

    } catch (error) {
      apiLogger.error('Document processing failed', error as Error, {
        noticeId,
        documentId,
        userId
      })
      throw error
    }
  }

  /**
   * Batch process multiple documents with intelligent prioritization
   */
  async batchProcessDocuments(
    noticeId: string,
    userId: string,
    options: {
      maxConcurrent?: number
      maxTotalCost?: number
      priorityFilter?: string[]
    } = {}
  ): Promise<ProcessingResult[]> {
    const { maxConcurrent = 3, maxTotalCost = 10.00, priorityFilter = [] } = options

    // Get available documents
    const documents = await this.documentManager.getAvailableDocuments(noticeId)
    
    // Filter and prioritize documents
    const prioritizedDocs = this.prioritizeDocuments(documents, priorityFilter)
    
    const results: ProcessingResult[] = []
    let totalCost = 0
    let processed = 0

    // Process in batches to control concurrency and cost
    for (let i = 0; i < prioritizedDocs.length; i += maxConcurrent) {
      const batch = prioritizedDocs.slice(i, i + maxConcurrent)
      
      const batchPromises = batch.map(async (doc) => {
        if (totalCost >= maxTotalCost) {
          apiLogger.warn('Max processing cost reached', { totalCost, maxTotalCost })
          return null
        }

        try {
          const result = await this.processDocument(noticeId, doc.id, userId)
          totalCost += result.processingCost.totalCostUSD
          processed++
          return result
        } catch (error) {
          apiLogger.warn('Document processing failed in batch', error as Error, {
            documentId: doc.id
          })
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(Boolean) as ProcessingResult[])

      // Check cost limit
      if (totalCost >= maxTotalCost) {
        break
      }
    }

    apiLogger.info('Batch processing completed', {
      noticeId,
      totalDocuments: documents.length,
      processed,
      totalCost,
      avgCostPerDoc: totalCost / Math.max(processed, 1)
    })

    return results
  }

  /**
   * Get processing cost estimates before actual processing
   */
  async estimateProcessingCosts(
    noticeId: string,
    documentIds?: string[]
  ): Promise<{
    totalEstimate: number
    breakdown: Array<{
      documentId: string
      filename: string
      estimatedCost: number
      reasoning: string
    }>
  }> {
    const documents = documentIds
      ? await Promise.all(documentIds.map(id => 
          this.documentManager.getAvailableDocuments(noticeId).then(docs => 
            docs.find(d => d.id === id)
          )
        )).then(docs => docs.filter(Boolean) as any[])
      : await this.documentManager.getAvailableDocuments(noticeId)

    const breakdown = documents.map(doc => {
      const sizeBasedCost = this.estimateCostBySize(doc.fileSize || 0, doc.fileType)
      return {
        documentId: doc.id,
        filename: doc.filename,
        estimatedCost: sizeBasedCost.total,
        reasoning: sizeBasedCost.reasoning
      }
    })

    return {
      totalEstimate: breakdown.reduce((sum, item) => sum + item.estimatedCost, 0),
      breakdown
    }
  }

  /**
   * Smart cleanup of old processing results to manage storage
   */
  async performSmartCleanup(options: {
    maxStorageGB?: number
    maxAge?: number
    preserveHighValue?: boolean
  } = {}): Promise<{ freedSpaceGB: number; itemsDeleted: number }> {
    const { maxAge = 30, preserveHighValue = true } = options

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - maxAge)

    let query = this.supabase
      .from('document_processing_results')
      .select('*')
      .lt('created_at', cutoffDate.toISOString())

    // Preserve high-value processing results
    if (preserveHighValue) {
      query = query.lt('estimated_opportunity_value', 1000000) // < $1M opportunities
    }

    const { data: oldResults, error } = await query

    if (error || !oldResults?.length) {
      return { freedSpaceGB: 0, itemsDeleted: 0 }
    }

    // Calculate storage to be freed
    const totalSize = oldResults.reduce((sum, result) => 
      sum + (result.storage_size_bytes || 0), 0
    )
    const freedSpaceGB = totalSize / (1024 * 1024 * 1024)

    // Delete old results
    const { error: deleteError } = await this.supabase
      .from('document_processing_results')
      .delete()
      .in('id', oldResults.map(r => r.id))

    if (deleteError) {
      apiLogger.error('Failed to cleanup old processing results', deleteError)
      return { freedSpaceGB: 0, itemsDeleted: 0 }
    }

    apiLogger.info('Smart cleanup completed', {
      itemsDeleted: oldResults.length,
      freedSpaceGB,
      preserveHighValue
    })

    return { freedSpaceGB, itemsDeleted: oldResults.length }
  }

  // Private helper methods

  private async determineProcessingStrategy(
    noticeId: string,
    priority?: string
  ): Promise<typeof this.PROCESSING_STRATEGIES.premium> {
    // Get opportunity details to determine value
    const { data: opportunity } = await this.supabase
      .from('opportunities')
      .select('estimated_value_max, estimated_value_min, naics_code, set_aside_type')
      .eq('notice_id', noticeId)
      .single()

    if (!opportunity) {
      return this.PROCESSING_STRATEGIES.standard
    }

    const maxValue = opportunity.estimated_value_max || 0
    const isHighValue = maxValue > 1000000 // $1M+
    const isMedicalNAICS = opportunity.naics_code?.startsWith('33') // Medical equipment
    const hasSetAside = Boolean(opportunity.set_aside_type)

    // Premium processing for high-value opportunities
    if (priority === 'critical' || (isHighValue && (isMedicalNAICS || hasSetAside))) {
      return this.PROCESSING_STRATEGIES.premium
    }

    // Minimal processing for low-value opportunities
    if (priority === 'low' || maxValue < 100000) {
      return this.PROCESSING_STRATEGIES.minimal
    }

    return this.PROCESSING_STRATEGIES.standard
  }

  private async shouldProcessDocument(
    noticeId: string,
    documentId: string,
    strategy: any
  ): Promise<{ process: boolean; reason: string }> {
    // Get document metadata
    const documents = await this.documentManager.getAvailableDocuments(noticeId)
    const doc = documents.find(d => d.id === documentId)

    if (!doc) {
      return { process: false, reason: 'Document not found' }
    }

    // Size check
    if (doc.fileSize && doc.fileSize > strategy.maxFileSize) {
      return { process: false, reason: `File too large: ${doc.fileSize} bytes` }
    }

    // File type check
    const processableTypes = ['pdf', 'doc', 'docx', 'txt']
    if (!processableTypes.includes(doc.fileType.toLowerCase())) {
      return { process: false, reason: `Unsupported file type: ${doc.fileType}` }
    }

    // Priority check
    if (doc.category === 'attachment' && !doc.isRequired) {
      return { process: false, reason: 'Non-essential attachment' }
    }

    return { process: true, reason: 'Document approved for processing' }
  }

  private prioritizeDocuments(documents: any[], priorityFilter: string[]): any[] {
    return documents
      .filter(doc => {
        if (priorityFilter.length === 0) return true
        return priorityFilter.includes(doc.category)
      })
      .sort((a, b) => {
        // Prioritize required documents
        if (a.isRequired && !b.isRequired) return -1
        if (!a.isRequired && b.isRequired) return 1
        
        // Prioritize by category importance
        const categoryPriority = {
          'solicitation': 1,
          'amendment': 2,
          'qa': 3,
          'attachment': 4,
          'other': 5
        }
        
        const aPriority = categoryPriority[a.category as keyof typeof categoryPriority] || 5
        const bPriority = categoryPriority[b.category as keyof typeof categoryPriority] || 5
        
        return aPriority - bPriority
      })
  }

  private async performOCR(
    filePath: string,
    metadata: any,
    strategy: any
  ): Promise<{ text: string; confidence: number; pageCount: number }> {
    // Implement Mistral AI OCR processing
    // This is a placeholder - you'll need to implement actual OCR
    const estimatedPages = Math.ceil((metadata.fileSize || 0) / (50 * 1024)) // ~50KB per page
    
    return {
      text: 'OCR text placeholder',
      confidence: 0.95,
      pageCount: estimatedPages
    }
  }

  private async performAIAnalysis(
    ocrText: string,
    noticeId: string,
    metadata: any,
    strategy: any
  ): Promise<{ result: any; relevanceScore: number; tokensUsed: number }> {
    // Implement Claude AI analysis
    // This is a placeholder - you'll need to implement actual AI analysis
    
    return {
      result: {
        summary: 'AI analysis placeholder',
        keyRequirements: [],
        eligibilityCriteria: [],
        submissionRequirements: []
      },
      relevanceScore: 0.85,
      tokensUsed: 1000
    }
  }

  private calculateProcessingCosts(
    fileSizeBytes: number,
    pageCount: number,
    aiTokens: number
  ): ProcessingResult['processingCost'] {
    const ocrCostUSD = pageCount * 0.001 // Mistral: $0.001 per page
    const aiCostUSD = (aiTokens / 1000) * 0.015 // Claude: ~$15 per 1M tokens
    const storageCostUSD = (fileSizeBytes / (1024 * 1024 * 1024)) * 0.023 // $0.023 per GB/month
    
    return {
      ocrCostUSD,
      aiCostUSD,
      storageCostUSD,
      totalCostUSD: ocrCostUSD + aiCostUSD + storageCostUSD
    }
  }

  private estimateCostBySize(fileSize: number, fileType: string): { total: number; reasoning: string } {
    const pages = Math.ceil(fileSize / (50 * 1024)) // Estimate pages
    const ocrCost = pages * 0.001
    const aiCost = pages * 0.01 // Rough estimate
    const storageCost = (fileSize / (1024 * 1024 * 1024)) * 0.023
    
    return {
      total: ocrCost + aiCost + storageCost,
      reasoning: `${pages} pages, OCR: $${ocrCost.toFixed(3)}, AI: $${aiCost.toFixed(3)}, Storage: $${storageCost.toFixed(3)}`
    }
  }

  private async getExistingProcessingResult(noticeId: string, documentId: string): Promise<ProcessingResult | null> {
    const { data } = await this.supabase
      .from('document_processing_results')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('document_id', documentId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return data ? {
      documentId: data.document_id,
      ocrText: data.ocr_text,
      aiAnalysis: data.ai_analysis,
      processingCost: data.processing_cost,
      confidence: data.confidence,
      processedAt: data.created_at,
      expiresAt: data.expires_at
    } : null
  }

  private async storeProcessingResult(
    noticeId: string,
    documentId: string,
    userId: string,
    result: any,
    strategy: any
  ): Promise<ProcessingResult> {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + strategy.retentionDays)

    const { data, error } = await this.supabase
      .from('document_processing_results')
      .insert({
        notice_id: noticeId,
        document_id: documentId,
        user_id: userId,
        ocr_text: result.ocrText,
        ai_analysis: result.aiAnalysis,
        processing_cost: result.processingCost,
        confidence: result.confidence,
        expires_at: expiresAt.toISOString(),
        storage_strategy: strategy.storage
      })
      .select()
      .single()

    if (error) throw error

    return {
      documentId,
      ocrText: result.ocrText,
      aiAnalysis: result.aiAnalysis,
      processingCost: result.processingCost,
      confidence: result.confidence,
      processedAt: data.created_at,
      expiresAt: data.expires_at
    }
  }

  private async performCleanup(filePath: string, strategy: StorageStrategy) {
    if (strategy.originalFile === 'delete') {
      // Delete original file immediately
      await this.supabase.storage
        .from('sam-documents')
        .remove([filePath])
    }
  }

  private async recordProcessingUsage(
    userId: string,
    type: 'cache_hit' | 'new_processing',
    cost: ProcessingResult['processingCost']
  ) {
    await this.supabase.from('ai_processing_usage').insert({
      user_id: userId,
      processing_type: type,
      cost_breakdown: cost,
      created_at: new Date().toISOString()
    })
  }

  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date()
  }
}

export const smartProcessingPipeline = new SmartProcessingPipeline()
/**
 * Document Processing Event Publisher
 * Publishes document processing events to Kafka for async OCR processing
 */

import { Kafka, Producer } from 'kafkajs'
import { logger } from '@/lib/errors/logger'

interface DocumentProcessingRequest {
  event_id: string
  event_type: string
  timestamp: string
  document_id: string
  document_url?: string
  document_source: 'url' | 's3' | 'upload' | 'sam_gov'
  document_type?: string
  ocr_model?: string
  extract_tables?: boolean
  extract_requirements?: boolean
  language?: string
  opportunity_id?: string
  user_id?: string
  organization_id?: string
  priority?: number
  callback_url?: string
  metadata?: Record<string, any>
}

class DocumentEventPublisher {
  private kafka: Kafka
  private producer: Producer | null = null
  private isConnected = false

  constructor() {
    this.kafka = new Kafka({
      clientId: 'medcontracthub-app',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    })
    this.producer = this.kafka.producer()
  }

  async connect() {
    if (this.isConnected || !this.producer) return

    try {
      await this.producer.connect()
      this.isConnected = true
      logger.info('Document event publisher connected to Kafka')
    } catch (error) {
      logger.error('Failed to connect document event publisher', { error })
      throw error
    }
  }

  async disconnect() {
    if (!this.isConnected || !this.producer) return

    try {
      await this.producer.disconnect()
      this.isConnected = false
      logger.info('Document event publisher disconnected')
    } catch (error) {
      logger.error('Failed to disconnect document event publisher', { error })
    }
  }

  /**
   * Publish document processing request event
   */
  async publishDocumentProcessingRequest(params: {
    documentId: string
    documentUrl?: string
    documentSource: 'url' | 's3' | 'upload' | 'sam_gov'
    ocrModel?: string
    extractRequirements?: boolean
    opportunityId?: string
    userId?: string
    organizationId?: string
    priority?: number
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.connect()

    const event: DocumentProcessingRequest = {
      event_id: crypto.randomUUID(),
      event_type: 'contracts.document.process_request',
      timestamp: new Date().toISOString(),
      document_id: params.documentId,
      document_url: params.documentUrl,
      document_source: params.documentSource,
      ocr_model: params.ocrModel || 'pixtral-12b-latest',
      extract_tables: true,
      extract_requirements: params.extractRequirements ?? true,
      language: 'en',
      opportunity_id: params.opportunityId,
      user_id: params.userId,
      organization_id: params.organizationId,
      priority: params.priority || 5,
      metadata: params.metadata || {},
    }

    try {
      await this.producer!.send({
        topic: 'contracts.document.process_request',
        messages: [
          {
            key: params.documentId,
            value: JSON.stringify(event),
            headers: {
              'event-type': event.event_type,
              'document-id': params.documentId,
              'timestamp': event.timestamp,
            },
          },
        ],
      })

      logger.info('Published document processing request', {
        documentId: params.documentId,
        eventId: event.event_id,
      })
    } catch (error) {
      logger.error('Failed to publish document processing request', {
        documentId: params.documentId,
        error,
      })
      throw error
    }
  }

  /**
   * Publish attachment processing request for SAM.gov documents
   */
  async publishAttachmentProcessingRequest(params: {
    attachmentUrl: string
    noticeId: string
    filename: string
    userId?: string
    organizationId?: string
  }): Promise<string> {
    const documentId = crypto.randomUUID()

    await this.publishDocumentProcessingRequest({
      documentId,
      documentUrl: params.attachmentUrl,
      documentSource: 'sam_gov',
      extractRequirements: true,
      opportunityId: params.noticeId,
      userId: params.userId,
      organizationId: params.organizationId,
      priority: 7, // Higher priority for SAM.gov attachments
      metadata: {
        filename: params.filename,
        noticeId: params.noticeId,
        source: 'sam_gov',
      },
    })

    return documentId
  }

  /**
   * Publish batch processing request
   */
  async publishBatchProcessingRequest(params: {
    documents: Array<{
      documentId: string
      documentUrl: string
      documentSource: 'url' | 's3' | 'upload' | 'sam_gov'
      metadata?: Record<string, any>
    }>
    userId?: string
    organizationId?: string
    parallelProcessing?: boolean
  }): Promise<void> {
    await this.connect()

    const batchId = crypto.randomUUID()
    const event = {
      event_id: crypto.randomUUID(),
      event_type: 'contracts.document.batch_request',
      timestamp: new Date().toISOString(),
      batch_id: batchId,
      documents: params.documents.map(doc => ({
        event_id: crypto.randomUUID(),
        event_type: 'contracts.document.process_request',
        timestamp: new Date().toISOString(),
        document_id: doc.documentId,
        document_url: doc.documentUrl,
        document_source: doc.documentSource,
        ocr_model: 'pixtral-12b-latest',
        extract_tables: true,
        extract_requirements: true,
        language: 'en',
        user_id: params.userId,
        organization_id: params.organizationId,
        metadata: doc.metadata || {},
      })),
      priority: 5,
      parallel_processing: params.parallelProcessing ?? true,
    }

    try {
      await this.producer!.send({
        topic: 'contracts.document.batch_request',
        messages: [
          {
            key: batchId,
            value: JSON.stringify(event),
            headers: {
              'event-type': event.event_type,
              'batch-id': batchId,
              'document-count': params.documents.length.toString(),
            },
          },
        ],
      })

      logger.info('Published batch processing request', {
        batchId,
        documentCount: params.documents.length,
      })
    } catch (error) {
      logger.error('Failed to publish batch processing request', {
        batchId,
        error,
      })
      throw error
    }
  }

  /**
   * Check document processing status via OCR service API
   */
  async checkDocumentStatus(documentId: string): Promise<{
    status: string
    progress?: number
    result?: any
    error?: string
  }> {
    try {
      const response = await fetch(`${process.env.OCR_SERVICE_URL || 'http://localhost:8100'}/status/${documentId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'not_found' }
        }
        throw new Error(`Status check failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Failed to check document status', { documentId, error })
      throw error
    }
  }

  /**
   * Get processing results via OCR service API
   */
  async getDocumentResults(documentId: string): Promise<any> {
    try {
      const response = await fetch(`${process.env.OCR_SERVICE_URL || 'http://localhost:8100'}/results/${documentId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Results not found')
        }
        if (response.status === 202) {
          throw new Error('Document still processing')
        }
        throw new Error(`Failed to get results: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Failed to get document results', { documentId, error })
      throw error
    }
  }
}

// Export singleton instance
export const documentEventPublisher = new DocumentEventPublisher()

// Initialize on first import
if (typeof window === 'undefined') {
  // Server-side only
  documentEventPublisher.connect().catch(error => {
    logger.warn('Failed to initialize document event publisher', { error })
  })
}
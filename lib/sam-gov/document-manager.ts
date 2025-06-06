/**
 * SAM.gov Document Manager - On-Demand Download System
 * Only downloads documents when users explicitly request them
 * Saves storage and bandwidth costs
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getSAMQuotaManager } from './quota-manager'
import { apiLogger } from '@/lib/errors/logger'
import { ExternalServiceError } from '@/lib/errors/types'
import { createClient } from '@supabase/supabase-js'

interface DocumentMetadata {
  id: string
  filename: string
  fileType: string
  fileSize?: number
  description?: string
  lastModified?: string
  downloadUrl: string
  checksum?: string
  isRequired: boolean
  category: 'solicitation' | 'amendment' | 'qa' | 'attachment' | 'other'
}

interface DocumentDownloadResult {
  success: boolean
  filePath?: string
  url?: string
  metadata: DocumentMetadata
  downloadedAt: string
  expiresAt: string
  apiCallUsed: boolean
}

export class SAMDocumentManager {
  private quotaManager = getSAMQuotaManager()
  private supabase = createServiceClient()

  constructor(private apiKey: string) {}

  /**
   * Extract and store document metadata ONLY (no actual files downloaded)
   * This runs during opportunity sync without using storage
   */
  async extractDocumentMetadata(
    noticeId: string,
    samResponse: any
  ): Promise<DocumentMetadata[]> {
    const documents: DocumentMetadata[] = []

    try {
      // Extract from different SAM.gov response sections
      const sources = [
        { data: samResponse.attachments, category: 'attachment' },
        { data: samResponse.solicitation?.documents, category: 'solicitation' },
        { data: samResponse.amendments, category: 'amendment' },
        { data: samResponse.questionsAnswers, category: 'qa' }
      ]

      for (const source of sources) {
        if (Array.isArray(source.data)) {
          for (const item of source.data) {
            const metadata = this.parseDocumentMetadata(item, source.category as any)
            if (metadata) {
              documents.push(metadata)
            }
          }
        }
      }

      // Store metadata in database (not the files themselves)
      await this.storeDocumentMetadata(noticeId, documents)

      apiLogger.info('Document metadata extracted', {
        noticeId,
        documentCount: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0)
      })

      return documents

    } catch (error) {
      apiLogger.error('Failed to extract document metadata', error as Error, { noticeId })
      return []
    }
  }

  /**
   * Download specific document on-demand when user requests it
   * Only makes API call and uses storage when actually needed
   */
  async downloadDocument(
    noticeId: string,
    documentId: string,
    userId: string,
    options: {
      forceRefresh?: boolean
      maxSizeBytes?: number
    } = {}
  ): Promise<DocumentDownloadResult> {
    const { forceRefresh = false, maxSizeBytes = 50 * 1024 * 1024 } = options // 50MB default limit

    try {
      // Check if we already have this document downloaded and cached
      const existingDownload = await this.getExistingDownload(noticeId, documentId)
      if (existingDownload && !forceRefresh && !this.isExpired(existingDownload.expires_at)) {
        // Return existing download without using API call
        return {
          success: true,
          filePath: existingDownload.file_path,
          url: existingDownload.download_url,
          metadata: existingDownload.metadata,
          downloadedAt: existingDownload.downloaded_at,
          expiresAt: existingDownload.expires_at,
          apiCallUsed: false
        }
      }

      // Get document metadata to validate download
      const metadata = await this.getDocumentMetadata(noticeId, documentId)
      if (!metadata) {
        throw new Error(`Document metadata not found: ${documentId}`)
      }

      // Check file size limit
      if (metadata.fileSize && metadata.fileSize > maxSizeBytes) {
        throw new Error(`Document too large: ${metadata.fileSize} bytes (limit: ${maxSizeBytes})`)
      }

      // Make API call to download the actual document
      const result = await this.quotaManager.withQuotaCheck(
        'detail',
        userId,
        async () => {
          const downloadedFile = await this.downloadFromSAM(metadata.downloadUrl)
          const storagePath = await this.storeInSupabaseStorage(
            noticeId,
            documentId,
            metadata.filename,
            downloadedFile
          )
          
          return { downloadedFile, storagePath }
        },
        { documentDownload: true, noticeId, documentId }
      )

      // Record the download in database
      const downloadRecord = await this.recordDownload(
        noticeId,
        documentId,
        userId,
        result.storagePath,
        metadata
      )

      return {
        success: true,
        filePath: result.storagePath,
        url: downloadRecord.download_url,
        metadata,
        downloadedAt: downloadRecord.downloaded_at,
        expiresAt: downloadRecord.expires_at,
        apiCallUsed: true
      }

    } catch (error) {
      apiLogger.error('Document download failed', error as Error, {
        noticeId,
        documentId,
        userId
      })

      return {
        success: false,
        metadata: await this.getDocumentMetadata(noticeId, documentId) || {} as DocumentMetadata,
        downloadedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        apiCallUsed: true
      }
    }
  }

  /**
   * Get list of available documents for an opportunity (metadata only)
   * No API calls or downloads - just shows what's available
   */
  async getAvailableDocuments(noticeId: string): Promise<DocumentMetadata[]> {
    const { data, error } = await this.supabase
      .from('sam_opportunity_documents')
      .select('*')
      .eq('notice_id', noticeId)
      .order('is_required', { ascending: false })
      .order('category')

    if (error) {
      apiLogger.error('Failed to get document metadata', error)
      return []
    }

    return data.map(row => ({
      id: row.document_id,
      filename: row.filename,
      fileType: row.file_type,
      fileSize: row.file_size,
      description: row.description,
      lastModified: row.last_modified,
      downloadUrl: row.sam_download_url,
      checksum: row.checksum,
      isRequired: row.is_required,
      category: row.category
    }))
  }

  /**
   * Get download statistics for cost monitoring
   */
  async getDownloadStats(
    userId?: string,
    timeRange: { start: string; end: string } = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    }
  ) {
    let query = this.supabase
      .from('sam_document_downloads')
      .select('file_size, downloaded_at, user_id, api_call_used')
      .gte('downloaded_at', timeRange.start)
      .lte('downloaded_at', timeRange.end)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      apiLogger.error('Failed to get download stats', error)
      return null
    }

    return {
      totalDownloads: data.length,
      totalSizeBytes: data.reduce((sum, d) => sum + (d.file_size || 0), 0),
      apiCallsUsed: data.filter(d => d.api_call_used).length,
      uniqueUsers: new Set(data.map(d => d.user_id)).size,
      timeRange
    }
  }

  /**
   * Clean up expired downloads to save storage
   */
  async cleanupExpiredDownloads(): Promise<{ deletedCount: number; freedBytes: number }> {
    const now = new Date().toISOString()
    
    // Get expired downloads
    const { data: expired, error: fetchError } = await this.supabase
      .from('sam_document_downloads')
      .select('file_path, file_size')
      .lt('expires_at', now)

    if (fetchError || !expired?.length) {
      return { deletedCount: 0, freedBytes: 0 }
    }

    // Delete files from storage
    const filePaths = expired.map(d => d.file_path).filter(Boolean)
    if (filePaths.length > 0) {
      const { error: storageError } = await this.supabase.storage
        .from('sam-documents')
        .remove(filePaths)

      if (storageError) {
        apiLogger.warn('Failed to delete some expired files', storageError)
      }
    }

    // Delete database records
    const { error: deleteError } = await this.supabase
      .from('sam_document_downloads')
      .delete()
      .lt('expires_at', now)

    if (deleteError) {
      apiLogger.error('Failed to clean up expired downloads', deleteError)
      return { deletedCount: 0, freedBytes: 0 }
    }

    const freedBytes = expired.reduce((sum, d) => sum + (d.file_size || 0), 0)
    
    apiLogger.info('Cleaned up expired downloads', {
      deletedCount: expired.length,
      freedBytes
    })

    return {
      deletedCount: expired.length,
      freedBytes
    }
  }

  // Private helper methods

  private parseDocumentMetadata(item: any, category: DocumentMetadata['category']): DocumentMetadata | null {
    if (!item) return null

    try {
      return {
        id: item.id || item.attachmentId || this.generateDocumentId(item),
        filename: item.filename || item.name || item.title || 'unknown',
        fileType: this.extractFileType(item.filename || item.mimeType),
        fileSize: item.size || item.fileSize || undefined,
        description: item.description || item.summary || undefined,
        lastModified: item.lastModified || item.modifiedDate || undefined,
        downloadUrl: item.url || item.downloadUrl || item.link || '',
        checksum: item.checksum || item.hash || undefined,
        isRequired: item.required || item.mandatory || false,
        category
      }
    } catch (error) {
      apiLogger.warn('Failed to parse document metadata', error as Error, { item })
      return null
    }
  }

  private generateDocumentId(item: any): string {
    const content = JSON.stringify(item)
    return require('crypto').createHash('md5').update(content).digest('hex')
  }

  private extractFileType(filename?: string): string {
    if (!filename) return 'unknown'
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext || 'unknown'
  }

  private async storeDocumentMetadata(noticeId: string, documents: DocumentMetadata[]) {
    if (!documents.length) return

    const records = documents.map(doc => ({
      notice_id: noticeId,
      document_id: doc.id,
      filename: doc.filename,
      file_type: doc.fileType,
      file_size: doc.fileSize,
      description: doc.description,
      last_modified: doc.lastModified,
      sam_download_url: doc.downloadUrl,
      checksum: doc.checksum,
      is_required: doc.isRequired,
      category: doc.category
    }))

    const { error } = await this.supabase
      .from('sam_opportunity_documents')
      .upsert(records, {
        onConflict: 'notice_id,document_id',
        ignoreDuplicates: false
      })

    if (error) {
      apiLogger.error('Failed to store document metadata', error)
      throw error
    }
  }

  private async getExistingDownload(noticeId: string, documentId: string) {
    const { data } = await this.supabase
      .from('sam_document_downloads')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('document_id', documentId)
      .order('downloaded_at', { ascending: false })
      .limit(1)
      .single()

    return data
  }

  private async getDocumentMetadata(noticeId: string, documentId: string): Promise<DocumentMetadata | null> {
    const { data } = await this.supabase
      .from('sam_opportunity_documents')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('document_id', documentId)
      .single()

    if (!data) return null

    return {
      id: data.document_id,
      filename: data.filename,
      fileType: data.file_type,
      fileSize: data.file_size,
      description: data.description,
      lastModified: data.last_modified,
      downloadUrl: data.sam_download_url,
      checksum: data.checksum,
      isRequired: data.is_required,
      category: data.category
    }
  }

  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date()
  }

  private async downloadFromSAM(downloadUrl: string): Promise<Buffer> {
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'MedContractHub/1.0'
      }
    })

    if (!response.ok) {
      throw new ExternalServiceError(
        `Failed to download document: ${response.status}`,
        'SAM_DOWNLOAD',
        { downloadUrl }
      )
    }

    return Buffer.from(await response.arrayBuffer())
  }

  private async storeInSupabaseStorage(
    noticeId: string,
    documentId: string,
    filename: string,
    fileBuffer: Buffer
  ): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 10)
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${timestamp}/${noticeId}/${documentId}_${sanitizedFilename}`

    const { error } = await this.supabase.storage
      .from('sam-documents')
      .upload(storagePath, fileBuffer, {
        contentType: this.getMimeType(filename),
        upsert: true
      })

    if (error) {
      apiLogger.error('Failed to store document in Supabase', error)
      throw error
    }

    return storagePath
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip',
      txt: 'text/plain'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  private async recordDownload(
    noticeId: string,
    documentId: string,
    userId: string,
    storagePath: string,
    metadata: DocumentMetadata
  ) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30-day retention

    const { data, error } = await this.supabase
      .from('sam_document_downloads')
      .insert({
        notice_id: noticeId,
        document_id: documentId,
        user_id: userId,
        file_path: storagePath,
        filename: metadata.filename,
        file_size: metadata.fileSize,
        api_call_used: true,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (error) {
      apiLogger.error('Failed to record download', error)
      throw error
    }

    return data
  }
}

// Factory function
export function createSAMDocumentManager(): SAMDocumentManager {
  const apiKey = process.env.SAM_GOV_API_KEY
  if (!apiKey) {
    throw new Error('SAM_GOV_API_KEY environment variable is required')
  }
  
  return new SAMDocumentManager(apiKey)
}
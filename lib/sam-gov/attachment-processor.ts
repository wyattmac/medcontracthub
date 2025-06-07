/**
 * SAM.gov Attachment Processor
 * Downloads and processes opportunity attachments with Mistral OCR
 * Based on SAM.gov API v2 documentation and Mistral OCR integration
 */

import { getSAMApiClient } from './client'
import { mistralDocumentOCRClient } from '@/lib/ai/mistral-document-ocr-client'
import { logger } from '@/lib/errors/logger'

export interface AttachmentInfo {
  url: string
  title: string
  noticeId: string
  filename: string
}

export interface ProcessedAttachment {
  noticeId: string
  title: string
  filename: string
  extractedText: string
  documentType: string
  fileSize: number
  processingSuccess: boolean
  error?: string
}

export interface ContractRequirements {
  contractNumber?: string
  deadline?: string
  contactEmail?: string
  totalValue?: string
  naicsCode?: string
  submissionRequirements: string[]
  technicalRequirements: string[]
  complianceRequirements: string[]
}

export class SAMAttachmentProcessor {
  private samClient = getSAMApiClient()
  private mistralClient = mistralDocumentOCRClient

  /**
   * Get all attachments for a specific opportunity
   */
  async getOpportunityAttachments(noticeId: string): Promise<AttachmentInfo[]> {
    try {
      logger.info('Fetching attachments for opportunity', { noticeId })
      
      const response = await this.samClient.getOpportunityById(noticeId)
      const opportunity = response.opportunitiesData?.[0]
      
      if (!opportunity) {
        throw new Error(`Opportunity with notice ID ${noticeId} not found`)
      }
      
      const attachments: AttachmentInfo[] = []
      
      if (opportunity.resourceLinks && opportunity.resourceLinks.length > 0) {
        attachments.push(...opportunity.resourceLinks.map((url, index) => ({
          url,
          title: opportunity.title,
          noticeId: opportunity.noticeId,
          filename: this.extractFilename(url, index)
        })))
      }
      
      logger.info('Found attachments', { 
        noticeId, 
        count: attachments.length,
        filenames: attachments.map(a => a.filename)
      })
      
      return attachments
    } catch (error) {
      logger.error('Error fetching opportunity attachments', { noticeId, error })
      throw error
    }
  }

  /**
   * Download attachment from SAM.gov with API key authentication
   */
  async downloadAttachment(attachmentUrl: string): Promise<ArrayBuffer> {
    try {
      const apiKey = process.env.SAM_GOV_API_KEY
      if (!apiKey) {
        throw new Error('SAM_GOV_API_KEY environment variable is required')
      }

      // Add API key to URL for authentication as required by SAM.gov
      const downloadUrl = new URL(attachmentUrl)
      downloadUrl.searchParams.set('api_key', apiKey)
      
      logger.info('Downloading attachment', { url: attachmentUrl })
      
      const response = await fetch(downloadUrl.toString(), {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'User-Agent': 'MedContractHub/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()
      logger.info('Successfully downloaded attachment', { 
        url: attachmentUrl, 
        size: buffer.byteLength 
      })
      
      return buffer
    } catch (error) {
      logger.error('Error downloading attachment', { url: attachmentUrl, error })
      throw error
    }
  }

  /**
   * Process attachment with Mistral OCR
   */
  async processAttachmentWithOCR(
    attachment: AttachmentInfo
  ): Promise<ProcessedAttachment> {
    try {
      logger.info('Processing attachment with OCR', { 
        filename: attachment.filename,
        noticeId: attachment.noticeId 
      })

      // Download the attachment
      const buffer = await this.downloadAttachment(attachment.url)
      
      // Convert ArrayBuffer to File-like object for Mistral
      const file = new File([buffer], attachment.filename, {
        type: this.getMimeType(attachment.filename)
      })

      // Process with Mistral OCR
      const ocrResult = await this.mistralClient.processDocument(file)
      
      // Extract text from all pages
      const extractedText = ocrResult.pages
        ?.map(page => page.markdown || page.text || '')
        .join('\n\n') || ''

      const result: ProcessedAttachment = {
        noticeId: attachment.noticeId,
        title: attachment.title,
        filename: attachment.filename,
        extractedText,
        documentType: this.getDocumentType(attachment.filename),
        fileSize: buffer.byteLength,
        processingSuccess: true
      }

      logger.info('Successfully processed attachment', {
        filename: attachment.filename,
        textLength: extractedText.length,
        fileSize: buffer.byteLength
      })

      return result
    } catch (error) {
      logger.error('Error processing attachment with OCR', {
        filename: attachment.filename,
        error
      })

      return {
        noticeId: attachment.noticeId,
        title: attachment.title,
        filename: attachment.filename,
        extractedText: '',
        documentType: this.getDocumentType(attachment.filename),
        fileSize: 0,
        processingSuccess: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Process all attachments for an opportunity
   */
  async processOpportunityAttachments(
    noticeId: string,
    maxAttachments = 5
  ): Promise<ProcessedAttachment[]> {
    try {
      logger.info('Processing all attachments for opportunity', { noticeId, maxAttachments })

      const attachments = await this.getOpportunityAttachments(noticeId)
      
      if (attachments.length === 0) {
        logger.info('No attachments found for opportunity', { noticeId })
        return []
      }

      // Limit number of attachments to process
      const attachmentsToProcess = attachments.slice(0, maxAttachments)
      
      logger.info('Processing attachments', { 
        noticeId, 
        total: attachments.length,
        processing: attachmentsToProcess.length 
      })

      const results: ProcessedAttachment[] = []
      
      // Process attachments sequentially to avoid overwhelming the APIs
      for (const attachment of attachmentsToProcess) {
        try {
          const result = await this.processAttachmentWithOCR(attachment)
          results.push(result)
          
          // Add delay between processing to be respectful to APIs
          if (attachmentsToProcess.indexOf(attachment) < attachmentsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (error) {
          logger.warn('Failed to process individual attachment', {
            filename: attachment.filename,
            error
          })
          // Continue with other attachments even if one fails
        }
      }

      logger.info('Completed processing attachments', {
        noticeId,
        processed: results.length,
        successful: results.filter(r => r.processingSuccess).length
      })

      return results
    } catch (error) {
      logger.error('Error processing opportunity attachments', { noticeId, error })
      throw error
    }
  }

  /**
   * Extract structured requirements from processed attachments
   */
  async extractContractRequirements(
    processedAttachments: ProcessedAttachment[]
  ): Promise<ContractRequirements> {
    try {
      // Combine all extracted text
      const combinedText = processedAttachments
        .filter(a => a.processingSuccess)
        .map(a => a.extractedText)
        .join('\n\n')

      if (!combinedText.trim()) {
        return {
          submissionRequirements: [],
          technicalRequirements: [],
          complianceRequirements: []
        }
      }

      // Use Claude for structured analysis
      const { claudeClient } = await import('@/lib/ai/claude-client')
      
      const analysis = await claudeClient.analyzeContract(combinedText, {
        focusAreas: [
          'submission requirements and deadlines',
          'technical specifications',
          'compliance requirements',
          'contact information',
          'contract value'
        ]
      })

      // Parse the analysis to extract structured data
      const requirements = this.parseRequirementsFromAnalysis(analysis, combinedText)
      
      logger.info('Extracted contract requirements', {
        submissionCount: requirements.submissionRequirements.length,
        technicalCount: requirements.technicalRequirements.length,
        complianceCount: requirements.complianceRequirements.length
      })

      return requirements
    } catch (error) {
      logger.error('Error extracting contract requirements', { error })
      return {
        submissionRequirements: [],
        technicalRequirements: [],
        complianceRequirements: []
      }
    }
  }

  /**
   * Complete workflow: process opportunity and extract requirements
   */
  async processOpportunityForProposal(noticeId: string): Promise<{
    attachments: ProcessedAttachment[]
    requirements: ContractRequirements
    summary: string
  }> {
    try {
      logger.info('Starting complete opportunity processing', { noticeId })

      // Process all attachments
      const attachments = await this.processOpportunityAttachments(noticeId)
      
      // Extract requirements
      const requirements = await this.extractContractRequirements(attachments)
      
      // Generate summary
      const summary = this.generateProcessingSummary(attachments, requirements)
      
      logger.info('Completed opportunity processing', {
        noticeId,
        attachmentsProcessed: attachments.length,
        requirementsExtracted: Object.keys(requirements).length
      })

      return {
        attachments,
        requirements,
        summary
      }
    } catch (error) {
      logger.error('Error in complete opportunity processing', { noticeId, error })
      throw error
    }
  }

  /**
   * Helper methods
   */
  private extractFilename(url: string, index: number): string {
    try {
      const urlPath = new URL(url).pathname
      const filename = urlPath.split('/').pop()
      
      if (filename && filename.includes('.')) {
        return filename
      }
      
      return `attachment_${index + 1}.pdf`
    } catch {
      return `attachment_${index + 1}.pdf`
    }
  }

  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'rtf': 'application/rtf'
    }
    
    return mimeTypes[extension || ''] || 'application/pdf'
  }

  private getDocumentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    const documentTypes: Record<string, string> = {
      'pdf': 'PDF Document',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'txt': 'Text Document',
      'rtf': 'Rich Text Document'
    }
    
    return documentTypes[extension || ''] || 'Document'
  }

  private parseRequirementsFromAnalysis(
    analysis: string,
    originalText: string
  ): ContractRequirements {
    // Extract key information using regex patterns
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
    const deadlineRegex = /deadline|due date|submission date/gi
    const contractNumberRegex = /contract\s*(?:number|#|id)[\s:]*([A-Z0-9-]+)/gi
    const valueRegex = /\$[\d,]+(?:\.\d{2})?/g

    const emails = originalText.match(emailRegex) || []
    const contractNumbers = []
    const values = originalText.match(valueRegex) || []

    let match
    while ((match = contractNumberRegex.exec(originalText)) !== null) {
      contractNumbers.push(match[1])
    }

    // Parse requirements from analysis
    const submissionRequirements = this.extractRequirementsByType(analysis, 'submission')
    const technicalRequirements = this.extractRequirementsByType(analysis, 'technical')
    const complianceRequirements = this.extractRequirementsByType(analysis, 'compliance')

    return {
      contractNumber: contractNumbers[0],
      contactEmail: emails[0],
      totalValue: values[0],
      submissionRequirements,
      technicalRequirements,
      complianceRequirements
    }
  }

  private extractRequirementsByType(analysis: string, type: string): string[] {
    const lines = analysis.split('\n')
    const requirements: string[] = []
    let inSection = false

    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      
      if (lowerLine.includes(type) && lowerLine.includes('requirement')) {
        inSection = true
        continue
      }
      
      if (inSection) {
        if (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\./)) {
          requirements.push(line.replace(/^[-*\d.]\s*/, '').trim())
        } else if (line.trim() === '' || line.match(/^[A-Z][^:]*:$/)) {
          inSection = false
        }
      }
    }

    return requirements.filter(req => req.length > 0)
  }

  private generateProcessingSummary(
    attachments: ProcessedAttachment[],
    requirements: ContractRequirements
  ): string {
    const successfulAttachments = attachments.filter(a => a.processingSuccess)
    const totalText = successfulAttachments.reduce((sum, a) => sum + a.extractedText.length, 0)
    
    const summary = [
      `Processed ${attachments.length} attachments (${successfulAttachments.length} successful)`,
      `Extracted ${totalText.toLocaleString()} characters of text`,
      `Found ${requirements.submissionRequirements.length} submission requirements`,
      `Found ${requirements.technicalRequirements.length} technical requirements`,
      `Found ${requirements.complianceRequirements.length} compliance requirements`
    ]

    if (requirements.deadline) {
      summary.push(`Deadline: ${requirements.deadline}`)
    }

    if (requirements.contactEmail) {
      summary.push(`Contact: ${requirements.contactEmail}`)
    }

    return summary.join('\n')
  }
}

// Export singleton instance
export const samAttachmentProcessor = new SAMAttachmentProcessor()
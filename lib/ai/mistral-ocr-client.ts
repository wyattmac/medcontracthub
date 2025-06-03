import { Mistral } from '@mistralai/mistralai'
import { apiLogger } from '@/lib/errors/logger'
import { ExternalAPIError, ValidationError } from '@/lib/errors/types'

interface IOCRResult {
  pages: Array<{
    index: number
    markdown: string
    images: Array<{
      id: string
      topLeftX: number
      topLeftY: number
      bottomRightX: number
      bottomRightY: number
    }>
    dimensions: {
      dpi: number
      height: number
      width: number
    }
  }>
  model: string
  usageInfo: {
    pagesProcessed: number
  }
}

interface IOCRProcessOptions {
  documentUrl?: string
  documentBuffer?: Buffer
  model?: 'Focus' | 'Pixtral'
}

class MistralOCRClient {
  private client: Mistral | null = null

  private getClient(): Mistral {
    if (!this.client) {
      const apiKey = process.env.MISTRAL_API_KEY
      if (!apiKey) {
        throw new ValidationError('MISTRAL_API_KEY is not configured')
      }
      this.client = new Mistral({ apiKey })
    }
    return this.client
  }

  async processDocument(options: IOCRProcessOptions): Promise<IOCRResult> {
    const { documentUrl, documentBuffer, model = 'Focus' } = options

    if (!documentUrl && !documentBuffer) {
      throw new ValidationError('Either documentUrl or documentBuffer must be provided')
    }

    if (documentUrl && documentBuffer) {
      throw new ValidationError('Only one of documentUrl or documentBuffer should be provided')
    }

    try {
      apiLogger.info('Starting OCR processing', { model, hasUrl: !!documentUrl })

      const client = this.getClient()

      // Process document
      const result = await client.ocr.process({
        model,
        document: documentUrl 
          ? {
              documentUrl,
              type: 'document_url' as const,
            }
          : {
              // For buffer uploads, we'll need to implement file upload first
              documentUrl: '', // This will be implemented with file upload
              type: 'document_url' as const,
            }
      })

      apiLogger.info('OCR processing completed', {
        pagesProcessed: result.usageInfo?.pagesProcessed || 0,
        model: result.model,
      })

      return result as IOCRResult
    } catch (error) {
      apiLogger.error('OCR processing failed', error, { model })
      
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          throw new ExternalAPIError('Mistral AI authentication failed', 401)
        }
        if (error.message.includes('rate limit')) {
          throw new ExternalAPIError('Mistral AI rate limit exceeded', 429)
        }
      }
      
      throw new ExternalAPIError('Failed to process document with OCR', 502)
    }
  }

  async extractTextFromDocument(documentUrl: string): Promise<string> {
    const result = await this.processDocument({ documentUrl })
    
    // Combine all pages' markdown content
    const fullText = result.pages
      .sort((a, b) => a.index - b.index)
      .map(page => page.markdown)
      .join('\n\n---\n\n') // Page separator
    
    return fullText
  }

  async extractStructuredData(documentUrl: string): Promise<{
    text: string
    metadata: {
      pageCount: number
      totalImages: number
      model: string
    }
  }> {
    const result = await this.processDocument({ documentUrl })
    
    const text = result.pages
      .sort((a, b) => a.index - b.index)
      .map(page => page.markdown)
      .join('\n\n---\n\n')
    
    const totalImages = result.pages.reduce(
      (sum, page) => sum + (page.images?.length || 0), 
      0
    )
    
    return {
      text,
      metadata: {
        pageCount: result.pages.length,
        totalImages,
        model: result.model,
      }
    }
  }
}

// Export singleton instance
export const mistralOCR = new MistralOCRClient()

// Export types
export type { IOCRResult, IOCRProcessOptions }
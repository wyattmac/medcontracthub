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

  // New method for processing document buffers with product extraction
  async processDocumentBuffer(fileBuffer: Buffer, fileName: string): Promise<{
    text: string;
    structuredData: any;
    tables: any[];
  }> {
    try {
      // Determine file type from extension
      const fileExtension = fileName.split('.').pop()?.toLowerCase()
      const mimeType = this.getMimeType(fileExtension || 'pdf')
      
      // Convert buffer to base64 for API
      const base64File = fileBuffer.toString('base64')
      
      // Structured extraction prompt
      const extractionPrompt = `You are analyzing a government contract document for medical supplies.
      
Extract ALL product requirements and specifications from this document.

Return a JSON object with this exact structure:
{
  "products": [
    {
      "name": "product name/description",
      "specifications": {
        "size": "if specified",
        "material": "if specified",
        "color": "if specified",
        "other_specs": "any other specifications"
      },
      "quantity": 0,
      "unit": "EA/BX/CS/etc",
      "certifications": ["FDA 510(k)", "ISO 13485", "etc"],
      "standards": ["ASTM D6319", "etc"],
      "packaging": "packaging requirements if specified",
      "deliveryDate": "YYYY-MM-DD if specified"
    }
  ],
  "delivery_requirements": "general delivery requirements",
  "compliance_requirements": "general compliance requirements",
  "special_instructions": "any special instructions",
  "tables": []
}

Important:
- Extract ALL products mentioned, even if in tables
- Include all technical specifications
- Capture all certification and standard requirements
- If quantity is not specified, use 0
- If unit is not specified, use "EA" (each)`

      const client = this.getClient()
      
      // Call Mistral chat API with vision capabilities
      const response = await client.chat.complete({
        model: 'pixtral-12b-latest', // Latest vision model
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: extractionPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64File}`
              }
            }
          ]
        }],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 4000
      })

      let structuredData
      try {
        // Parse the response content as JSON
        const content = response.choices[0].message.content
        structuredData = JSON.parse(content)
      } catch (parseError) {
        apiLogger.warn('Failed to parse structured response, using fallback', { fileName })
        // Fallback structure if parsing fails
        structuredData = {
          products: [],
          text: response.choices[0].message.content,
          parse_error: true
        }
      }
      
      apiLogger.info('Document processed successfully', { 
        fileName, 
        productsFound: structuredData.products?.length || 0,
        model: response.model,
        usage: response.usage
      })

      return {
        text: response.choices[0].message.content,
        structuredData,
        tables: structuredData.tables || []
      }
    } catch (error: any) {
      apiLogger.error('Mistral OCR processing failed', error, { 
        fileName,
        errorMessage: error.message,
        errorType: error.constructor.name
      })
      
      if (error.status === 401) {
        throw new ValidationError('Invalid Mistral API key')
      } else if (error.status === 429) {
        throw new ExternalAPIError('Mistral', 'API rate limit exceeded')
      } else {
        throw new ExternalAPIError('Mistral', `Document processing failed: ${error.message}`)
      }
    }
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    }
    return mimeTypes[extension] || 'application/octet-stream'
  }
}

// Export singleton instance
export const mistralOCR = new MistralOCRClient()

// Export class for custom instances
export { MistralOCRClient }

// Export types
export type { IOCRResult, IOCRProcessOptions }
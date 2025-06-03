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
  model?: string // We'll use pixtral-12b-latest for vision/OCR tasks
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
    const { documentUrl, documentBuffer, model = 'pixtral-12b-2409' } = options

    if (!documentUrl && !documentBuffer) {
      throw new ValidationError('Either documentUrl or documentBuffer must be provided')
    }

    if (documentUrl && documentBuffer) {
      throw new ValidationError('Only one of documentUrl or documentBuffer should be provided')
    }

    try {
      apiLogger.info('Starting OCR processing', { model, hasUrl: !!documentUrl })

      const client = this.getClient()

      // For URL-based documents, we need to download and convert to base64
      let base64Content: string
      let mimeType = 'image/jpeg'
      
      if (documentUrl) {
        const response = await fetch(documentUrl)
        if (!response.ok) {
          throw new ExternalAPIError('Mistral', `Failed to download document: ${response.status}`)
        }
        const buffer = await response.arrayBuffer()
        base64Content = Buffer.from(buffer).toString('base64')
        
        // Detect mime type from URL or response headers
        const contentType = response.headers.get('content-type')
        if (contentType) {
          mimeType = contentType.split(';')[0]
        }
        
        // Validate that it's an image type
        if (!mimeType.startsWith('image/')) {
          throw new ValidationError(`Mistral OCR only supports image files. Received: ${mimeType}`)
        }
      } else {
        base64Content = documentBuffer!.toString('base64')
        // For buffers, we'll assume it's an image unless specified otherwise
      }

      // Use the chat API with vision capabilities for document processing
      // According to Mistral docs, we need to send the image in the content array
      const response = await client.chat.complete({
        model: model,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this document. Return the complete text content maintaining the original structure and formatting.'
            },
            {
              type: 'image_url',
              imageUrl: {
                url: `data:${mimeType};base64,${base64Content}`
              }
            }
          ] as any // Type assertion needed due to SDK type limitations
        }],
        temperature: 0.1,
        maxTokens: 8000
      })

      const extractedText = response.choices?.[0]?.message?.content || ''

      apiLogger.info('OCR processing completed', {
        model: response.model,
        tokensUsed: response.usage?.totalTokens || 0
      })

      // Return in OCR result format
      return {
        pages: [{
          index: 0,
          markdown: typeof extractedText === 'string' ? extractedText : '',
          images: [],
          dimensions: { dpi: 72, height: 792, width: 612 } // Standard PDF dimensions
        }],
        model: response.model || model,
        usageInfo: {
          pagesProcessed: 1
        }
      }
    } catch (error) {
      apiLogger.error('OCR processing failed', error, { model })
      
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          throw new ExternalAPIError('Mistral', 'Authentication failed')
        }
        if (error.message.includes('rate limit')) {
          throw new ExternalAPIError('Mistral', 'Rate limit exceeded')
        }
      }
      
      throw new ExternalAPIError('Mistral', 'Failed to process document with OCR')
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
      
      // Check if it's a PDF - Mistral only supports images
      if (mimeType === 'application/pdf') {
        apiLogger.warn('PDF documents are not directly supported by Mistral vision API', { fileName })
        
        // For PDFs, we'll use a text-based approach
        // In production, you'd convert PDF to images first
        return {
          text: 'PDF processing requires conversion to images. Please use a PDF-to-image converter first.',
          structuredData: {
            products: [],
            error: 'PDF_NOT_SUPPORTED',
            message: 'PDFs must be converted to images before OCR processing'
          },
          tables: []
        }
      }
      
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
              imageUrl: {
                url: `data:${mimeType};base64,${base64File}`
              }
            }
          ]
        }],
        temperature: 0.1, // Low temperature for consistent extraction
        maxTokens: 4000
      })

      let structuredData
      let contentString: string = ''
      try {
        // Parse the response content as JSON
        const content = response.choices[0].message.content
        contentString = typeof content === 'string' ? content : JSON.stringify(content)
        structuredData = JSON.parse(contentString)
      } catch (parseError) {
        apiLogger.warn('Failed to parse structured response, using fallback', { fileName })
        // Fallback structure if parsing fails
        const fallbackContent = response.choices[0].message.content
        contentString = typeof fallbackContent === 'string' ? fallbackContent : JSON.stringify(fallbackContent)
        structuredData = {
          products: [],
          text: contentString,
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
        text: contentString,
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
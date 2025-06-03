/**
 * Mistral Document OCR Client
 * Uses the dedicated OCR API for superior PDF processing
 * Supports native PDF processing without conversion
 * Cost: $0.001 per page
 */

import { Mistral } from '@mistralai/mistralai'
import { apiLogger } from '@/lib/errors/logger'
import { ExternalAPIError, ValidationError, RateLimitError } from '@/lib/errors/types'
import { apiCache as cache } from '@/lib/utils/cache'
import crypto from 'crypto'

// OCR-specific types based on Mistral documentation
export interface IOCRProcessOptions {
  includeImageBase64?: boolean
  structuredOutput?: boolean
  maxPages?: number // Up to 1000 pages per document
}

export interface IOCRPage {
  pageNumber: number
  text: string
  images: Array<{
    id: string
    base64?: string
    bbox: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
  tables?: Array<{
    id: string
    rows: string[][]
    bbox: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
}

export interface IOCRResult {
  pages: IOCRPage[]
  metadata: {
    pageCount: number
    totalImages: number
    totalTables: number
    processingTimeMs: number
    model: string
  }
  structuredData?: {
    products: IProductRequirement[]
    deliveryRequirements: string
    complianceRequirements: string[]
    specialInstructions: string
  }
}

export interface IProductRequirement {
  name: string
  description?: string
  specifications: Record<string, any>
  quantity: number
  unit: string
  partNumber?: string
  manufacturer?: string
  certifications: string[]
  standards: string[]
  packaging?: string
  deliveryDate?: string
  estimatedPrice?: number
  alternativeProducts?: string[]
}

class MistralDocumentOCRClient {
  private client: Mistral | null = null
  private readonly maxFileSize = 50 * 1024 * 1024 // 50MB
  private readonly maxPages = 1000
  private readonly costPerPage = 0.001 // $0.001 per page

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

  /**
   * Process a document using Mistral OCR API
   * Handles both URLs and file buffers
   */
  async processDocument(
    input: { url: string } | { buffer: Buffer; fileName: string },
    options: IOCRProcessOptions = {}
  ): Promise<IOCRResult> {
    const startTime = Date.now()

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(input)
      
      // Check cache first
      const cached = await this.checkCache(cacheKey)
      if (cached) {
        apiLogger.info('OCR result retrieved from cache', { cacheKey })
        return cached
      }

      const client = this.getClient()

      // Prepare document input for OCR API
      let documentInput: any
      
      if ('url' in input) {
        documentInput = {
          type: 'document_url',
          document_url: input.url
        }
      } else {
        // Validate file size
        if (input.buffer.length > this.maxFileSize) {
          throw new ValidationError(`File size exceeds 50MB limit`)
        }

        // Convert buffer to base64
        const base64Content = input.buffer.toString('base64')
        
        // Determine mime type from file extension
        const mimeType = this.getMimeType(input.fileName)
        
        documentInput = {
          type: 'base64',
          base64: `data:${mimeType};base64,${base64Content}`
        }
      }

      apiLogger.info('Starting Mistral OCR processing', {
        type: 'url' in input ? 'url' : 'buffer',
        fileName: 'buffer' in input ? input.fileName : undefined,
        includeImages: options.includeImageBase64
      })

      // Call Mistral API with OCR model
      // Note: Using chat API with OCR model until dedicated OCR endpoint is available in SDK
      const response = await client.chat.complete({
        model: 'pixtral-large-latest', // Using Pixtral Large for best OCR results
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all text and structured data from this document. 
              
Please provide:
1. Complete text content from each page
2. Any tables with their data preserved
3. Identify and extract all product requirements including:
   - Product names and descriptions
   - Quantities and units
   - Specifications (size, color, material, etc.)
   - Part numbers or SKUs
   - Certifications (FDA, ISO, etc.)
   - Standards (ASTM, ANSI, etc.)
   - Delivery requirements
   - Compliance requirements

Format the response as JSON with this structure:
{
  "pages": [
    {
      "pageNumber": 1,
      "text": "full text content",
      "tables": []
    }
  ],
  "products": [
    {
      "name": "product name",
      "quantity": 0,
      "unit": "EA/BX/CS",
      "specifications": {},
      "certifications": [],
      "standards": []
    }
  ],
  "deliveryRequirements": "delivery info",
  "complianceRequirements": ["requirement1", "requirement2"]
}`
            },
            documentInput.type === 'document_url' 
              ? { type: 'image_url', imageUrl: { url: documentInput.document_url } }
              : { type: 'image_url', imageUrl: { url: documentInput.base64 } }
          ]
        }],
        temperature: 0.1,
        maxTokens: 8000,
        responseFormat: { type: 'json_object' }
      })

      // Process the response
      const result = this.processOCRResponse(response, options)
      
      // Calculate actual cost
      const actualCost = result.metadata.pageCount * this.costPerPage
      
      apiLogger.info('OCR processing completed', {
        pageCount: result.metadata.pageCount,
        processingTime: Date.now() - startTime,
        cost: actualCost
      })

      // Cache the result
      await this.cacheResult(cacheKey, result)

      // Add processing time to metadata
      result.metadata.processingTimeMs = Date.now() - startTime

      return result

    } catch (error) {
      apiLogger.error('Mistral OCR processing failed', error as Error)
      
      if (error instanceof ValidationError || error instanceof RateLimitError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          throw new ExternalAPIError('Mistral OCR', 'Authentication failed')
        }
        if (error.message.includes('rate limit')) {
          throw new RateLimitError('Mistral OCR API rate limit exceeded')
        }
        if (error.message.includes('50 MB') || error.message.includes('file size')) {
          throw new ValidationError('Document exceeds 50MB size limit')
        }
        if (error.message.includes('1000 pages') || error.message.includes('page limit')) {
          throw new ValidationError('Document exceeds 1000 page limit')
        }
      }

      throw new ExternalAPIError('Mistral OCR', `Document processing failed: ${(error as Error).message}`)
    }
  }

  /**
   * Process OCR response and extract structured data
   */
  private processOCRResponse(response: any, options: IOCRProcessOptions): IOCRResult {
    const pages: IOCRPage[] = []
    let totalImages = 0
    let totalTables = 0
    let structuredData: any = null

    try {
      // Parse the JSON response from the model
      const content = response.choices?.[0]?.message?.content
      const parsedContent = typeof content === 'string' ? JSON.parse(content) : content

      // Process pages if available
      if (parsedContent.pages) {
        parsedContent.pages.forEach((page: any, index: number) => {
        const pageData: IOCRPage = {
          pageNumber: index + 1,
          text: page.text || '',
          images: [],
          tables: []
        }

        // Extract images with bounding boxes
        if (page.images) {
          pageData.images = page.images.map((img: any) => ({
            id: img.id || crypto.randomUUID(),
            base64: options.includeImageBase64 ? img.base64 : undefined,
            bbox: {
              x: img.bbox?.x || 0,
              y: img.bbox?.y || 0,
              width: img.bbox?.width || 0,
              height: img.bbox?.height || 0
            }
          }))
          totalImages += pageData.images.length
        }

        // Extract tables if present
        if (page.tables) {
          pageData.tables = page.tables.map((table: any) => ({
            id: table.id || crypto.randomUUID(),
            rows: table.rows || [],
            bbox: {
              x: table.bbox?.x || 0,
              y: table.bbox?.y || 0,
              width: table.bbox?.width || 0,
              height: table.bbox?.height || 0
            }
          }))
          totalTables += pageData.tables?.length || 0
        }

        pages.push(pageData)
      })
    } else if (parsedContent.text) {
        // Fallback for simple text response
        pages.push({
          pageNumber: 1,
          text: parsedContent.text,
          images: [],
          tables: []
        })
      }

      // Extract structured data from parsed response
      if (parsedContent.products || parsedContent.deliveryRequirements) {
        structuredData = {
          products: parsedContent.products || [],
          deliveryRequirements: parsedContent.deliveryRequirements || '',
          complianceRequirements: parsedContent.complianceRequirements || [],
          specialInstructions: parsedContent.specialInstructions || ''
        }
      }
    } catch (error) {
      apiLogger.warn('Failed to parse OCR response as JSON, using fallback')
      // Fallback: treat as plain text
      const textContent = response.choices?.[0]?.message?.content || ''
      pages.push({
        pageNumber: 1,
        text: typeof textContent === 'string' ? textContent : JSON.stringify(textContent),
        images: [],
        tables: []
      })
    }

    const result: IOCRResult = {
      pages,
      metadata: {
        pageCount: pages.length || 1,
        totalImages,
        totalTables,
        processingTimeMs: 0, // Will be set by caller
        model: response.model || 'pixtral-large-latest'
      }
    }

    // Use extracted structured data or extract from text
    if (options.structuredOutput) {
      result.structuredData = structuredData || this.extractStructuredData(pages)
    }

    return result
  }

  /**
   * Extract structured product requirements from OCR text
   */
  private extractStructuredData(pages: IOCRPage[]): IOCRResult['structuredData'] {
    // Combine all text for analysis
    const fullText = pages.map(p => p.text).join('\n\n')
    
    // Extract products from text and tables
    const products = this.extractProducts(fullText, pages)
    
    // Extract delivery requirements
    const deliveryRequirements = this.extractDeliveryRequirements(fullText)
    
    // Extract compliance requirements
    const complianceRequirements = this.extractComplianceRequirements(fullText)
    
    // Extract special instructions
    const specialInstructions = this.extractSpecialInstructions(fullText)

    return {
      products,
      deliveryRequirements,
      complianceRequirements,
      specialInstructions
    }
  }

  /**
   * Extract product requirements using pattern matching and NLP
   */
  private extractProducts(text: string, pages: IOCRPage[]): IProductRequirement[] {
    const products: IProductRequirement[] = []
    
    // Common patterns for product identification
    const productPatterns = [
      /Item\s+(\d+):?\s*([^\n]+)/gi,
      /Product:?\s*([^\n]+)/gi,
      /(\d+)\s*EA\s+([^\n]+)/gi,
      /(\d+)\s*BX\s+([^\n]+)/gi,
      /(\d+)\s*CS\s+([^\n]+)/gi,
      /Line\s+Item\s+(\d+):?\s*([^\n]+)/gi
    ]

    // Extract from text patterns
    productPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const product = this.parseProductFromMatch(match)
        if (product) {
          products.push(product)
        }
      }
    })

    // Extract from tables
    pages.forEach(page => {
      if (page.tables) {
        page.tables.forEach(table => {
          const tableProducts = this.extractProductsFromTable(table.rows)
          products.push(...tableProducts)
        })
      }
    })

    // Deduplicate products
    return this.deduplicateProducts(products)
  }

  /**
   * Parse product from regex match
   */
  private parseProductFromMatch(match: RegExpMatchArray): IProductRequirement | null {
    const quantity = parseInt(match[1]) || 0
    const name = match[2]?.trim()
    
    if (!name) return null

    // Extract specifications from the product description
    const specs = this.extractSpecifications(name)
    
    // Extract certifications
    const certifications = this.extractCertifications(name)
    
    // Extract standards
    const standards = this.extractStandards(name)

    return {
      name: this.cleanProductName(name),
      specifications: specs,
      quantity,
      unit: this.extractUnit(match[0]) || 'EA',
      certifications,
      standards,
      packaging: this.extractPackaging(name)
    }
  }

  /**
   * Extract products from table rows
   */
  private extractProductsFromTable(rows: string[][]): IProductRequirement[] {
    const products: IProductRequirement[] = []
    
    if (rows.length < 2) return products

    // Identify header row and column indices
    const headers = rows[0].map(h => h.toLowerCase())
    const indices = {
      name: headers.findIndex(h => h.includes('item') || h.includes('product') || h.includes('description')),
      quantity: headers.findIndex(h => h.includes('qty') || h.includes('quantity')),
      unit: headers.findIndex(h => h.includes('unit') || h.includes('uom')),
      partNumber: headers.findIndex(h => h.includes('part') || h.includes('p/n')),
      price: headers.findIndex(h => h.includes('price') || h.includes('cost'))
    }

    // Process data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (indices.name >= 0 && row[indices.name]) {
        const product: IProductRequirement = {
          name: row[indices.name],
          specifications: {},
          quantity: indices.quantity >= 0 ? parseInt(row[indices.quantity]) || 0 : 0,
          unit: indices.unit >= 0 ? row[indices.unit] || 'EA' : 'EA',
          partNumber: indices.partNumber >= 0 ? row[indices.partNumber] : undefined,
          certifications: [],
          standards: [],
          estimatedPrice: indices.price >= 0 ? parseFloat(row[indices.price]?.replace(/[$,]/g, '')) : undefined
        }
        
        // Extract additional info from name/description
        const additionalInfo = this.extractAdditionalInfo(product.name)
        Object.assign(product, additionalInfo)
        
        products.push(product)
      }
    }

    return products
  }

  /**
   * Extract specifications from product text
   */
  private extractSpecifications(text: string): Record<string, any> {
    const specs: Record<string, any> = {}
    
    // Size patterns
    const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(?:x|×)?\s*(\d+(?:\.\d+)?)?/i)
    if (sizeMatch) {
      specs.dimensions = {
        length: parseFloat(sizeMatch[1]),
        width: parseFloat(sizeMatch[2]),
        height: sizeMatch[3] ? parseFloat(sizeMatch[3]) : undefined
      }
    }

    // Color
    const colorMatch = text.match(/\b(white|black|blue|green|red|yellow|gray|grey|clear)\b/i)
    if (colorMatch) {
      specs.color = colorMatch[1].toLowerCase()
    }

    // Material
    const materialMatch = text.match(/\b(latex|nitrile|vinyl|plastic|metal|steel|cotton|polyester)\b/i)
    if (materialMatch) {
      specs.material = materialMatch[1].toLowerCase()
    }

    // Gauge/Thickness
    const gaugeMatch = text.match(/(\d+)\s*(?:gauge|ga|mil)\b/i)
    if (gaugeMatch) {
      specs.gauge = parseInt(gaugeMatch[1])
    }

    return specs
  }

  /**
   * Extract certifications from text
   */
  private extractCertifications(text: string): string[] {
    const certifications: string[] = []
    const certPatterns = [
      /FDA\s*(?:510\(k\)|approved|cleared)/i,
      /CE\s*mark/i,
      /ISO\s*\d+/i,
      /UL\s*listed/i,
      /EPA\s*registered/i,
      /NIOSH\s*approved/i
    ]

    certPatterns.forEach(pattern => {
      const match = text.match(pattern)
      if (match) {
        certifications.push(match[0])
      }
    })

    return certifications
  }

  /**
   * Extract standards from text
   */
  private extractStandards(text: string): string[] {
    const standards: string[] = []
    const standardPatterns = [
      /ASTM\s*[A-Z]\d+/i,
      /ANSI\s*[A-Z0-9\.]+/i,
      /MIL-STD-\d+/i,
      /EN\s*\d+/i
    ]

    standardPatterns.forEach(pattern => {
      const matches = text.match(new RegExp(pattern, 'gi'))
      if (matches) {
        standards.push(...matches)
      }
    })

    return Array.from(new Set(standards)) // Deduplicate
  }

  /**
   * Extract packaging information
   */
  private extractPackaging(text: string): string | undefined {
    const packagingMatch = text.match(/(\d+)\s*(?:per|\/)\s*(box|case|pack|carton|each)/i)
    if (packagingMatch) {
      return packagingMatch[0]
    }
    return undefined
  }

  /**
   * Extract unit of measure
   */
  private extractUnit(text: string): string | undefined {
    const unitMatch = text.match(/\b(EA|BX|CS|DZ|PK|RL|GL|LB|KG|PC|PR)\b/i)
    return unitMatch ? unitMatch[1].toUpperCase() : undefined
  }

  /**
   * Clean product name by removing specifications
   */
  private cleanProductName(name: string): string {
    // Remove common specification patterns
    let clean = name
      .replace(/\d+\s*(?:gauge|ga|mil)\b/gi, '')
      .replace(/\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?(?:\s*(?:x|×)\s*\d+(?:\.\d+)?)?/gi, '')
      .replace(/\b(?:white|black|blue|green|red|yellow|gray|grey|clear)\b/gi, '')
      .replace(/\b(?:latex|nitrile|vinyl|plastic|metal|steel|cotton|polyester)\b/gi, '')
      .trim()

    // Remove extra spaces
    return clean.replace(/\s+/g, ' ')
  }

  /**
   * Extract additional product information
   */
  private extractAdditionalInfo(text: string): Partial<IProductRequirement> {
    const info: Partial<IProductRequirement> = {}

    // Extract manufacturer
    const mfgMatch = text.match(/(?:mfg|manufacturer|brand):\s*([^\s,]+)/i)
    if (mfgMatch) {
      info.manufacturer = mfgMatch[1]
    }

    // Extract part number
    const partMatch = text.match(/(?:p\/n|part\s*#|sku):\s*([^\s,]+)/i)
    if (partMatch) {
      info.partNumber = partMatch[1]
    }

    return info
  }

  /**
   * Deduplicate products based on name and specifications
   */
  private deduplicateProducts(products: IProductRequirement[]): IProductRequirement[] {
    const seen = new Map<string, IProductRequirement>()
    
    products.forEach(product => {
      const key = `${product.name}-${JSON.stringify(product.specifications)}`
      const existing = seen.get(key)
      
      if (existing) {
        // Merge quantities
        existing.quantity += product.quantity
        // Merge other fields if missing
        if (!existing.partNumber && product.partNumber) {
          existing.partNumber = product.partNumber
        }
        if (!existing.manufacturer && product.manufacturer) {
          existing.manufacturer = product.manufacturer
        }
      } else {
        seen.set(key, { ...product })
      }
    })

    return Array.from(seen.values())
  }

  /**
   * Extract delivery requirements
   */
  private extractDeliveryRequirements(text: string): string {
    const deliveryPatterns = [
      /delivery\s*requirements?:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
      /ship(?:ping|ment)\s*to:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
      /delivery\s*date:?\s*([^\n]+)/i,
      /required\s*delivery:?\s*([^\n]+)/i
    ]

    for (const pattern of deliveryPatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    return ''
  }

  /**
   * Extract compliance requirements
   */
  private extractComplianceRequirements(text: string): string[] {
    const requirements: string[] = []
    
    // FAR/DFARS clauses
    const farMatches = text.match(/(?:FAR|DFARS)\s*\d+\.\d+(?:-\d+)?/gi)
    if (farMatches) {
      requirements.push(...farMatches)
    }

    // Buy American Act
    if (/buy\s*american\s*act/i.test(text)) {
      requirements.push('Buy American Act')
    }

    // Trade Agreements Act
    if (/trade\s*agreements?\s*act/i.test(text)) {
      requirements.push('Trade Agreements Act')
    }

    // Small Business Set-Aside
    if (/small\s*business\s*set-aside/i.test(text)) {
      requirements.push('Small Business Set-Aside')
    }

    return Array.from(new Set(requirements))
  }

  /**
   * Extract special instructions
   */
  private extractSpecialInstructions(text: string): string {
    const instructionPatterns = [
      /special\s*instructions?:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
      /notes?:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
      /additional\s*requirements?:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i
    ]

    for (const pattern of instructionPatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    return ''
  }

  /**
   * Generate cache key for document
   */
  private generateCacheKey(input: { url: string } | { buffer: Buffer; fileName: string }): string {
    if ('url' in input) {
      return `ocr:url:${crypto.createHash('md5').update(input.url).digest('hex')}`
    } else {
      return `ocr:buffer:${crypto.createHash('md5').update(input.buffer).digest('hex')}`
    }
  }

  /**
   * Check cache for existing result
   */
  private async checkCache(key: string): Promise<IOCRResult | null> {
    try {
      const cached = await cache.get(key)
      if (cached) {
        return cached as IOCRResult
      }
    } catch (error) {
      apiLogger.warn('Cache check failed', error as Error)
    }
    return null
  }

  /**
   * Cache OCR result
   */
  private async cacheResult(key: string, result: IOCRResult): Promise<void> {
    try {
      // Cache for 7 days
      await cache.set(key, result, 7 * 24 * 60 * 60)
    } catch (error) {
      apiLogger.warn('Cache write failed', error as Error)
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'tiff': 'image/tiff',
      'bmp': 'image/bmp'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  /**
   * Estimate page count for cost calculation
   */
  estimatePageCount(fileSize: number, fileType: string): number {
    // Rough estimates based on file type and size
    if (fileType === 'application/pdf') {
      // Average PDF page is about 100KB
      return Math.max(1, Math.ceil(fileSize / (100 * 1024)))
    } else {
      // Images are typically 1 page
      return 1
    }
  }

  /**
   * Calculate OCR cost
   */
  calculateCost(pageCount: number): number {
    return pageCount * this.costPerPage
  }
}

// Export singleton instance
export const mistralDocumentOCR = new MistralDocumentOCRClient()

// Export class for testing
export { MistralDocumentOCRClient }

// Export types are already exported above with their definitions
/**
 * SAM.gov Document Processor
 * Downloads and processes contract documents using Mistral OCR
 */

import { mistralOCR } from '@/lib/ai/mistral-ocr-client'
import { Database } from '@/types/database.types'
import { createClient } from '@supabase/supabase-js'
import { ExternalAPIError, DatabaseError } from '@/lib/errors/types'
import { syncLogger } from '@/lib/errors/logger'

interface IDocumentProcessingResult {
  documentId: string
  fileName: string
  extractedText: string
  structuredData: any
  requirements: IProductRequirement[]
  processingTime: number
}

interface IProductRequirement {
  productName: string
  specifications: Record<string, any>
  quantity: number
  unit: string
  requiredCertifications: string[]
  requiredStandards: string[]
  packagingRequirements?: string
  deliveryDate?: Date
}

export class SAMDocumentProcessor {
  private supabase: ReturnType<typeof createClient<Database>>

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Download document from SAM.gov resource link
   */
  async downloadDocument(resourceUrl: string, apiKey: string): Promise<Buffer> {
    try {
      // Add API key to the URL for authentication
      const url = new URL(resourceUrl)
      url.searchParams.append('api_key', apiKey)

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      })

      if (!response.ok) {
        throw new ExternalAPIError('SAM.gov', `Document download failed: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      return Buffer.from(buffer)
    } catch (error) {
      syncLogger.error('Document download failed', error as Error, { resourceUrl })
      throw error
    }
  }

  /**
   * Process opportunity documents
   */
  async processOpportunityDocuments(
    opportunityId: string,
    resourceLinks: string[],
    apiKey: string
  ): Promise<IDocumentProcessingResult[]> {
    const results: IDocumentProcessingResult[] = []

    for (const [index, link] of resourceLinks.entries()) {
      try {
        syncLogger.info('Processing document', { 
          opportunityId, 
          documentIndex: index + 1,
          totalDocuments: resourceLinks.length 
        })

        // Download the document
        const documentBuffer = await this.downloadDocument(link, apiKey)
        
        // Extract filename from URL
        const fileName = this.extractFileName(link)

        // Save document reference to database
        const { data: documentRecord, error: dbError } = await this.supabase
          .from('contract_documents')
          .insert({
            opportunity_id: opportunityId,
            file_name: fileName,
            file_url: link,
            file_type: this.getFileType(fileName),
            ocr_status: 'processing'
          })
          .select()
          .single()

        if (dbError) {
          throw new DatabaseError('Failed to save document record', undefined, dbError)
        }

        // Process with Mistral OCR
        const startTime = Date.now()
        const ocrResult = await mistralOCR.processDocumentBuffer(documentBuffer, fileName)
        const processingTime = Date.now() - startTime

        // Extract product requirements
        const requirements = this.extractProductRequirements(ocrResult.structuredData)

        // Save requirements to database
        if (requirements.length > 0) {
          const requirementRecords = requirements.map(req => ({
            document_id: documentRecord.id,
            product_name: req.productName,
            specifications: req.specifications,
            quantity: req.quantity,
            unit: req.unit,
            required_certifications: req.requiredCertifications,
            required_standards: req.requiredStandards,
            packaging_requirements: req.packagingRequirements,
            delivery_date: req.deliveryDate
          }))

          const { error: reqError } = await this.supabase
            .from('product_requirements')
            .insert(requirementRecords)

          if (reqError) {
            syncLogger.error('Failed to save requirements', reqError)
          }
        }

        // Update document status
        await this.supabase
          .from('contract_documents')
          .update({
            ocr_status: 'completed',
            ocr_result: ocrResult,
            extracted_requirements: requirements
          })
          .eq('id', documentRecord.id)

        results.push({
          documentId: documentRecord.id,
          fileName,
          extractedText: ocrResult.text,
          structuredData: ocrResult.structuredData,
          requirements,
          processingTime
        })

      } catch (error) {
        syncLogger.error('Document processing failed', error as Error, { 
          opportunityId, 
          documentLink: link 
        })
        // Continue processing other documents
      }
    }

    return results
  }

  /**
   * Extract product requirements from OCR structured data
   */
  private extractProductRequirements(structuredData: any): IProductRequirement[] {
    const requirements: IProductRequirement[] = []

    // Handle different possible structures from Mistral OCR
    const products = structuredData.products || structuredData.items || []

    for (const product of products) {
      const requirement: IProductRequirement = {
        productName: product.name || product.description || 'Unknown Product',
        specifications: this.extractSpecifications(product),
        quantity: parseInt(product.quantity) || 0,
        unit: product.unit || product.unitOfMeasure || 'EA',
        requiredCertifications: this.extractCertifications(product),
        requiredStandards: this.extractStandards(product),
        packagingRequirements: product.packaging || product.packagingRequirements,
        deliveryDate: product.deliveryDate ? new Date(product.deliveryDate) : undefined
      }

      requirements.push(requirement)
    }

    // Also try to extract from tables if present
    if (structuredData.tables) {
      for (const table of structuredData.tables) {
        const tableRequirements = this.extractRequirementsFromTable(table)
        requirements.push(...tableRequirements)
      }
    }

    return requirements
  }

  /**
   * Extract specifications from product data
   */
  private extractSpecifications(product: any): Record<string, any> {
    const specs: Record<string, any> = {}

    // Common specification fields
    const specFields = [
      'size', 'color', 'material', 'dimensions', 'weight',
      'capacity', 'power', 'voltage', 'frequency', 'temperature',
      'pressure', 'grade', 'class', 'type', 'model', 'manufacturer'
    ]

    for (const field of specFields) {
      if (product[field]) {
        specs[field] = product[field]
      }
    }

    // Also include any fields in a specifications object
    if (product.specifications) {
      Object.assign(specs, product.specifications)
    }

    return specs
  }

  /**
   * Extract certifications from product data
   */
  private extractCertifications(product: any): string[] {
    const certs: string[] = []

    // Check various fields
    if (product.certifications) {
      if (Array.isArray(product.certifications)) {
        certs.push(...product.certifications)
      } else if (typeof product.certifications === 'string') {
        certs.push(...product.certifications.split(/[,;]/))
      }
    }

    // Look for common certification patterns in text
    const certPatterns = [
      /FDA\s*(?:510\(k\)|clearance|approved)/gi,
      /CE\s*mark/gi,
      /ISO\s*\d+/gi,
      /NIOSH\s*(?:approved|certified)/gi,
      /UL\s*(?:listed|certified)/gi
    ]

    const textToSearch = JSON.stringify(product)
    for (const pattern of certPatterns) {
      const matches = textToSearch.match(pattern)
      if (matches) {
        certs.push(...matches)
      }
    }

    return [...new Set(certs)] // Remove duplicates
  }

  /**
   * Extract standards from product data
   */
  private extractStandards(product: any): string[] {
    const standards: string[] = []

    if (product.standards) {
      if (Array.isArray(product.standards)) {
        standards.push(...product.standards)
      } else if (typeof product.standards === 'string') {
        standards.push(...product.standards.split(/[,;]/))
      }
    }

    // Look for standard patterns
    const standardPatterns = [
      /ASTM\s*[A-Z]\d+/gi,
      /ANSI\s*[A-Z]\d+/gi,
      /MIL-STD-\d+/gi,
      /NFPA\s*\d+/gi
    ]

    const textToSearch = JSON.stringify(product)
    for (const pattern of standardPatterns) {
      const matches = textToSearch.match(pattern)
      if (matches) {
        standards.push(...matches)
      }
    }

    return [...new Set(standards)]
  }

  /**
   * Extract requirements from table data
   */
  private extractRequirementsFromTable(table: any): IProductRequirement[] {
    const requirements: IProductRequirement[] = []

    // This would need to be customized based on actual table structures
    // For now, a basic implementation
    if (table.rows && table.headers) {
      const headers = table.headers.map((h: string) => h.toLowerCase())
      const productIndex = headers.findIndex((h: string) => 
        h.includes('product') || h.includes('item') || h.includes('description')
      )
      const quantityIndex = headers.findIndex((h: string) => 
        h.includes('quantity') || h.includes('qty')
      )

      if (productIndex >= 0) {
        for (const row of table.rows) {
          const requirement: IProductRequirement = {
            productName: row[productIndex] || 'Unknown',
            specifications: {},
            quantity: quantityIndex >= 0 ? parseInt(row[quantityIndex]) || 0 : 0,
            unit: 'EA',
            requiredCertifications: [],
            requiredStandards: []
          }
          requirements.push(requirement)
        }
      }
    }

    return requirements
  }

  /**
   * Extract filename from URL
   */
  private extractFileName(url: string): string {
    const urlParts = url.split('/')
    const fileId = urlParts[urlParts.length - 2] // The ID before /download
    return `sam_document_${fileId}.pdf` // Assume PDF for now
  }

  /**
   * Get file type from filename
   */
  private getFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase()
    const typeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    return typeMap[extension || 'pdf'] || 'application/octet-stream'
  }
}
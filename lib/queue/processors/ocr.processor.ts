/**
 * OCR Job Processor
 * Handles document processing jobs from the queue
 */

import { Job } from 'bull'
import { IOCRJob } from '../index'
import { mistralDocumentOCR } from '@/lib/ai/mistral-document-ocr-client'
import { createServerClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/errors/logger'

export async function processOCRJob(job: Job<IOCRJob>) {
  const { 
    opportunityId, 
    documentId, 
    documentUrl, 
    fileName, 
    companyId, 
    userId 
  } = job.data

  try {
    apiLogger.info('Processing OCR job', {
      jobId: job.id,
      opportunityId,
      documentId,
      fileName
    })

    // Update job progress
    await job.progress(10)

    // Download document
    const response = await fetch(documentUrl)
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await job.progress(30)

    // Process with OCR
    const ocrResult = await mistralDocumentOCR.processDocument(
      { buffer, fileName },
      { 
        structuredOutput: true,
        includeImageBase64: false
      }
    )

    await job.progress(70)

    // Save to database
    const supabase = await createServerClient()
    
    // Save document processing result
    const { error: docError } = await supabase
      .from('contract_documents')
      .update({
        ocr_text: ocrResult.pages.map(p => p.text).join('\n\n'),
        ocr_metadata: {
          pageCount: ocrResult.metadata.pageCount,
          processingTimeMs: ocrResult.metadata.processingTimeMs,
          model: ocrResult.metadata.model,
          structuredData: ocrResult.structuredData
        },
        processed_at: new Date().toISOString(),
        status: 'processed'
      })
      .eq('id', documentId)
      .eq('company_id', companyId) // RLS check

    if (docError) {
      throw new Error(`Failed to update document: ${docError.message}`)
    }

    // Save extracted products
    if (ocrResult.structuredData?.products && ocrResult.structuredData.products.length > 0) {
      const products = ocrResult.structuredData.products.map(product => ({
        opportunity_id: opportunityId,
        document_id: documentId,
        company_id: companyId,
        name: product.name,
        description: product.description,
        specifications: product.specifications,
        quantity: product.quantity,
        unit: product.unit,
        part_number: product.partNumber,
        manufacturer: product.manufacturer,
        certifications: product.certifications,
        standards: product.standards,
        packaging: product.packaging,
        delivery_date: product.deliveryDate,
        estimated_price: product.estimatedPrice,
        alternative_products: product.alternativeProducts,
        created_by: userId
      }))

      const { error: productsError } = await supabase
        .from('product_requirements')
        .insert(products)

      if (productsError) {
        apiLogger.warn('Failed to save products', productsError)
      }
    }

    await job.progress(90)

    // Log processing
    await supabase
      .from('document_processing_logs')
      .insert({
        document_id: documentId,
        company_id: companyId,
        user_id: userId,
        status: 'success',
        processing_time_ms: ocrResult.metadata.processingTimeMs,
        page_count: ocrResult.metadata.pageCount,
        products_extracted: ocrResult.structuredData?.products?.length || 0,
        cost: mistralDocumentOCR.calculateCost(ocrResult.metadata.pageCount)
      })

    await job.progress(100)

    apiLogger.info('OCR job completed successfully', {
      jobId: job.id,
      documentId,
      pageCount: ocrResult.metadata.pageCount,
      productsExtracted: ocrResult.structuredData?.products?.length || 0
    })

    return {
      success: true,
      documentId,
      pageCount: ocrResult.metadata.pageCount,
      productsExtracted: ocrResult.structuredData?.products?.length || 0,
      processingTimeMs: ocrResult.metadata.processingTimeMs
    }

  } catch (error) {
    apiLogger.error('OCR job failed', error as Error, {
      jobId: job.id,
      documentId,
      attemptsMade: job.attemptsMade
    })

    // Log failure
    try {
      const supabase = await createServerClient()
      await supabase
        .from('document_processing_logs')
        .insert({
          document_id: documentId,
          company_id: companyId,
          user_id: userId,
          status: 'failed',
          error_message: (error as Error).message,
          attempt_number: job.attemptsMade + 1
        })

      // Update document status
      await supabase
        .from('contract_documents')
        .update({
          status: 'failed',
          error_message: (error as Error).message
        })
        .eq('id', documentId)
        .eq('company_id', companyId)
    } catch (logError) {
      apiLogger.error('Failed to log OCR error', logError as Error)
    }

    throw error
  }
}
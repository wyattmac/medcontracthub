import { routeHandler } from '@/lib/api/route-handler'
import { mistralOCR } from '@/lib/ai/mistral-ocr-client'
import { NextResponse } from 'next/server'
import { ValidationError } from '@/lib/errors/types'
import { validateFile, FILE_VALIDATION_CONFIGS } from '@/lib/security/file-validator'

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new ValidationError('No file provided')
    }

    // Comprehensive file validation with security checks
    const validationResult = await validateFile(file, FILE_VALIDATION_CONFIGS.upload)
    
    if (!validationResult.isValid) {
      throw new ValidationError(
        `File validation failed: ${validationResult.securityIssues.join(', ')}`,
        { 
          securityIssues: validationResult.securityIssues,
          detectedType: validationResult.actualMimeType 
        }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `ocr_${user.id}_${timestamp}_${sanitizedName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new ValidationError('Failed to upload file')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Process with OCR
    const result = await mistralOCR.extractStructuredData(publicUrl)

    // Store OCR result in database
    const { data: ocrRecord, error: dbError } = await supabase
      .from('document_ocr_results')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        storage_path: fileName,
        ocr_text: result.text,
        metadata: result.metadata,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('documents').remove([fileName])
      throw new ValidationError('Failed to save OCR results')
    }

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'ocr_upload',
        entity_type: 'document',
        entity_id: ocrRecord.id,
        details: { 
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      })

    return NextResponse.json({
      success: true,
      data: {
        id: ocrRecord.id,
        fileName: file.name,
        text: result.text,
        metadata: result.metadata,
        publicUrl,
      },
    })
  },
  { 
    requireAuth: true,
    rateLimit: 'upload',
    requireCSRF: true
  }
)
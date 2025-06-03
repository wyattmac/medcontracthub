import { z } from 'zod'
import { routeHandler } from '@/lib/api/route-handler'
import { mistralOCR } from '@/lib/ai/mistral-ocr-client'
import { NextResponse } from 'next/server'

const processOCRSchema = z.object({
  documentUrl: z.string().url('Invalid document URL'),
  extractStructured: z.boolean().optional().default(false),
})

export const POST = routeHandler.POST(
  async ({ request, user, supabase }) => {
    const body = await request.json()
    const { documentUrl, extractStructured } = processOCRSchema.parse(body)

    // Log OCR request
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'ocr_process',
        entity_type: 'document',
        entity_id: documentUrl,
        details: { extractStructured },
      })

    // Process document with OCR
    if (extractStructured) {
      const result = await mistralOCR.extractStructuredData(documentUrl)
      
      return NextResponse.json({
        success: true,
        data: result,
      })
    } else {
      const text = await mistralOCR.extractTextFromDocument(documentUrl)
      
      return NextResponse.json({
        success: true,
        data: { text },
      })
    }
  },
  { 
    requireAuth: true,
    validateBody: processOCRSchema,
  }
)
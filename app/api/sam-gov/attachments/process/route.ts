import { NextRequest, NextResponse } from 'next/server';
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler';
import { SamGovAttachmentExtractor } from '@/lib/sam-gov/attachment-extractor';
import { MistralAttachmentProcessor } from '@/lib/ai/mistral-attachment-processor';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

const ProcessAttachmentsSchema = z.object({
  noticeIds: z.array(z.string()).min(1).max(10),
  analyzeRelevance: z.boolean().optional().default(true),
  extractStructuredData: z.boolean().optional().default(true),
});

export const POST = enhancedRouteHandler(
  async (req: NextRequest) => {
    const { noticeIds, analyzeRelevance, extractStructuredData } = 
      ProcessAttachmentsSchema.parse(await req.json());

    // Initialize clients
    const supabase = createServerClient();
    const samExtractor = new SamGovAttachmentExtractor(
      process.env.SAM_GOV_API_KEY!
    );
    const mistralProcessor = new MistralAttachmentProcessor(
      process.env.MISTRAL_API_KEY!
    );

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      // Fetch opportunities from database
      const { data: opportunities, error: dbError } = await supabase
        .from('opportunities')
        .select('*')
        .in('notice_id', noticeIds);

      if (dbError || !opportunities) {
        throw new Error('Failed to fetch opportunities');
      }

      // Extract attachment URLs
      const attachmentInfos = await samExtractor.extractAttachmentUrls(opportunities);
      
      if (attachmentInfos.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No attachments found for the specified opportunities',
          processed: 0,
          results: []
        });
      }

      logger.info('Found attachments to process', {
        count: attachmentInfos.length,
        noticeIds
      });

      // Download attachments
      const downloadedAttachments = await samExtractor.downloadAttachments(
        attachmentInfos,
        { maxConcurrent: 3, delayMs: 1000 }
      );

      // Prepare attachments for processing
      const attachmentsToProcess = new Map<string, { buffer: Buffer; info: any }>();
      
      attachmentInfos.forEach(info => {
        const buffer = downloadedAttachments.get(info.url);
        if (buffer) {
          attachmentsToProcess.set(info.url, { buffer, info });
        }
      });

      // Process with Mistral OCR
      const processedResults = await mistralProcessor.processAttachments(
        attachmentsToProcess,
        {
          maxConcurrent: 2,
          onProgress: (processed, total) => {
            logger.info('Processing attachments', { processed, total });
          }
        }
      );

      // Enhance results with medical relevance analysis if requested
      if (analyzeRelevance) {
        for (const result of processedResults) {
          if (result.extractedText && !result.error) {
            const relevance = await mistralProcessor.analyzeMedicalRelevance(
              result.extractedText
            );
            result.structuredData = {
              ...result.structuredData,
              medicalRelevance: relevance
            };
          }
        }
      }

      // Store processed documents in database
      const documentsToInsert = processedResults.map(result => ({
        opportunity_id: opportunities.find(o => o.notice_id === result.noticeId)?.id,
        notice_id: result.noticeId,
        file_name: result.fileName,
        extracted_text: result.extractedText,
        structured_data: result.structuredData,
        metadata: result.metadata,
        processing_time_ms: result.processingTime,
        processing_error: result.error,
        processed_at: new Date().toISOString(),
        user_id: user.id
      }));

      const { error: insertError } = await supabase
        .from('contract_documents')
        .insert(documentsToInsert);

      if (insertError) {
        logger.error('Failed to store processed documents', { error: insertError });
      }

      // Return summary of processed attachments
      const summary = {
        success: true,
        processed: processedResults.length,
        failed: processedResults.filter(r => r.error).length,
        totalProcessingTime: processedResults.reduce((sum, r) => sum + r.processingTime, 0),
        results: processedResults.map(r => ({
          noticeId: r.noticeId,
          fileName: r.fileName,
          pageCount: r.metadata.pageCount,
          hasStructuredData: !!r.structuredData,
          isMedicalRelated: r.structuredData?.medicalRelevance?.isMedicalRelated,
          relevanceScore: r.structuredData?.medicalRelevance?.relevanceScore,
          error: r.error
        }))
      };

      return NextResponse.json(summary);

    } catch (error) {
      logger.error('Error processing attachments', { error, noticeIds });
      throw error;
    }
  },
  {
    rateLimit: {
      requests: 10,
      window: '1m'
    },
    requiredPermissions: ['process:attachments'],
    cache: false
  }
);

// GET endpoint to check processing status
export const GET = enhancedRouteHandler(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const noticeId = searchParams.get('noticeId');

    if (!noticeId) {
      return NextResponse.json(
        { error: 'noticeId parameter required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch processed documents
    const { data, error } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      noticeId,
      documentsProcessed: data?.length || 0,
      documents: data || []
    });
  },
  {
    rateLimit: {
      requests: 30,
      window: '1m'
    },
    cache: {
      revalidate: 60 // Cache for 1 minute
    }
  }
);
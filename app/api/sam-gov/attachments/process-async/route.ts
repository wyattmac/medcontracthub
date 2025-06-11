import { NextRequest, NextResponse } from 'next/server';
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler';
import { samAttachmentProcessor } from '@/lib/sam-gov/attachment-processor';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/errors/logger';
import { z } from 'zod';

const ProcessAttachmentsAsyncSchema = z.object({
  noticeIds: z.array(z.string()).min(1).max(10),
  maxAttachments: z.number().optional().default(5),
  waitForCompletion: z.boolean().optional().default(false),
  timeoutMs: z.number().optional().default(300000), // 5 minutes
});

export const POST = enhancedRouteHandler(
  async (req: NextRequest) => {
    const { noticeIds, maxAttachments, waitForCompletion, timeoutMs } = 
      ProcessAttachmentsAsyncSchema.parse(await req.json());

    // Initialize clients
    const supabase = createServerClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const results: any[] = [];

      // Process each notice ID
      for (const noticeId of noticeIds) {
        logger.info('Processing attachments for notice', { noticeId });

        // Submit attachments for async processing
        const { documentIds, attachments } = await samAttachmentProcessor
          .processOpportunityAttachmentsAsync(
            noticeId,
            user.id,
            user.user_metadata?.organization_id,
            maxAttachments
          );

        results.push({
          noticeId,
          documentIds,
          attachmentCount: attachments.length,
          attachments: attachments.map(a => ({
            filename: a.filename,
            url: a.url
          }))
        });

        // Store document processing records
        if (documentIds.length > 0) {
          const records = documentIds.map((docId, index) => ({
            document_id: docId,
            opportunity_id: noticeId,
            notice_id: noticeId,
            file_name: attachments[index]?.filename || `attachment_${index}`,
            status: 'pending',
            user_id: user.id,
            created_at: new Date().toISOString()
          }));

          const { error: insertError } = await supabase
            .from('document_processing_queue')
            .insert(records);

          if (insertError) {
            logger.error('Failed to store processing records', { error: insertError });
          }
        }
      }

      // If requested, wait for completion
      if (waitForCompletion && results.length > 0) {
        const allDocumentIds = results.flatMap(r => r.documentIds);
        
        logger.info('Waiting for document processing completion', {
          documentCount: allDocumentIds.length,
          timeoutMs
        });

        const processedResults = await samAttachmentProcessor
          .waitForAttachmentProcessing(allDocumentIds, timeoutMs);

        // Update results with processed data
        for (const result of results) {
          result.processedDocuments = [];
          
          for (const docId of result.documentIds) {
            const processedDoc = processedResults.get(docId);
            if (processedDoc) {
              result.processedDocuments.push({
                documentId: docId,
                status: 'completed',
                pageCount: processedDoc.total_pages,
                extractedText: processedDoc.full_text?.substring(0, 500) + '...',
                tables: processedDoc.tables?.length || 0,
                requirements: processedDoc.requirements?.length || 0
              });

              // Update database with results
              const { error: updateError } = await supabase
                .from('contract_documents')
                .upsert({
                  document_id: docId,
                  notice_id: result.noticeId,
                  extracted_text: processedDoc.full_text,
                  structured_data: {
                    tables: processedDoc.tables,
                    requirements: processedDoc.requirements,
                    metadata: processedDoc.metadata
                  },
                  page_count: processedDoc.total_pages,
                  processing_status: 'completed',
                  processed_at: new Date().toISOString(),
                  user_id: user.id
                });

              if (updateError) {
                logger.error('Failed to update processed document', { 
                  error: updateError,
                  documentId: docId 
                });
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          async: false,
          message: 'Attachments processed successfully',
          results,
          summary: {
            totalNotices: noticeIds.length,
            totalDocuments: allDocumentIds.length,
            processedDocuments: processedResults.size
          }
        });
      }

      // Return immediately with document IDs for tracking
      return NextResponse.json({
        success: true,
        async: true,
        message: 'Attachments submitted for processing',
        results,
        summary: {
          totalNotices: noticeIds.length,
          totalDocuments: results.reduce((sum, r) => sum + r.documentIds.length, 0)
        },
        statusEndpoint: '/api/sam-gov/attachments/status'
      });

    } catch (error) {
      logger.error('Error processing attachments async', { error, noticeIds });
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

// GET endpoint to check async processing status
export const GET = enhancedRouteHandler(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const documentIds = searchParams.get('documentIds')?.split(',') || [];
    const noticeId = searchParams.get('noticeId');

    if (documentIds.length === 0 && !noticeId) {
      return NextResponse.json(
        { error: 'documentIds or noticeId parameter required' },
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

    try {
      if (documentIds.length > 0) {
        // Check status of specific documents
        const status = await samAttachmentProcessor
          .checkAttachmentProcessingStatus(documentIds);

        // Fetch completed results from database
        const { data: dbResults } = await supabase
          .from('contract_documents')
          .select('*')
          .in('document_id', status.completed)
          .eq('user_id', user.id);

        return NextResponse.json({
          documentIds,
          status: {
            completed: status.completed.length,
            processing: status.processing.length,
            failed: status.failed.length
          },
          documents: dbResults || [],
          details: {
            completed: status.completed,
            processing: status.processing,
            failed: status.failed
          }
        });
      } else if (noticeId) {
        // Check all documents for a notice
        const { data: queuedDocs } = await supabase
          .from('document_processing_queue')
          .select('document_id')
          .eq('notice_id', noticeId)
          .eq('user_id', user.id);

        if (!queuedDocs || queuedDocs.length === 0) {
          return NextResponse.json({
            noticeId,
            status: 'not_found',
            message: 'No documents found for this notice'
          });
        }

        const docIds = queuedDocs.map(d => d.document_id);
        const status = await samAttachmentProcessor
          .checkAttachmentProcessingStatus(docIds);

        return NextResponse.json({
          noticeId,
          documentIds: docIds,
          status: {
            completed: status.completed.length,
            processing: status.processing.length,
            failed: status.failed.length
          },
          details: {
            completed: status.completed,
            processing: status.processing,
            failed: status.failed
          }
        });
      }
    } catch (error) {
      logger.error('Error checking processing status', { error });
      throw error;
    }
  },
  {
    rateLimit: {
      requests: 30,
      window: '1m'
    },
    cache: {
      revalidate: 5 // Cache for 5 seconds
    }
  }
);
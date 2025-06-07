import { Mistral } from '@mistralai/mistralai';
import { logger } from '@/lib/monitoring/logger';
import type { AttachmentInfo } from '@/lib/sam-gov/attachment-extractor';

export interface ProcessedAttachment {
  noticeId: string;
  fileName: string;
  extractedText: string;
  metadata: {
    pageCount?: number;
    language?: string;
    confidence?: number;
  };
  structuredData?: any;
  processingTime: number;
  error?: string;
}

export interface ContractDetails {
  contractNumber?: string;
  deadline?: string;
  contactEmail?: string;
  contactPhone?: string;
  totalValue?: string;
  deliveryDate?: string;
  technicalRequirements?: string[];
  certificationRequirements?: string[];
}

export class MistralAttachmentProcessor {
  private client: Mistral;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Mistral({ apiKey });
  }

  /**
   * Process a single attachment buffer with OCR
   */
  async processAttachment(
    buffer: Buffer, 
    attachmentInfo: AttachmentInfo
  ): Promise<ProcessedAttachment> {
    const startTime = Date.now();

    try {
      // Upload file to Mistral
      const uploadedFile = await this.client.files.upload({
        file: {
          name: attachmentInfo.fileName || 'document.pdf',
          content: buffer,
        },
        purpose: 'ocr'
      });

      // Get signed URL for processing
      const signedUrl = await this.client.files.getSignedUrl({
        fileId: uploadedFile.id
      });

      // Process with OCR
      const ocrResponse = await this.client.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: signedUrl.url
        },
        includeImageBase64: false // Don't include images to save bandwidth
      });

      // Extract text from all pages
      let extractedText = '';
      const pageCount = ocrResponse.pages?.length || 0;

      if (ocrResponse.pages) {
        extractedText = ocrResponse.pages
          .map(page => page.markdown || '')
          .join('\n\n---PAGE BREAK---\n\n');
      }

      // Try to extract structured data
      const structuredData = await this.extractStructuredData(
        extractedText, 
        attachmentInfo.title
      );

      return {
        noticeId: attachmentInfo.noticeId,
        fileName: attachmentInfo.fileName || 'unknown',
        extractedText,
        metadata: {
          pageCount,
          language: 'en', // Mistral OCR primarily supports English
          confidence: 0.95 // Mistral OCR is highly accurate
        },
        structuredData,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Error processing attachment with Mistral OCR', {
        fileName: attachmentInfo.fileName,
        noticeId: attachmentInfo.noticeId,
        error
      });

      return {
        noticeId: attachmentInfo.noticeId,
        fileName: attachmentInfo.fileName || 'unknown',
        extractedText: '',
        metadata: {},
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract structured contract details from text
   */
  async extractStructuredData(
    text: string, 
    title: string
  ): Promise<ContractDetails | null> {
    try {
      const prompt = `Extract the following information from this government contract document:
      - Contract/Solicitation Number
      - Submission Deadline
      - Contact Email
      - Contact Phone
      - Total Contract Value or Budget
      - Delivery Date
      - Technical Requirements (list main ones)
      - Certification Requirements (e.g., FDA, ISO, etc.)
      
      Return as JSON with these exact field names: contractNumber, deadline, contactEmail, contactPhone, totalValue, deliveryDate, technicalRequirements (array), certificationRequirements (array).
      
      If a field is not found, omit it from the response.
      
      Document Title: ${title}
      
      Document Text:
      ${text.substring(0, 8000)} // Limit to avoid token limits
      `;

      const response = await this.client.chat.complete({
        model: 'mistral-small-latest',
        messages: [{
          role: 'user',
          content: prompt
        }],
        responseFormat: { type: 'json_object' }
      });

      if (response.choices?.[0]?.message?.content) {
        const extracted = JSON.parse(response.choices[0].message.content);
        return extracted as ContractDetails;
      }

      return null;
    } catch (error) {
      logger.error('Error extracting structured data', { error });
      return null;
    }
  }

  /**
   * Process multiple attachments in batch
   */
  async processAttachments(
    attachments: Map<string, { buffer: Buffer; info: AttachmentInfo }>,
    options: {
      maxConcurrent?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<ProcessedAttachment[]> {
    const { maxConcurrent = 2, onProgress } = options;
    const results: ProcessedAttachment[] = [];
    const entries = Array.from(attachments.entries());
    let processed = 0;

    // Process in batches to manage API rate limits
    for (let i = 0; i < entries.length; i += maxConcurrent) {
      const batch = entries.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async ([url, { buffer, info }]) => {
        const result = await this.processAttachment(buffer, info);
        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      processed += batch.length;
      onProgress?.(processed, entries.length);

      // Add delay between batches to respect rate limits
      if (i + maxConcurrent < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return results;
  }

  /**
   * Perform Q&A on a processed document
   */
  async queryDocument(
    documentUrl: string,
    question: string
  ): Promise<string | null> {
    try {
      const response = await this.client.chat.complete({
        model: 'mistral-small-latest',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'document_url', documentUrl }
          ]
        }]
      });

      return response.choices?.[0]?.message?.content || null;
    } catch (error) {
      logger.error('Error querying document', { error });
      return null;
    }
  }

  /**
   * Analyze medical relevance of a contract
   */
  async analyzeMedicalRelevance(text: string): Promise<{
    isMedicalRelated: boolean;
    relevanceScore: number;
    medicalKeywords: string[];
    recommendation: string;
  }> {
    try {
      const prompt = `Analyze this government contract for medical/healthcare relevance:
      
      1. Is this contract related to medical supplies, healthcare services, or medical equipment?
      2. What medical-related keywords are present?
      3. On a scale of 0-100, how relevant is this to medical suppliers?
      4. Provide a brief recommendation for medical suppliers.
      
      Text: ${text.substring(0, 4000)}
      
      Return as JSON with fields: isMedicalRelated (boolean), relevanceScore (0-100), medicalKeywords (array), recommendation (string)`;

      const response = await this.client.chat.complete({
        model: 'mistral-small-latest',
        messages: [{
          role: 'user',
          content: prompt
        }],
        responseFormat: { type: 'json_object' }
      });

      if (response.choices?.[0]?.message?.content) {
        return JSON.parse(response.choices[0].message.content);
      }

      return {
        isMedicalRelated: false,
        relevanceScore: 0,
        medicalKeywords: [],
        recommendation: 'Unable to analyze document'
      };
    } catch (error) {
      logger.error('Error analyzing medical relevance', { error });
      return {
        isMedicalRelated: false,
        relevanceScore: 0,
        medicalKeywords: [],
        recommendation: 'Error during analysis'
      };
    }
  }
}
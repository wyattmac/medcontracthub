import { SamGovClient } from './client';
import { logger } from '@/lib/monitoring/logger';
import type { Opportunity } from '@/shared/types/database';

export interface AttachmentInfo {
  url: string;
  title: string;
  noticeId: string;
  fileName?: string;
  size?: number;
}

export class SamGovAttachmentExtractor {
  private client: SamGovClient;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new SamGovClient(apiKey);
  }

  /**
   * Extract attachment URLs from opportunities
   */
  async extractAttachmentUrls(opportunities: Opportunity[]): Promise<AttachmentInfo[]> {
    const attachments: AttachmentInfo[] = [];

    for (const opportunity of opportunities) {
      try {
        // Check resourceLinks field for attachment URLs
        if (opportunity.resource_links && Array.isArray(opportunity.resource_links)) {
          for (const link of opportunity.resource_links) {
            // Extract filename from URL if possible
            const urlParts = link.split('/');
            const fileName = urlParts[urlParts.length - 1] || `attachment_${opportunity.notice_id}`;

            attachments.push({
              url: link,
              title: opportunity.title,
              noticeId: opportunity.notice_id,
              fileName: fileName
            });
          }
        }

        // Also check for attachments in the links field (alternative format)
        if (opportunity.links && Array.isArray(opportunity.links)) {
          for (const linkObj of opportunity.links) {
            if (linkObj.rel === 'attachment' && linkObj.href) {
              const fileName = linkObj.title || `attachment_${opportunity.notice_id}`;
              
              attachments.push({
                url: linkObj.href,
                title: opportunity.title,
                noticeId: opportunity.notice_id,
                fileName: fileName
              });
            }
          }
        }
      } catch (error) {
        logger.error('Error extracting attachments from opportunity', {
          noticeId: opportunity.notice_id,
          error
        });
      }
    }

    return attachments;
  }

  /**
   * Download attachment from SAM.gov
   */
  async downloadAttachment(attachmentUrl: string): Promise<Buffer | null> {
    try {
      // Append API key to URL as required by SAM.gov
      const downloadUrl = attachmentUrl.includes('?') 
        ? `${attachmentUrl}&api_key=${this.apiKey}`
        : `${attachmentUrl}?api_key=${this.apiKey}`;

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        logger.error('Failed to download attachment', {
          url: attachmentUrl,
          status: response.status,
          statusText: response.statusText
        });
        return null;
      }

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      logger.error('Error downloading attachment', {
        url: attachmentUrl,
        error
      });
      return null;
    }
  }

  /**
   * Download multiple attachments with rate limiting
   */
  async downloadAttachments(
    attachments: AttachmentInfo[], 
    options: {
      maxConcurrent?: number;
      delayMs?: number;
    } = {}
  ): Promise<Map<string, Buffer>> {
    const { maxConcurrent = 3, delayMs = 1000 } = options;
    const results = new Map<string, Buffer>();

    // Process in batches to respect rate limits
    for (let i = 0; i < attachments.length; i += maxConcurrent) {
      const batch = attachments.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (attachment) => {
        const buffer = await this.downloadAttachment(attachment.url);
        if (buffer) {
          results.set(attachment.url, buffer);
        }
      });

      await Promise.all(batchPromises);

      // Add delay between batches
      if (i + maxConcurrent < attachments.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Get attachment metadata from SAM.gov
   */
  async getAttachmentMetadata(attachmentUrl: string): Promise<{
    contentType?: string;
    size?: number;
    lastModified?: string;
  } | null> {
    try {
      const headUrl = attachmentUrl.includes('?') 
        ? `${attachmentUrl}&api_key=${this.apiKey}`
        : `${attachmentUrl}?api_key=${this.apiKey}`;

      const response = await fetch(headUrl, { method: 'HEAD' });

      if (!response.ok) {
        return null;
      }

      return {
        contentType: response.headers.get('content-type') || undefined,
        size: parseInt(response.headers.get('content-length') || '0', 10) || undefined,
        lastModified: response.headers.get('last-modified') || undefined
      };
    } catch (error) {
      logger.error('Error getting attachment metadata', {
        url: attachmentUrl,
        error
      });
      return null;
    }
  }
}
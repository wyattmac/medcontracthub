/**
 * SAM.gov Attachment Download Proxy
 * Proxies attachment downloads with API key authentication
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { enhancedRouteHandler } from '@/lib/api/enhanced-route-handler'
import { logger } from '@/lib/errors/logger'

const downloadQuerySchema = z.object({
  url: z.string().url('Valid URL is required'),
  filename: z.string().optional()
})

export const GET = enhancedRouteHandler.GET(
  async ({ sanitizedQuery }) => {
    const { url, filename } = sanitizedQuery

    logger.info('Proxying SAM.gov attachment download', {
      url,
      filename,
      userId: user.id
    })

    try {
      const apiKey = process.env.SAM_GOV_API_KEY
      if (!apiKey) {
        throw new Error('SAM.gov API key not configured')
      }

      // Add API key to URL for authentication
      const downloadUrl = new URL(url)
      downloadUrl.searchParams.set('api_key', apiKey)

      // Fetch the file from SAM.gov
      const response = await fetch(downloadUrl.toString(), {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'User-Agent': 'MedContractHub/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`SAM.gov returned ${response.status}: ${response.statusText}`)
      }

      // Get the file content
      const fileBuffer = await response.arrayBuffer()
      
      // Determine content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      
      // Determine filename from URL or parameter
      const finalFilename = filename || 
        downloadUrl.pathname.split('/').pop() || 
        'sam-gov-attachment.pdf'

      logger.info('Successfully proxied attachment download', {
        url,
        filename: finalFilename,
        size: fileBuffer.byteLength,
        contentType,
        userId: user.id
      })

      // Return the file with appropriate headers
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${finalFilename}"`,
          'Content-Length': fileBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      })
    } catch (error) {
      logger.error('Error downloading SAM.gov attachment', {
        url,
        userId: user.id,
        error
      })

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download attachment'
      }, { status: 500 })
    }
  },
  {
    requireAuth: true,
    validateQuery: downloadQuerySchema,
    rateLimit: 'api',
    sanitization: { query: 'strict' }
  }
)
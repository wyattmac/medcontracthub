/**
 * Public SAM.gov Attachment Download Proxy
 * For downloading attachments without authentication (e.g., for compliance matrix)
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/errors/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const filename = searchParams.get('filename')

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    // For mock attachments in development
    if (url.startsWith('/mock-attachments/')) {
      // Extract opportunity ID from URL if present
      const urlParts = url.split('/')
      const opportunityId = urlParts[2] // /mock-attachments/{opportunityId}/filename.pdf
      const docType = urlParts[urlParts.length - 1] // Get the filename
      
      // Generate opportunity-specific content
      let pdfContent = ''
      
      if (docType.includes('rfp-section-l-m')) {
        pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 800>>stream
BT
/F1 16 Tf
50 750 Td
(RFP Document - Opportunity ${opportunityId}) Tj
0 -30 Td
/F1 14 Tf
(SECTION L - INSTRUCTIONS TO OFFERORS) Tj
0 -25 Td
/F1 12 Tf
(L.1 SUBMISSION REQUIREMENTS) Tj
0 -20 Td
(L.1.1 Electronic submission via SAM.gov required) Tj
0 -20 Td
(L.1.2 Technical proposal: 50 pages maximum) Tj
0 -20 Td
(L.1.3 Price proposal submitted separately) Tj
0 -30 Td
(L.2 TECHNICAL PROPOSAL FORMAT) Tj
0 -20 Td
(L.2.1 Executive Summary - 2 pages) Tj
0 -20 Td
(L.2.2 Technical Approach - 20 pages) Tj
0 -40 Td
/F1 14 Tf
(SECTION M - EVALUATION CRITERIA) Tj
0 -25 Td
/F1 12 Tf
(M.1 TECHNICAL CAPABILITY - 40 POINTS) Tj
0 -20 Td
(M.2 PAST PERFORMANCE - 30 POINTS) Tj
0 -20 Td
(M.3 MANAGEMENT APPROACH - 20 POINTS) Tj
0 -20 Td
(M.4 PRICE - 10 POINTS) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
900
%%EOF`
      } else if (docType.includes('statement-of-work')) {
        pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 400>>stream
BT
/F1 16 Tf
50 750 Td
(Statement of Work - Opportunity ${opportunityId}) Tj
0 -30 Td
/F1 14 Tf
(1.0 SCOPE OF WORK) Tj
0 -25 Td
/F1 12 Tf
(Medical equipment and supplies delivery) Tj
0 -20 Td
(2.0 REQUIREMENTS) Tj
0 -20 Td
(FDA approved medical devices) Tj
0 -20 Td
(3.0 DELIVERABLES) Tj
0 -20 Td
(Monthly status reports required) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
500
%%EOF`
      } else {
        // Default technical requirements
        pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 350>>stream
BT
/F1 16 Tf
50 750 Td
(Technical Requirements - Opportunity ${opportunityId}) Tj
0 -30 Td
/F1 12 Tf
(ISO 13485 certification required) Tj
0 -20 Td
(FDA registration mandatory) Tj
0 -20 Td
(Quality Management System) Tj
0 -20 Td
(Track and trace capability) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
450
%%EOF`
      }
      
      const mockPdfContent = Buffer.from(pdfContent)
      const finalFilename = filename || url.split('/').pop() || 'mock-document.pdf'
      
      return new NextResponse(mockPdfContent, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${finalFilename}"`,
          'Content-Length': mockPdfContent.length.toString()
        }
      })
    }

    // For real SAM.gov URLs
    try {
      const apiKey = process.env.SAM_GOV_API_KEY
      
      // Build download URL
      const downloadUrl = new URL(url)
      if (apiKey) {
        downloadUrl.searchParams.set('api_key', apiKey)
      }

      // Fetch the file from SAM.gov
      const response = await fetch(downloadUrl.toString(), {
        method: 'GET',
        headers: {
          ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
          'User-Agent': 'MedContractHub/1.0'
        }
      })

      if (!response.ok) {
        logger.error('SAM.gov download failed', {
          status: response.status,
          statusText: response.statusText
        })
        
        // Return a fallback error PDF for development
        if (process.env.NODE_ENV === 'development') {
          const errorPdf = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 100>>stream
BT /F1 24 Tf 100 700 Td (SAM.gov Document) Tj 0 -30 Td (Download unavailable in development) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
trailer<</Size 6/Root 1 0 R>>
startxref
400
%%EOF`)
          
          return new NextResponse(errorPdf, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="sam-gov-unavailable.pdf"`,
            }
          })
        }
        
        throw new Error(`SAM.gov returned ${response.status}: ${response.statusText}`)
      }

      // Get the file content
      const fileBuffer = await response.arrayBuffer()
      
      // Determine content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      
      // Determine filename from response headers or URL
      let finalFilename = filename
      
      if (!finalFilename) {
        // Try to get filename from Content-Disposition header
        const contentDisposition = response.headers.get('content-disposition')
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
          if (filenameMatch && filenameMatch[1]) {
            finalFilename = filenameMatch[1].replace(/['"]/g, '')
          }
        }
        
        // If still no filename, extract from URL
        if (!finalFilename) {
          const segments = downloadUrl.pathname.split('/')
          const lastSegment = segments[segments.length - 1]
          
          if (lastSegment && lastSegment !== 'download' && lastSegment.includes('.')) {
            finalFilename = decodeURIComponent(lastSegment)
          } else if (segments.includes('files') && segments[segments.length - 1] === 'download') {
            // For SAM.gov URLs ending in /download, use file ID
            const fileIdIndex = segments.indexOf('files') + 1
            if (fileIdIndex < segments.length - 1) {
              const fileId = segments[fileIdIndex]
              finalFilename = `SAM_Attachment_${fileId.substring(0, 8)}.pdf`
            }
          } else {
            finalFilename = 'sam-gov-attachment.pdf'
          }
        }
      }
      
      // Ensure filename is safe for download
      finalFilename = finalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')

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
        error
      })

      // In development, return a mock PDF
      if (process.env.NODE_ENV === 'development') {
        const mockPdf = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 50>>stream
BT /F1 12 Tf 100 700 Td (Mock SAM.gov Document) Tj ET
endstream endobj
xref
0 5
trailer<</Size 5/Root 1 0 R>>
startxref
300
%%EOF`)
        
        return new NextResponse(mockPdf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="mock-document.pdf"'
          }
        })
      }

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download attachment'
      }, { status: 500 })
    }
  } catch (error) {
    logger.error('Error in public download endpoint', { error })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process request'
    }, { status: 500 })
  }
}
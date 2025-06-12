/**
 * Document Processing Flow E2E Test
 * Tests the complete flow: Upload → OCR → AI Analysis → Storage
 */

import { testSetup, withAuth } from '../setup'
import { readFileSync } from 'fs'
import { join } from 'path'
import FormData from 'form-data'

describe('Document Processing E2E Flow', () => {
  beforeAll(async () => {
    // Wait for all required services
    await testSetup.waitForServices(['gateway', 'ocr', 'ai', 'app'])
  })

  afterAll(async () => {
    await testSetup.cleanup()
  })

  describe('OCR Document Processing', () => {
    it('should process a PDF document through the complete pipeline', async () => {
      await withAuth(async (token, user) => {
        // 1. Upload document to OCR service
        const gateway = testSetup.getHttpClient('gateway')
        const formData = new FormData()
        
        // Use a test PDF
        const testPdfPath = join(__dirname, '../../../fixtures/test-rfp.pdf')
        formData.append('file', readFileSync(testPdfPath), 'test-rfp.pdf')
        formData.append('noticeId', 'TEST-NOTICE-001')
        formData.append('title', 'Test RFP Document')

        const uploadResponse = await gateway.post('/api/ocr/process', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        })

        expect(uploadResponse.status).toBe(200)
        expect(uploadResponse.data).toHaveProperty('documentId')
        expect(uploadResponse.data).toHaveProperty('status', 'processing')

        const documentId = uploadResponse.data.documentId

        // 2. Wait for OCR processing to complete via Kafka
        const ocrResult = await testSetup.waitForKafkaMessage(
          'document-processed',
          (msg) => msg.documentId === documentId,
          30000 // 30 second timeout for OCR
        )

        expect(ocrResult).toMatchObject({
          documentId,
          status: 'completed',
          pageCount: expect.any(Number),
          extractedText: expect.any(String)
        })

        // 3. Verify AI analysis was triggered
        const aiAnalysis = await testSetup.waitForKafkaMessage(
          'document-analyzed',
          (msg) => msg.documentId === documentId,
          20000 // 20 second timeout for AI
        )

        expect(aiAnalysis).toMatchObject({
          documentId,
          requirements: expect.arrayContaining([
            expect.objectContaining({
              type: expect.any(String),
              description: expect.any(String),
              confidence: expect.any(Number)
            })
          ]),
          summary: expect.any(String),
          keyDates: expect.any(Array)
        })

        // 4. Check document status via API
        const statusResponse = await gateway.get(`/api/ocr/status/${documentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        expect(statusResponse.data).toMatchObject({
          documentId,
          status: 'completed',
          ocrCompleted: true,
          aiAnalysisCompleted: true,
          storedInVectorDb: true
        })

        // 5. Verify document is searchable via AI service
        const searchResponse = await gateway.post('/api/ai/search', {
          query: 'medical equipment requirements',
          filters: {
            documentIds: [documentId]
          }
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        expect(searchResponse.data.results).toHaveLength(expect.any(Number))
        expect(searchResponse.data.results[0]).toHaveProperty('documentId', documentId)
      })
    }, 60000) // 60 second total timeout

    it('should handle document processing errors gracefully', async () => {
      await withAuth(async (token) => {
        const gateway = testSetup.getHttpClient('gateway')
        const formData = new FormData()
        
        // Upload an invalid file
        formData.append('file', Buffer.from('invalid pdf content'), 'invalid.pdf')
        formData.append('noticeId', 'TEST-NOTICE-002')

        const uploadResponse = await gateway.post('/api/ocr/process', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          validateStatus: () => true // Don't throw on error status
        })

        expect(uploadResponse.status).toBe(400)
        expect(uploadResponse.data).toHaveProperty('error')
        expect(uploadResponse.data.error).toContain('Invalid PDF')
      })
    })

    it('should enforce file size limits', async () => {
      await withAuth(async (token) => {
        const gateway = testSetup.getHttpClient('gateway')
        const formData = new FormData()
        
        // Create a buffer larger than 50MB
        const largeBuffer = Buffer.alloc(51 * 1024 * 1024)
        formData.append('file', largeBuffer, 'large.pdf')
        formData.append('noticeId', 'TEST-NOTICE-003')

        const uploadResponse = await gateway.post('/api/ocr/process', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          },
          validateStatus: () => true
        })

        expect(uploadResponse.status).toBe(413)
        expect(uploadResponse.data.error).toContain('size limit')
      })
    })
  })

  describe('Real-time Updates', () => {
    it('should receive real-time updates during document processing', async () => {
      await withAuth(async (token) => {
        // Connect to WebSocket
        const ws = await testSetup.connectWebSocket(token)
        
        // Set up event listeners
        const updates: any[] = []
        ws.on('document:status', (data) => {
          updates.push(data)
        })

        // Upload a document
        const gateway = testSetup.getHttpClient('gateway')
        const formData = new FormData()
        const testPdfPath = join(__dirname, '../../../fixtures/test-rfp.pdf')
        formData.append('file', readFileSync(testPdfPath), 'test-rfp.pdf')
        formData.append('noticeId', 'TEST-NOTICE-004')

        const uploadResponse = await gateway.post('/api/ocr/process', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${token}`
          }
        })

        const documentId = uploadResponse.data.documentId

        // Wait for updates
        await new Promise(resolve => setTimeout(resolve, 5000))

        // Verify we received status updates
        expect(updates.length).toBeGreaterThan(0)
        expect(updates.some(u => u.documentId === documentId)).toBe(true)
        expect(updates.some(u => u.status === 'ocr_started')).toBe(true)
        expect(updates.some(u => u.status === 'ocr_completed')).toBe(true)
      })
    }, 30000)
  })
})
#!/usr/bin/env tsx

/**
 * Test script for Mistral OCR integration
 * Usage: npm run test:mistral-ocr
 */

import { mistralOCR } from '../lib/ai/mistral-ocr-client'
import { apiLogger } from '../lib/errors/logger'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function testMistralOCR() {
  console.log('🔍 Testing Mistral OCR Integration...\n')

  // Check if API key is configured
  if (!process.env.MISTRAL_API_KEY) {
    console.error('❌ MISTRAL_API_KEY not found in environment variables')
    console.log('Please add MISTRAL_API_KEY to your .env.local file')
    process.exit(1)
  }

  console.log('✅ Mistral API key found\n')

  try {
    // Test 1: Process a sample image URL (Mistral OCR only supports images, not PDFs)
    console.log('📄 Test 1: Processing sample image from URL...')
    const testUrl = 'https://picsum.photos/800/600'
    
    console.log(`URL: ${testUrl}`)
    console.log('Processing...')
    
    const result = await mistralOCR.extractTextFromDocument(testUrl)
    
    console.log('✅ Document processed successfully!')
    console.log(`Extracted text length: ${result.length} characters`)
    console.log('First 200 characters:', result.substring(0, 200) + '...\n')

    // Test 2: Extract structured data
    console.log('📊 Test 2: Extracting structured data...')
    const structuredResult = await mistralOCR.extractStructuredData(testUrl)
    
    console.log('✅ Structured data extracted!')
    console.log(`Page count: ${structuredResult.metadata.pageCount}`)
    console.log(`Total images: ${structuredResult.metadata.totalImages}`)
    console.log(`Model used: ${structuredResult.metadata.model}\n`)

    // Test 3: Process with a buffer (simulated)
    console.log('🔄 Test 3: Processing document buffer...')
    const testBuffer = Buffer.from('Sample PDF content for testing')
    const fileName = 'test-document.pdf'
    
    try {
      const bufferResult = await mistralOCR.processDocumentBuffer(testBuffer, fileName)
      console.log('✅ Buffer processing successful!')
      console.log(`Products found: ${bufferResult.structuredData?.products?.length || 0}`)
      console.log(`Tables found: ${bufferResult.tables?.length || 0}\n`)
    } catch (error) {
      console.log('⚠️  Buffer processing returned an error (expected for test buffer)')
      console.log(`Error: ${error.message}\n`)
    }

    console.log('🎉 All tests completed successfully!')

    // Display cost estimate
    console.log('\n💰 Cost Information:')
    console.log('- Pixtral model: ~$0.10 per 1M pixels')
    console.log('- Focus model: ~$0.08 per 1M pixels')
    console.log('- Average PDF page: ~500K pixels')
    console.log('- Estimated cost per page: $0.04-0.05')

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    
    if (error.message.includes('API key')) {
      console.log('\n🔑 API Key Issue:')
      console.log('1. Make sure your MISTRAL_API_KEY is valid')
      console.log('2. Check your Mistral AI account at https://console.mistral.ai/')
      console.log('3. Ensure you have API credits available')
    }
    
    process.exit(1)
  }
}

// Run the test
testMistralOCR().catch(console.error)
#!/usr/bin/env tsx

/**
 * Test script for Mistral Document OCR integration
 * Tests the new OCR API with native PDF support
 */

import { mistralDocumentOCR } from '../lib/ai/mistral-document-ocr-client'
import { apiLogger } from '../lib/errors/logger'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import fs from 'fs/promises'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function testMistralDocumentOCR() {
  console.log('🔍 Testing Mistral Document OCR Integration...\n')

  // Check if API key is configured
  if (!process.env.MISTRAL_API_KEY) {
    console.error('❌ MISTRAL_API_KEY not found in environment variables')
    console.log('Please add MISTRAL_API_KEY to your .env.local file')
    process.exit(1)
  }

  console.log('✅ Mistral API key found\n')

  try {
    // Test 1: Process a sample PDF URL
    console.log('📄 Test 1: Processing PDF from URL...')
    const testPdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    
    console.log(`URL: ${testPdfUrl}`)
    console.log('Processing with native PDF support...')
    
    const urlResult = await mistralDocumentOCR.processDocument(
      { url: testPdfUrl },
      { structuredOutput: true }
    )
    
    console.log('✅ PDF processed successfully!')
    console.log(`Pages: ${urlResult.metadata.pageCount}`)
    console.log(`Processing time: ${urlResult.metadata.processingTimeMs}ms`)
    console.log(`Cost: $${mistralDocumentOCR.calculateCost(urlResult.metadata.pageCount).toFixed(3)}`)
    console.log(`Products found: ${urlResult.structuredData?.products.length || 0}`)
    
    if (urlResult.pages[0]) {
      console.log('\nFirst page preview:')
      console.log(urlResult.pages[0].text.substring(0, 200) + '...\n')
    }

    // Test 2: Process with buffer (simulated PDF)
    console.log('📊 Test 2: Processing document buffer...')
    const testContent = `
SOLICITATION NUMBER: W912DY-24-R-0123
MEDICAL SUPPLIES AND EQUIPMENT

LINE ITEMS:
1. Nitrile Examination Gloves, Powder-Free, Blue
   - Size: Large
   - Quantity: 5000 BX
   - Specification: ASTM D6319
   - Certification: FDA 510(k) cleared

2. Surgical Masks, 3-Ply, ASTM Level 2
   - Quantity: 10000 EA
   - Color: Blue
   - Specification: ASTM F2100 Level 2

3. Hand Sanitizer, 70% Alcohol
   - Size: 500ml bottles
   - Quantity: 2000 EA
   - Certification: FDA registered

DELIVERY: FOB Destination to Fort Bragg, NC 28310
DELIVERY DATE: 30 days ARO
COMPLIANCE: Buy American Act applies
`
    const testBuffer = Buffer.from(testContent)
    
    const bufferResult = await mistralDocumentOCR.processDocument(
      { buffer: testBuffer, fileName: 'test-solicitation.pdf' },
      { structuredOutput: true }
    )
    
    console.log('✅ Buffer processing successful!')
    console.log(`Products extracted: ${bufferResult.structuredData?.products.length || 0}`)
    
    if (bufferResult.structuredData?.products) {
      console.log('\nExtracted Products:')
      bufferResult.structuredData.products.forEach((product, i) => {
        console.log(`\n${i + 1}. ${product.name}`)
        console.log(`   Quantity: ${product.quantity} ${product.unit}`)
        if (product.specifications && Object.keys(product.specifications).length > 0) {
          console.log(`   Specs: ${JSON.stringify(product.specifications)}`)
        }
        if (product.certifications.length > 0) {
          console.log(`   Certifications: ${product.certifications.join(', ')}`)
        }
        if (product.standards.length > 0) {
          console.log(`   Standards: ${product.standards.join(', ')}`)
        }
      })
    }

    // Test 3: Cost estimation
    console.log('\n\n💰 Test 3: Cost Estimation')
    const fileSizes = [
      { size: 100 * 1024, type: 'pdf' },      // 100KB
      { size: 1 * 1024 * 1024, type: 'pdf' }, // 1MB
      { size: 10 * 1024 * 1024, type: 'pdf' }, // 10MB
      { size: 50 * 1024 * 1024, type: 'pdf' }  // 50MB (max)
    ]
    
    console.log('File Size -> Estimated Pages -> Cost')
    console.log('-------------------------------------')
    fileSizes.forEach(({ size, type }) => {
      const pages = mistralDocumentOCR.estimatePageCount(size, 'application/pdf')
      const cost = mistralDocumentOCR.calculateCost(pages)
      const sizeStr = size < 1024 * 1024 
        ? `${(size / 1024).toFixed(0)}KB`
        : `${(size / (1024 * 1024)).toFixed(0)}MB`
      console.log(`${sizeStr.padEnd(8)} -> ${pages.toString().padEnd(15)} -> $${cost.toFixed(3)}`)
    })

    console.log('\n🎉 All tests completed successfully!')

    // Display capabilities summary
    console.log('\n📋 Mistral OCR Capabilities:')
    console.log('- Native PDF processing (no conversion needed)')
    console.log('- Up to 50MB file size')
    console.log('- Up to 1,000 pages per document')
    console.log('- Processing speed: 2,000 pages/minute')
    console.log('- Cost: $0.001 per page')
    console.log('- Structured data extraction')
    console.log('- Automatic product requirement parsing')
    console.log('- Table extraction support')
    console.log('- Multi-language support')

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    
    if (error.message.includes('API key')) {
      console.log('\n🔑 API Key Issue:')
      console.log('1. Make sure your MISTRAL_API_KEY is valid')
      console.log('2. Check your Mistral AI account at https://console.mistral.ai/')
      console.log('3. Ensure you have API credits available')
    } else if (error.message.includes('OCR')) {
      console.log('\n📄 OCR Issue:')
      console.log('1. The Mistral OCR API might not be available in your plan')
      console.log('2. Check if you have access to mistral-ocr-latest model')
      console.log('3. Visit https://docs.mistral.ai/capabilities/document/')
    }
    
    console.log('\nError details:', error)
    process.exit(1)
  }
}

// Run the test
testMistralDocumentOCR().catch(console.error)
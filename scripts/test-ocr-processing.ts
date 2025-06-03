#!/usr/bin/env tsx

/**
 * Test OCR document processing with a real opportunity
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { SAMApiClient } from '../lib/sam-gov/client'
import { SAMDocumentProcessor } from '../lib/sam-gov/document-processor'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testOCRProcessing() {
  console.log('Testing OCR document processing...\n')

  // Initialize clients
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const samClient = new SAMApiClient({
    apiKey: process.env.SAM_GOV_API_KEY!,
    baseUrl: 'https://api.sam.gov',
    timeout: 30000
  })

  try {
    // Step 1: Find a medical opportunity with documents
    console.log('1. Finding medical opportunities with documents...')
    const response = await samClient.getOpportunities({
      limit: 10,
      naicsCode: '325413' // Medical supplies
    })

    const opportunitiesWithDocs = response.opportunitiesData.filter(
      opp => opp.resourceLinks && opp.resourceLinks.length > 0
    )

    if (opportunitiesWithDocs.length === 0) {
      console.log('No opportunities found with documents')
      return
    }

    const testOpp = opportunitiesWithDocs[0]
    console.log(`\nFound opportunity: ${testOpp.title}`)
    console.log(`Notice ID: ${testOpp.noticeId}`)
    console.log(`Documents: ${testOpp.resourceLinks?.length || 0}`)

    // Step 2: Save opportunity to database if not exists
    console.log('\n2. Saving opportunity to database...')
    const { data: existingOpp } = await supabase
      .from('opportunities')
      .select('id')
      .eq('notice_id', testOpp.noticeId)
      .single()

    let opportunityId: string

    if (existingOpp) {
      opportunityId = existingOpp.id
      console.log('Opportunity already exists in database')
    } else {
      // Map and insert opportunity
      const oppData = {
        notice_id: testOpp.noticeId,
        title: testOpp.title,
        agency: testOpp.fullParentPathName,
        posted_date: testOpp.postedDate,
        response_deadline: testOpp.responseDeadLine,
        status: 'active',
        naics_code: testOpp.naicsCode,
        additional_info: {
          resourceLinks: testOpp.resourceLinks
        }
      }

      const { data: newOpp, error } = await supabase
        .from('opportunities')
        .insert(oppData)
        .select()
        .single()

      if (error) {
        console.error('Failed to save opportunity:', error)
        return
      }

      opportunityId = newOpp.id
      console.log('Opportunity saved to database')
    }

    // Step 3: Process first document with OCR
    console.log('\n3. Processing first document with OCR...')
    const processor = new SAMDocumentProcessor()
    
    // Only process first document for testing
    const firstDocLink = testOpp.resourceLinks![0]
    console.log(`Document URL: ${firstDocLink}`)

    const results = await processor.processOpportunityDocuments(
      opportunityId,
      [firstDocLink],
      process.env.SAM_GOV_API_KEY!
    )

    if (results.length > 0) {
      const result = results[0]
      console.log('\n✅ Document processed successfully!')
      console.log(`- Document ID: ${result.documentId}`)
      console.log(`- File Name: ${result.fileName}`)
      console.log(`- Processing Time: ${result.processingTime}ms`)
      console.log(`- Requirements Found: ${result.requirements.length}`)

      if (result.requirements.length > 0) {
        console.log('\nExtracted Requirements:')
        result.requirements.forEach((req, i) => {
          console.log(`\n${i + 1}. ${req.productName}`)
          console.log(`   Quantity: ${req.quantity} ${req.unit}`)
          console.log(`   Specifications: ${JSON.stringify(req.specifications)}`)
          if (req.requiredCertifications.length > 0) {
            console.log(`   Certifications: ${req.requiredCertifications.join(', ')}`)
          }
          if (req.requiredStandards.length > 0) {
            console.log(`   Standards: ${req.requiredStandards.join(', ')}`)
          }
        })
      }
    } else {
      console.log('No results returned from processing')
    }

  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
testOCRProcessing().catch(console.error)
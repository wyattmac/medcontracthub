#!/usr/bin/env tsx

/**
 * Test SAM.gov Attachments API
 * Tests the attachment loading functionality
 */

import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSAMApiClient } from '../lib/sam-gov/client'
import { samAttachmentProcessor } from '../lib/sam-gov/attachment-processor'

async function testAttachmentsAPI() {
  console.log('🔍 Testing SAM.gov Attachments API...\n')

  // Test notice IDs (replace with actual ones from your database)
  const testNoticeIds = [
    'e99ca01a37e34debb5facd02fb4677a2', // Example from your opportunities
    'test123', // Test ID
  ]

  try {
    // Test 1: Direct SAM.gov API
    console.log('1️⃣ Testing direct SAM.gov API access...')
    const samClient = getSAMApiClient()
    
    for (const noticeId of testNoticeIds) {
      console.log(`\n📄 Testing notice ID: ${noticeId}`)
      try {
        const response = await samClient.getOpportunityById(noticeId)
        const opportunity = response.opportunitiesData?.[0]
        
        if (opportunity) {
          console.log('✅ Found opportunity:', {
            title: opportunity.title,
            noticeId: opportunity.noticeId,
            hasResourceLinks: !!opportunity.resourceLinks?.length,
            resourceLinksCount: opportunity.resourceLinks?.length || 0
          })
          
          if (opportunity.resourceLinks?.length > 0) {
            console.log('📎 Resource links:')
            opportunity.resourceLinks.forEach((link: string, index: number) => {
              console.log(`   ${index + 1}. ${link}`)
            })
          }
        } else {
          console.log('❌ No opportunity found for notice ID:', noticeId)
        }
      } catch (error) {
        console.error(`❌ Error fetching opportunity ${noticeId}:`, error.message)
      }
    }

    // Test 2: Attachment Processor
    console.log('\n\n2️⃣ Testing attachment processor...')
    
    for (const noticeId of testNoticeIds) {
      console.log(`\n📄 Processing attachments for notice ID: ${noticeId}`)
      try {
        const attachments = await samAttachmentProcessor.getOpportunityAttachments(noticeId)
        
        if (attachments.length > 0) {
          console.log(`✅ Found ${attachments.length} attachments:`)
          attachments.forEach((att, index) => {
            console.log(`   ${index + 1}. ${att.filename} - ${att.url}`)
          })
        } else {
          console.log('❌ No attachments found')
        }
      } catch (error) {
        console.error(`❌ Error processing attachments for ${noticeId}:`, error.message)
      }
    }

    // Test 3: Check API Key
    console.log('\n\n3️⃣ Checking API configuration...')
    console.log('SAM_GOV_API_KEY:', process.env.SAM_GOV_API_KEY ? '✅ Set' : '❌ Missing')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    console.log('DEVELOPMENT_AUTH_BYPASS:', process.env.DEVELOPMENT_AUTH_BYPASS)

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

// Run the test
testAttachmentsAPI()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
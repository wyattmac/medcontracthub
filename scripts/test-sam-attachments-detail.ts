#!/usr/bin/env tsx

import 'dotenv/config'
import { getSAMApiClient } from '@/lib/sam-gov/client'

async function testAttachmentDetails() {
  const client = getSAMApiClient()
  
  // Test with a real notice ID
  const noticeId = 'b70a1e2daf984c41a59e3f8024f5e61f'
  
  console.log('🔍 Testing SAM.gov attachment details...\n')
  console.log('Notice ID:', noticeId)
  
  try {
    const response = await client.getOpportunityById(noticeId)
    const opportunity = response.opportunitiesData?.[0]
    
    if (!opportunity) {
      console.log('❌ Opportunity not found')
      return
    }
    
    console.log('\n📋 Opportunity Details:')
    console.log('Title:', opportunity.title)
    console.log('Type:', opportunity.type)
    console.log('Posted Date:', opportunity.postedDate)
    
    console.log('\n📎 Resource Links:')
    if (opportunity.resourceLinks && opportunity.resourceLinks.length > 0) {
      opportunity.resourceLinks.forEach((link, index) => {
        console.log(`\n[${index + 1}] ${link}`)
        
        // Try to extract filename from URL
        try {
          const url = new URL(link)
          const pathname = url.pathname
          const segments = pathname.split('/')
          
          console.log('  URL Path:', pathname)
          console.log('  Path segments:', segments)
          
          // SAM.gov attachment URLs typically have this structure:
          // /api/prod/opps/v3/opportunities/resources/files/{fileId}/download
          if (segments.includes('files') && segments.includes('download')) {
            const fileIdIndex = segments.indexOf('files') + 1
            const fileId = segments[fileIdIndex]
            console.log('  File ID:', fileId)
          }
          
          // Check if there's a filename in the URL
          const lastSegment = segments[segments.length - 1]
          if (lastSegment && lastSegment !== 'download' && lastSegment.includes('.')) {
            console.log('  Extracted filename:', lastSegment)
          } else {
            console.log('  No filename in URL - using generic name')
          }
        } catch (e) {
          console.log('  Invalid URL:', e)
        }
      })
    } else {
      console.log('No resource links found')
    }
    
    console.log('\n🔗 Links Array:')
    if (opportunity.links && opportunity.links.length > 0) {
      opportunity.links.forEach((link, index) => {
        console.log(`\n[${index + 1}] Link Object:`)
        console.log('  ', JSON.stringify(link, null, 2))
      })
    } else {
      console.log('No links array found')
    }
    
    // Check if there's additional attachment info in other fields
    console.log('\n🔎 Other Fields:')
    console.log('Additional Info Link:', opportunity.additionalInfoLink)
    console.log('UI Link:', opportunity.uiLink)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testAttachmentDetails()
#!/usr/bin/env tsx

import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSAMApiClient } from '../lib/sam-gov/client'

async function findOpportunitiesWithAttachments() {
  const samClient = getSAMApiClient()
  
  console.log('🔍 Searching for opportunities with attachments...\n')
  
  try {
    // Search for recent opportunities
    const response = await samClient.searchOpportunities({
      postedFrom: '06/01/2025',
      postedTo: '06/09/2025',
      limit: 100,
      offset: 0
    })
    
    console.log(`Found ${response.opportunitiesData?.length || 0} opportunities`)
    
    let foundWithAttachments = 0
    
    for (const opp of response.opportunitiesData || []) {
      if (opp.resourceLinks && opp.resourceLinks.length > 0) {
        foundWithAttachments++
        console.log(`\n✅ Found opportunity with attachments:`)
        console.log(`   Notice ID: ${opp.noticeId}`)
        console.log(`   Title: ${opp.title}`)
        console.log(`   Type: ${opp.type}`)
        console.log(`   Posted: ${opp.postedDate}`)
        console.log(`   Attachments: ${opp.resourceLinks.length}`)
        opp.resourceLinks.forEach((link: string, i: number) => {
          console.log(`     ${i + 1}. ${link}`)
        })
        
        if (foundWithAttachments >= 5) break // Stop after finding 5
      }
    }
    
    if (foundWithAttachments === 0) {
      console.log('\n❌ No opportunities with attachments found in this batch')
    } else {
      console.log(`\n📊 Summary: Found ${foundWithAttachments} opportunities with attachments`)
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

findOpportunitiesWithAttachments()
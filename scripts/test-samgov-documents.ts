#!/usr/bin/env tsx

/**
 * Test script to explore SAM.gov document/attachment links
 */

import dotenv from 'dotenv'
import { SAMApiClient } from '../lib/sam-gov/client'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function exploreSAMDocuments() {
  const client = new SAMApiClient({
    apiKey: process.env.SAM_GOV_API_KEY!,
    baseUrl: 'https://api.sam.gov',
    timeout: 30000
  })

  console.log('Fetching opportunities to examine document links...\n')

  try {
    // Get a few recent opportunities
    const response = await client.getOpportunities({
      limit: 5,
      naicsCode: '325413' // Medical supplies
    })

    console.log(`Found ${response.totalRecords} total opportunities`)
    console.log(`Examining first ${response.opportunitiesData.length} opportunities:\n`)

    for (const opp of response.opportunitiesData) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`Title: ${opp.title}`)
      console.log(`Notice ID: ${opp.noticeId}`)
      console.log(`Solicitation #: ${opp.solicitationNumber}`)
      console.log(`Posted Date: ${opp.postedDate}`)
      console.log(`Response Deadline: ${opp.responseDeadLine}`)
      
      // Check for document links
      console.log(`\nDocument Links:`)
      
      if (opp.links && opp.links.length > 0) {
        console.log('Links array:')
        opp.links.forEach((link, i) => {
          console.log(`  ${i + 1}. rel: ${link.rel}, href: ${link.href}`)
        })
      }
      
      if (opp.resourceLinks && opp.resourceLinks.length > 0) {
        console.log('\nResource Links:')
        opp.resourceLinks.forEach((link, i) => {
          console.log(`  ${i + 1}. ${link}`)
        })
      }
      
      if (opp.additionalInfoLink) {
        console.log(`\nAdditional Info Link: ${opp.additionalInfoLink}`)
      }
      
      console.log(`\nUI Link: ${opp.uiLink}`)
    }

    // Try to fetch the detailed view of one opportunity to see if it has more info
    if (response.opportunitiesData.length > 0) {
      const firstOpp = response.opportunitiesData[0]
      console.log(`\n\n${'='.repeat(80)}`)
      console.log('Checking if we can get more details for a specific opportunity...')
      
      // Try to access the self link if available
      const selfLink = firstOpp.links?.find(l => l.rel === 'self')
      if (selfLink) {
        console.log(`Found self link: ${selfLink.href}`)
        
        // Try to fetch it
        try {
          const detailResponse = await fetch(selfLink.href, {
            headers: {
              'Accept': 'application/json'
            }
          })
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json()
            console.log('\nDetailed opportunity data structure:')
            console.log(JSON.stringify(detailData, null, 2).substring(0, 1000) + '...')
          } else {
            console.log(`Could not fetch detailed view: ${detailResponse.status}`)
          }
        } catch (error) {
          console.log('Error fetching detailed view:', error)
        }
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the exploration
exploreSAMDocuments().catch(console.error)
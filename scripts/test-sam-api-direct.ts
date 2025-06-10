#!/usr/bin/env tsx

/**
 * Direct SAM.gov API Test
 * Tests the SAM.gov API directly without Redis
 */

import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function testSAMgovAPI() {
  console.log('🔍 Testing SAM.gov API directly...\n')
  
  const apiKey = process.env.SAM_GOV_API_KEY
  if (!apiKey) {
    console.error('❌ SAM_GOV_API_KEY not found in environment')
    return
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...')

  // Test with a real notice ID from your database
  const noticeId = 'e99ca01a37e34debb5facd02fb4677a2'
  
  try {
    console.log(`\n📄 Fetching opportunity: ${noticeId}`)
    
    const url = `https://api.sam.gov/opportunities/v2/search?noticeid=${noticeId}&api_key=${apiKey}`
    console.log('🌐 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'))
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'MedContractHub/1.0'
      }
    })

    console.log('📡 Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const text = await response.text()
      console.error('❌ Error response:', text)
      return
    }

    const data = await response.json()
    console.log('✅ Response received')
    
    if (data.opportunitiesData && data.opportunitiesData.length > 0) {
      const opp = data.opportunitiesData[0]
      console.log('\n📋 Opportunity Details:')
      console.log('  Title:', opp.title)
      console.log('  Notice ID:', opp.noticeId)
      console.log('  Resource Links:', opp.resourceLinks?.length || 0)
      
      if (opp.resourceLinks && opp.resourceLinks.length > 0) {
        console.log('\n📎 Attachments:')
        opp.resourceLinks.forEach((link: string, index: number) => {
          console.log(`  ${index + 1}. ${link}`)
        })
      } else {
        console.log('\n❌ No attachments found')
      }
    } else {
      console.log('❌ No opportunity data found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the test
testSAMgovAPI()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
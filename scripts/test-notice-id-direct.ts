#!/usr/bin/env tsx

import 'dotenv/config'

const apiKey = process.env.SAM_GOV_API_KEY!
const testNoticeId = 'fff54e0229584bb5918e40f94183ff23'

async function testDirectAPI() {
  console.log(`Testing notice ID: ${testNoticeId}\n`)
  
  // Try different parameter combinations
  const tests = [
    {
      name: 'With noticeid parameter',
      url: `https://api.sam.gov/opportunities/v2/search?noticeid=${testNoticeId}&api_key=${apiKey}`
    },
    {
      name: 'With noticeId parameter',
      url: `https://api.sam.gov/opportunities/v2/search?noticeId=${testNoticeId}&api_key=${apiKey}`
    },
    {
      name: 'With limit=1',
      url: `https://api.sam.gov/opportunities/v2/search?noticeid=${testNoticeId}&limit=1&api_key=${apiKey}`
    }
  ]
  
  for (const test of tests) {
    console.log(`\n📍 ${test.name}`)
    console.log(`URL: ${test.url.replace(apiKey, 'API_KEY_HIDDEN')}`)
    
    try {
      const response = await fetch(test.url)
      const data = await response.json()
      
      console.log(`Status: ${response.status}`)
      console.log(`Found: ${data.opportunitiesData?.length || 0} opportunities`)
      
      if (data.opportunitiesData?.[0]) {
        const opp = data.opportunitiesData[0]
        console.log(`Notice ID: ${opp.noticeId}`)
        console.log(`Title: ${opp.title}`)
        console.log(`Resource Links: ${opp.resourceLinks?.length || 0}`)
        if (opp.resourceLinks?.[0]) {
          console.log(`First link: ${opp.resourceLinks[0]}`)
        }
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
    }
  }
}

testDirectAPI().catch(console.error)
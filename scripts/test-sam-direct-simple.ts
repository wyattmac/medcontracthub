#!/usr/bin/env tsx

import 'dotenv/config'

const apiKey = process.env.SAM_GOV_API_KEY

async function findAttachments() {
  if (!apiKey) {
    console.error('No API key')
    return
  }

  console.log('Searching for opportunities with attachments...\n')
  
  const url = `https://api.sam.gov/opportunities/v2/search?api_key=${apiKey}&limit=50&postedFrom=06/01/2025&postedTo=06/09/2025`
  
  const response = await fetch(url)
  const data = await response.json()
  
  let found = 0
  
  for (const opp of data.opportunitiesData || []) {
    if (opp.resourceLinks && opp.resourceLinks.length > 0) {
      found++
      console.log(`Notice ID: ${opp.noticeId}`)
      console.log(`Title: ${opp.title}`)
      console.log(`Attachments: ${opp.resourceLinks.length}`)
      console.log(`First link: ${opp.resourceLinks[0]}`)
      console.log('---')
      
      if (found >= 3) break
    }
  }
  
  if (found === 0) {
    console.log('No opportunities with attachments found')
  }
}

findAttachments().catch(console.error)
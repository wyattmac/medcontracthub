#!/usr/bin/env tsx

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

async function testBraveAPI() {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  console.log('API Key found:', apiKey ? 'Yes' : 'No')
  console.log('API Key length:', apiKey?.length)

  if (!apiKey) {
    console.error('No API key found!')
    return
  }

  try {
    console.log('\nTesting Brave Search API directly...')
    
    const response = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    })

    console.log('Response status:', response.status)
    console.log('Response status text:', response.statusText)
    
    if (response.headers.get('Retry-After')) {
      console.log('Retry-After header:', response.headers.get('Retry-After'))
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error response:', errorText)
    } else {
      const data = await response.json()
      console.log('Success! Got results:', data.web?.results?.length || 0)
      if (data.web?.results?.[0]) {
        console.log('First result:', data.web.results[0].title)
      }
    }
  } catch (error) {
    console.error('Failed to call API:', error)
  }
}

testBraveAPI().catch(console.error)
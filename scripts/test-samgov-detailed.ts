#!/usr/bin/env tsx

/**
 * Detailed SAM.gov API test to diagnose issues
 */

import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testSAMGovAPI() {
  console.log('Testing SAM.gov API with different parameters...\n')
  
  const apiKey = process.env.SAM_GOV_API_KEY
  if (!apiKey) {
    console.error('SAM_GOV_API_KEY not found in environment')
    return
  }

  console.log('API Key:', apiKey.substring(0, 10) + '...')

  // Test 1: Basic API test with minimal parameters
  console.log('\nTest 1: Basic API call')
  try {
    const baseUrl = 'https://api.sam.gov/opportunities/v2/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: '1'
    })

    const response = await fetch(`${baseUrl}?${params}`)
    console.log('Status:', response.status, response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    console.log('Response:', text.substring(0, 500))
    
    if (!response.ok) {
      try {
        const error = JSON.parse(text)
        console.log('Error details:', error)
      } catch {
        console.log('Could not parse error response')
      }
    }
  } catch (error) {
    console.error('Request failed:', error)
  }

  // Test 2: Try with different date format
  console.log('\n\nTest 2: With date parameters')
  try {
    const baseUrl = 'https://api.sam.gov/opportunities/v2/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: '1',
      postedFrom: '01/01/2025',
      postedTo: '02/03/2025'
    })

    const response = await fetch(`${baseUrl}?${params}`)
    console.log('Status:', response.status, response.statusText)
    
    if (response.ok) {
      const data = await response.json()
      console.log('Success! Total records:', data.totalRecords)
    } else {
      const text = await response.text()
      console.log('Error:', text.substring(0, 200))
    }
  } catch (error) {
    console.error('Request failed:', error)
  }

  // Test 3: Try v1 API
  console.log('\n\nTest 3: Testing v1 API')
  try {
    const baseUrl = 'https://api.sam.gov/prod/opportunities/v1/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: '1'
    })

    const response = await fetch(`${baseUrl}?${params}`)
    console.log('Status:', response.status, response.statusText)
    
    if (response.ok) {
      const data = await response.json()
      console.log('Success! V1 API works')
      console.log('Total records:', data.totalRecords)
    }
  } catch (error) {
    console.error('Request failed:', error)
  }

  // Test 4: Check API key validity
  console.log('\n\nTest 4: API Key validation')
  try {
    // Try a simple endpoint that might just validate the key
    const response = await fetch(`https://api.sam.gov/entity-information/v2/entities?api_key=${apiKey}&ueiDUNS=123456789`)
    console.log('Entity API Status:', response.status)
    if (response.status === 401) {
      console.log('API key might be invalid or expired')
    } else if (response.status === 403) {
      console.log('API key might not have access to this endpoint')
    }
  } catch (error) {
    console.error('Request failed:', error)
  }
}

// Run the test
testSAMGovAPI().catch(console.error)
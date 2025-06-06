#!/usr/bin/env tsx

import { braveSearchClient } from '../lib/search/brave-client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function testBraveSearch() {
  console.log('Testing Brave Search API Integration...\n')
  console.log('Note: Adding delays between requests to avoid rate limits\n')

  try {
    // Test 1: Basic web search
    console.log('Test 1: Basic web search for "medical equipment suppliers"')
    const basicSearch = await braveSearchClient.webSearch({
      q: 'medical equipment suppliers',
      count: 5,
      country: 'US'
    })

    console.log(`Found ${basicSearch.web?.results?.length || 0} results`)
    basicSearch.web?.results?.slice(0, 3).forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`)
      console.log(`   URL: ${result.url}`)
      console.log(`   Description: ${result.description?.substring(0, 100)}...`)
    })

    // Add delay to avoid rate limit
    await delay(1000)

    // Test 2: Medical supplier specific search
    console.log('\n\nTest 2: Medical supplier specific search')
    const supplierResults = await braveSearchClient.searchMedicalSuppliers(
      'surgical gloves',
      { count: 10 }
    )

    console.log(`Found ${supplierResults.length} relevant medical supplier results`)
    supplierResults.slice(0, 3).forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`)
      console.log(`   URL: ${result.url}`)
      console.log(`   Type: ${result.type}`)
    })

    // Add delay to avoid rate limit
    await delay(1000)

    // Test 3: Search with freshness filter
    console.log('\n\nTest 3: Recent results (past week)')
    const recentSearch = await braveSearchClient.webSearch({
      q: 'medical device FDA approval',
      count: 5,
      freshness: 'pw', // past week
      country: 'US'
    })

    console.log(`Found ${recentSearch.web?.results?.length || 0} recent results`)
    recentSearch.web?.results?.slice(0, 2).forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`)
      console.log(`   Age: ${result.age || 'Unknown'}`)
      console.log(`   URL: ${result.url}`)
    })

    // Test 4: Error handling - empty query
    console.log('\n\nTest 4: Error handling - empty query')
    try {
      await braveSearchClient.webSearch({ q: '' })
    } catch (error) {
      console.log(`✓ Correctly caught error: ${(error as Error).message}`)
    }

    console.log('\n✅ All tests completed successfully!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      if (error.stack) {
        console.error('Stack trace:', error.stack)
      }
    }
    process.exit(1)
  }
}

// Run the test
testBraveSearch().catch(console.error)
#!/usr/bin/env tsx

/**
 * Test script to debug saved opportunities in localStorage
 * Run with: npm run scripts:test-saved-opportunities
 */

import { JSDOM } from 'jsdom'

// Mock browser environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  storageQuota: 10000000
})

// @ts-ignore
global.window = dom.window
// @ts-ignore
global.document = window.document
// @ts-ignore
global.localStorage = window.localStorage

// Import the store after setting up the mock
import { mockSavedOpportunitiesStore } from '../lib/mock/saved-opportunities-store'

const STORAGE_KEY = 'mock_saved_opportunities'

console.log('🔍 Testing Saved Opportunities in localStorage\n')

// Test data
const testUserId = 'user_123'
const testOpportunityId = 'opp_456'
const testOpportunityData = {
  id: testOpportunityId,
  title: 'Test Opportunity',
  description: 'Test description',
  agency: 'Test Agency',
  status: 'active',
  response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  matchScore: 0.75
}

// Test 1: Check current localStorage state
console.log('1️⃣ Current localStorage state:')
const currentData = localStorage.getItem(STORAGE_KEY)
if (currentData) {
  const parsed = JSON.parse(currentData)
  console.log(`   Found ${parsed.length} saved opportunities`)
  console.log('   Sample:', JSON.stringify(parsed[0], null, 2))
} else {
  console.log('   No saved opportunities found')
}

// Test 2: Save a test opportunity
console.log('\n2️⃣ Testing save functionality:')
mockSavedOpportunitiesStore.save(testUserId, testOpportunityId, testOpportunityData)
console.log('   ✅ Saved test opportunity')

// Test 3: Retrieve saved opportunities
console.log('\n3️⃣ Testing retrieval:')
const savedOpps = mockSavedOpportunitiesStore.getAll(testUserId)
console.log(`   Retrieved ${savedOpps.length} opportunities for user ${testUserId}`)
if (savedOpps.length > 0) {
  console.log('   First opportunity:', JSON.stringify(savedOpps[0], null, 2))
}

// Test 4: Check saved status
console.log('\n4️⃣ Testing isSaved check:')
const isSaved = mockSavedOpportunitiesStore.isSaved(testUserId, testOpportunityId)
console.log(`   Is opportunity saved? ${isSaved}`)

// Test 5: Check data structure
console.log('\n5️⃣ Checking data structure:')
if (savedOpps.length > 0) {
  const firstOpp = savedOpps[0]
  console.log('   Fields present:')
  console.log(`   - id: ${!!firstOpp.id}`)
  console.log(`   - user_id: ${!!firstOpp.user_id}`)
  console.log(`   - opportunity_id: ${!!firstOpp.opportunity_id}`)
  console.log(`   - opportunity: ${!!firstOpp.opportunity}`)
  console.log(`   - is_pursuing: ${!!firstOpp.is_pursuing}`)
  console.log(`   - notes: ${!!firstOpp.notes}`)
  console.log(`   - tags: ${!!firstOpp.tags}`)
  console.log(`   - reminder_date: ${!!firstOpp.reminder_date}`)
  console.log(`   - created_at: ${!!firstOpp.created_at}`)
}

// Test 6: Test the transformation in the container
console.log('\n6️⃣ Testing container transformation:')
const transformed = savedOpps.map(item => ({
  ...item,
  opportunities: item.opportunity // This is the problematic line!
}))
console.log('   Transformed data:', JSON.stringify(transformed[0], null, 2))

// Test 7: Cleanup
console.log('\n7️⃣ Testing cleanup:')
mockSavedOpportunitiesStore.unsave(testUserId, testOpportunityId)
const afterCleanup = mockSavedOpportunitiesStore.getAll(testUserId)
console.log(`   After cleanup: ${afterCleanup.length} opportunities remain`)

console.log('\n✅ Test completed!')
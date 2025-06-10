#!/usr/bin/env tsx
/**
 * Test script to diagnose why opportunities aren't loading
 */

async function testOpportunitiesAPI() {
  console.log('🔍 Testing Opportunities API\n');

  try {
    // Test 1: Direct API call to public-search endpoint
    console.log('1️⃣ Testing public-search API endpoint...');
    const response = await fetch('http://localhost:3000/api/opportunities/public-search?limit=10');
    const data = await response.json();
    
    console.log(`Status: ${response.status} ${response.ok ? '✅' : '❌'}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    if (data.opportunities) {
      console.log(`\n✅ Found ${data.opportunities.length} opportunities`);
      console.log(`Total in database: ${data.totalCount}`);
      
      if (data.opportunities.length > 0) {
        console.log('\nFirst opportunity:');
        const first = data.opportunities[0];
        console.log(`  Title: ${first.title}`);
        console.log(`  ID: ${first.id}`);
        console.log(`  Status: ${first.status}`);
        console.log(`  Attachments: ${first.attachments ? first.attachments.length : 0}`);
      }
    } else if (data.error) {
      console.log(`\n❌ API Error: ${data.error}`);
    }
    
    // Test 2: Check Supabase connection
    console.log('\n2️⃣ Testing Supabase connection...');
    const testResponse = await fetch('http://localhost:3000/api/test-opportunities');
    const testData = await testResponse.json();
    
    console.log(`Status: ${testResponse.status} ${testResponse.ok ? '✅' : '❌'}`);
    console.log('Database URL:', testData.database_url ? '✅ Configured' : '❌ Missing');
    console.log('Opportunities:', testData.opportunities);
    
    // Test 3: Check environment
    console.log('\n3️⃣ Checking environment...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOpportunitiesAPI().catch(console.error);
/**
 * Direct test of attachment API endpoint
 */

async function testAttachmentDirect() {
  console.log('🔍 Testing attachment API directly...\n')
  
  // First, let's check if the API route is properly set up
  console.log('1️⃣ Testing API endpoint availability...')
  
  try {
    // Test with a simple notice ID
    const testNoticeId = 'test-notice-123'
    const url = `http://localhost:3000/api/sam-gov/attachments-no-auth?noticeId=${testNoticeId}`
    
    console.log(`   URL: ${url}`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`   Status: ${response.status}`)
    console.log(`   Status Text: ${response.statusText}`)
    console.log(`   Content-Type: ${response.headers.get('content-type')}`)
    
    const text = await response.text()
    console.log(`   Response Length: ${text.length} characters`)
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text)
      console.log(`   Response:`, JSON.stringify(data, null, 2))
      
      if (data.success === false && data.error) {
        console.log(`\n⚠️ API returned error: ${data.error}`)
      } else if (data.success === true) {
        console.log(`\n✅ API is working! Attachments: ${data.data?.attachments?.length || 0}`)
      }
    } catch (e) {
      console.log(`\n❌ Response is not JSON. First 500 chars:`)
      console.log(text.substring(0, 500))
      
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        console.log('\n❌ ERROR: API is returning HTML instead of JSON!')
        console.log('This suggests the API route is not properly configured.')
      }
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error)
  }
  
  console.log('\n✅ Test complete!')
}

// Run the test
testAttachmentDirect()
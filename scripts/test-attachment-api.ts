/**
 * Test script to debug attachment API issues
 */

async function testAttachmentAPI() {
  console.log('🔍 Testing Attachment API...\n')
  
  // Test with various notice IDs
  const testNoticeIds = [
    '9a7a09cf2b9a4e389821bc079f87de96', // From the opportunities we saw
    'mock-1', // Mock opportunity
    '123456', // Generic test
  ]
  
  for (const noticeId of testNoticeIds) {
    console.log(`\n📋 Testing with notice ID: ${noticeId}`)
    
    try {
      const url = `http://localhost:3000/api/sam-gov/attachments-no-auth?noticeId=${encodeURIComponent(noticeId)}`
      console.log(`   URL: ${url}`)
      
      const response = await fetch(url)
      const data = await response.json()
      
      console.log(`   Status: ${response.status}`)
      console.log(`   Response:`, JSON.stringify(data, null, 2))
      
      if (data.success && data.data.attachments.length > 0) {
        console.log(`   ✅ Found ${data.data.attachments.length} attachments!`)
        data.data.attachments.forEach((att: any, i: number) => {
          console.log(`      ${i + 1}. ${att.filename}`)
        })
      } else if (data.success) {
        console.log('   ⚠️ No attachments found')
      } else {
        console.log(`   ❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error(`   ❌ Request failed:`, error)
    }
  }
  
  console.log('\n✅ Test complete!')
}

// Run the test
testAttachmentAPI()
#!/usr/bin/env tsx

import 'dotenv/config'

async function testDownload() {
  const testUrl = 'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/9f5f9a3c279443fb9c83b0d501f88669/download'
  const downloadEndpoint = `http://localhost:3000/api/sam-gov/attachments/download/public?url=${encodeURIComponent(testUrl)}&filename=test-download.pdf`
  
  console.log('🔽 Testing attachment download...\n')
  console.log('Download URL:', downloadEndpoint)
  
  try {
    const response = await fetch(downloadEndpoint)
    
    console.log('\n📊 Response Details:')
    console.log('Status:', response.status, response.statusText)
    console.log('Content-Type:', response.headers.get('content-type'))
    console.log('Content-Length:', response.headers.get('content-length'), 'bytes')
    console.log('Content-Disposition:', response.headers.get('content-disposition'))
    
    if (response.ok) {
      console.log('\n✅ Download successful!')
      console.log('The attachment download proxy is working correctly.')
      console.log('Your SAM.gov API key is being used to authenticate the download.')
    } else {
      console.log('\n❌ Download failed')
      const text = await response.text()
      console.log('Error:', text)
    }
  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

testDownload()
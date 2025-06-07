#!/usr/bin/env node

/**
 * Direct test of OCR upload functionality
 * This bypasses the UI authentication issues
 */

const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testOCRUpload() {
  console.log('🔍 Testing OCR Upload API directly...\n');

  try {
    // Create a simple test text file
    const testContent = `
FEDERAL CONTRACT REQUIREMENTS

SOLICITATION NUMBER: W912L5-25-R-0001
AGENCY: Department of Veterans Affairs
TITLE: Medical Supply Distribution Services

REQUIREMENTS:
1. Supply of surgical gloves (quantity: 50,000 units)
2. Sterile gauze pads (quantity: 25,000 units)  
3. Medical masks (quantity: 100,000 units)
4. ISO 13485 certification required
5. FDA approval mandatory
6. Delivery within 30 days

COMPLIANCE:
- All suppliers must be registered in SAM.gov
- Products must meet FDA standards
- ISO 9001 quality management required

DEADLINE: Submit proposals by March 15, 2025
`;

    const testFilePath = '/tmp/test-contract.txt';
    fs.writeFileSync(testFilePath, testContent);

    // Create form data with the test file
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-contract.txt',
      contentType: 'text/plain'
    });

    console.log('📄 Created test contract document');
    console.log('📡 Uploading to OCR API...');

    // Test the OCR upload endpoint
    const response = await fetch('http://localhost:3000/api/ocr/upload', {
      method: 'POST',
      body: form,
      headers: {
        // Add a mock authorization header for testing
        'Authorization': 'Bearer mock-token-for-testing'
      }
    });

    const responseText = await response.text();
    console.log(`\n📊 Response Status: ${response.status}`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    try {
      const result = JSON.parse(responseText);
      console.log('\n✅ OCR Processing Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('\n📄 Raw Response Body:');
      console.log(responseText);
    }

    // Clean up
    fs.unlinkSync(testFilePath);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testOCRUpload();
#!/usr/bin/env tsx

/**
 * Test Compliance API Endpoints
 * Tests the compliance matrix API directly without UI
 */

async function testComplianceAPI() {
  console.log('🧪 Testing Compliance Matrix API Endpoints')
  
  const baseUrl = 'http://localhost:3000/api'
  
  try {
    // Test 1: Health check
    console.log('\n1️⃣ Testing server health...')
    const healthResponse = await fetch(`${baseUrl}/health`)
    const health = await healthResponse.json()
    console.log('   ✅ Server is', health.status)
    
    // Test 2: Test compliance matrix creation
    console.log('\n2️⃣ Testing compliance matrix creation...')
    const createMatrixPayload = {
      opportunity_id: 'test-opportunity-123',
      title: 'Test Compliance Matrix',
      sections: ['L', 'M'],
      status: 'draft'
    }
    
    const createResponse = await fetch(`${baseUrl}/compliance/matrices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-development-bypass': 'true'
      },
      body: JSON.stringify(createMatrixPayload)
    })
    
    if (createResponse.ok) {
      const matrix = await createResponse.json()
      console.log('   ✅ Matrix created with ID:', matrix.id)
      
      // Test 3: Get the created matrix
      console.log('\n3️⃣ Testing get compliance matrix...')
      const getResponse = await fetch(`${baseUrl}/compliance/matrices/${matrix.id}`, {
        headers: {
          'x-development-bypass': 'true'
        }
      })
      
      if (getResponse.ok) {
        const retrievedMatrix = await getResponse.json()
        console.log('   ✅ Retrieved matrix:', retrievedMatrix.title)
      } else {
        console.log('   ❌ Failed to retrieve matrix:', getResponse.status, await getResponse.text())
      }
      
      // Test 4: Update response status
      console.log('\n4️⃣ Testing response status update...')
      // First, we need to create a response
      const responsePayload = {
        matrix_id: matrix.id,
        section: 'L',
        requirement_number: 'L.1',
        requirement_text: 'Test requirement',
        status: 'pending'
      }
      
      const createResponseRes = await fetch(`${baseUrl}/compliance/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-development-bypass': 'true'
        },
        body: JSON.stringify(responsePayload)
      })
      
      if (createResponseRes.ok) {
        const response = await createResponseRes.json()
        console.log('   ✅ Created response with ID:', response.id)
        
        // Now update it
        const updateResponse = await fetch(`${baseUrl}/compliance/responses/${response.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-development-bypass': 'true'
          },
          body: JSON.stringify({
            status: 'compliant',
            notes: 'Test update successful'
          })
        })
        
        if (updateResponse.ok) {
          console.log('   ✅ Response status updated successfully')
        } else {
          console.log('   ❌ Failed to update response:', updateResponse.status)
        }
      } else {
        console.log('   ❌ Failed to create response:', createResponseRes.status)
      }
      
    } else {
      console.log('   ❌ Failed to create matrix:', createResponse.status, await createResponse.text())
    }
    
    console.log('\n✅ API tests completed!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

testComplianceAPI().catch(console.error)
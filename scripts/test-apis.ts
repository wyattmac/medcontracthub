#!/usr/bin/env tsx

/**
 * Script to test API connections for Claude AI and SAM.gov
 */

import dotenv from 'dotenv'
import { Anthropic } from '@anthropic-ai/sdk'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

console.log(`${colors.blue}Testing API Connections...${colors.reset}\n`)

// Test Claude API
async function testClaudeAPI() {
  console.log(`${colors.yellow}Testing Claude API...${colors.reset}`)
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`${colors.red}❌ ANTHROPIC_API_KEY not found in environment${colors.reset}`)
    return false
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Say "API test successful" if you can read this.'
      }]
    })

    if (response.content[0].type === 'text' && response.content[0].text.includes('API test successful')) {
      console.log(`${colors.green}✅ Claude API is working!${colors.reset}`)
      console.log(`   Model: ${response.model}`)
      console.log(`   Response: ${response.content[0].text}`)
      return true
    }
  } catch (error: any) {
    console.log(`${colors.red}❌ Claude API Error: ${error.message}${colors.reset}`)
    if (error.status === 401) {
      console.log(`   Invalid API key`)
    } else if (error.status === 429) {
      console.log(`   Rate limit exceeded`)
    }
    return false
  }
}

// Test SAM.gov API
async function testSAMGovAPI() {
  console.log(`\n${colors.yellow}Testing SAM.gov API...${colors.reset}`)
  
  if (!process.env.SAM_GOV_API_KEY) {
    console.log(`${colors.red}❌ SAM_GOV_API_KEY not found in environment${colors.reset}`)
    return false
  }

  try {
    const baseUrl = 'https://api.sam.gov/opportunities/v2/search'
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const params = new URLSearchParams({
      api_key: process.env.SAM_GOV_API_KEY,
      limit: '1',
      postedFrom: `${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}/${sevenDaysAgo.getDate().toString().padStart(2, '0')}/${sevenDaysAgo.getFullYear()}`,
      postedTo: `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`,
      ncode: '325413' // Medical equipment NAICS code
    })

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`${colors.green}✅ SAM.gov API is working!${colors.reset}`)
      console.log(`   Total Opportunities: ${data.totalRecords || 0}`)
      if (data.opportunitiesData && data.opportunitiesData.length > 0) {
        console.log(`   Sample Opportunity: ${data.opportunitiesData[0].title}`)
      }
      return true
    } else {
      console.log(`${colors.red}❌ SAM.gov API Error: ${response.status} ${response.statusText}${colors.reset}`)
      if (response.status === 401) {
        console.log(`   Invalid API key`)
      } else if (response.status === 429) {
        console.log(`   Rate limit exceeded`)
      }
      
      // Try to get error details
      try {
        const errorData = await response.json()
        if (errorData.error) {
          console.log(`   Error: ${errorData.error}`)
        }
      } catch {}
      
      return false
    }
  } catch (error: any) {
    console.log(`${colors.red}❌ SAM.gov API Error: ${error.message}${colors.reset}`)
    return false
  }
}

// Test Mistral API (for completeness)
async function testMistralAPI() {
  console.log(`\n${colors.yellow}Testing Mistral API...${colors.reset}`)
  
  if (!process.env.MISTRAL_API_KEY) {
    console.log(`${colors.red}❌ MISTRAL_API_KEY not found in environment${colors.reset}`)
    return false
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`${colors.green}✅ Mistral API is working!${colors.reset}`)
      console.log(`   Available models: ${data.data.length}`)
      // List vision-capable models
      const visionModels = data.data.filter((m: any) => m.id.includes('pixtral'))
      if (visionModels.length > 0) {
        console.log(`   Vision models: ${visionModels.map((m: any) => m.id).join(', ')}`)
      }
      return true
    } else {
      console.log(`${colors.red}❌ Mistral API Error: ${response.status} ${response.statusText}${colors.reset}`)
      return false
    }
  } catch (error: any) {
    console.log(`${colors.red}❌ Mistral API Error: ${error.message}${colors.reset}`)
    return false
  }
}

// Run all tests
async function runTests() {
  const results = {
    claude: await testClaudeAPI(),
    samgov: await testSAMGovAPI(),
    mistral: await testMistralAPI()
  }

  console.log(`\n${colors.blue}Summary:${colors.reset}`)
  console.log(`Claude API:  ${results.claude ? colors.green + '✅ Working' : colors.red + '❌ Failed'}${colors.reset}`)
  console.log(`SAM.gov API: ${results.samgov ? colors.green + '✅ Working' : colors.red + '❌ Failed'}${colors.reset}`)
  console.log(`Mistral API: ${results.mistral ? colors.green + '✅ Working' : colors.red + '❌ Failed'}${colors.reset}`)

  const allWorking = Object.values(results).every(r => r)
  console.log(`\n${allWorking ? colors.green + '🎉 All APIs are operational!' : colors.yellow + '⚠️  Some APIs need attention'}${colors.reset}`)
}

// Run the tests
runTests().catch(console.error)
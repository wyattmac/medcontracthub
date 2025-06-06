#!/usr/bin/env tsx
/**
 * Test User Journey Monitoring System
 * Quick validation that monitoring works correctly
 */

import { createUserJourneyMonitor, CRITICAL_JOURNEYS } from '../lib/monitoring/user-journey-monitor'

async function testMonitoring() {
  console.log('🧪 Testing User Journey Monitoring System...\n')

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000'
  console.log(`📍 Testing against: ${baseUrl}\n`)

  const monitor = createUserJourneyMonitor()

  // Test each journey
  for (const journey of CRITICAL_JOURNEYS) {
    console.log(`🔍 Testing journey: ${journey.name}`)
    console.log(`   📝 ${journey.description}`)
    
    try {
      const result = await monitor.executeJourney(journey)
      
      if (result.success) {
        console.log(`   ✅ PASSED (${result.totalTime}ms)`)
        
        // Show performance details
        for (const step of result.stepResults) {
          const icon = step.performanceScore === 'good' ? '🟢' : 
                      step.performanceScore === 'needs-improvement' ? '🟡' : '🔴'
          console.log(`     ${icon} ${step.stepName}: ${step.responseTime}ms`)
        }
      } else {
        console.log(`   ❌ FAILED: ${result.error}`)
        
        // Show failure details
        for (const step of result.stepResults) {
          if (!step.success) {
            console.log(`     💥 ${step.stepName}: ${step.error}`)
          }
        }
      }
    } catch (error) {
      console.log(`   💥 ERROR: ${error}`)
    }
    
    console.log('') // Empty line for readability
  }

  console.log('🎯 Monitoring test complete!')
}

// Run the test
testMonitoring().catch(console.error)
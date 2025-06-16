#!/usr/bin/env node

/**
 * Quick health check script to test basic functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const TESTS = [];

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

async function runTest(name, testFn) {
  try {
    const startTime = Date.now();
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    TESTS.push({
      name,
      passed: result.passed,
      duration,
      message: result.message || ''
    });
    
    if (result.passed) {
      console.log(`${colors.green}✅ ${name}${colors.reset} (${duration}ms)`);
      if (result.message) console.log(`   ${result.message}`);
    } else {
      console.log(`${colors.red}❌ ${name}${colors.reset} (${duration}ms)`);
      if (result.message) console.log(`   ${colors.red}${result.message}${colors.reset}`);
    }
  } catch (error) {
    TESTS.push({
      name,
      passed: false,
      duration: 0,
      message: error.message
    });
    console.log(`${colors.red}❌ ${name} - ${error.message}${colors.reset}`);
  }
}

async function main() {
  console.log('🧪 MedContractHub Quick Health Check');
  console.log('=====================================\n');

  // Test 1: API Health
  await runTest('API Health Check', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    return {
      passed: response.ok && data.status === 'healthy',
      message: `Status: ${data.status}`
    };
  });

  // Test 2: Homepage
  await runTest('Homepage Load', async () => {
    const response = await fetch(BASE_URL);
    return {
      passed: response.ok,
      message: `Status: ${response.status}`
    };
  });

  // Test 3: Opportunities Page
  await runTest('Opportunities Page', async () => {
    const response = await fetch(`${BASE_URL}/opportunities`);
    return {
      passed: response.ok,
      message: `Status: ${response.status}`
    };
  });

  // Test 4: Search API Performance
  await runTest('Search API Performance', async () => {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/opportunities/search-fast?limit=10`);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      return {
        passed: responseTime < 1000,
        message: `Response time: ${responseTime}ms (Target: <1000ms)`
      };
    }
    
    // Try fallback endpoints
    const fallbackResponse = await fetch(`${BASE_URL}/api/opportunities/search?limit=10`);
    const fallbackTime = Date.now() - startTime;
    
    return {
      passed: fallbackResponse.ok && fallbackTime < 3000,
      message: `Fallback endpoint used. Time: ${fallbackTime}ms`
    };
  });

  // Test 5: Saved Opportunities API
  await runTest('Saved Opportunities API', async () => {
    const response = await fetch(`${BASE_URL}/api/opportunities/saved`);
    return {
      passed: response.ok || response.status === 401, // 401 is OK if auth required
      message: `Status: ${response.status}${response.status === 401 ? ' (Auth required)' : ''}`
    };
  });

  // Summary
  console.log('\n=====================================');
  console.log('📊 Test Summary:\n');
  
  const passed = TESTS.filter(t => t.passed).length;
  const failed = TESTS.length - passed;
  const avgDuration = TESTS.reduce((sum, t) => sum + t.duration, 0) / TESTS.length;
  
  console.log(`Total Tests: ${TESTS.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  }
  console.log(`Average Duration: ${Math.round(avgDuration)}ms`);
  
  console.log('\n=====================================');
  
  if (failed > 0) {
    console.log(`\n${colors.yellow}⚠️  Some tests failed. To run full Playwright tests:${colors.reset}`);
    console.log('./scripts/run-comprehensive-tests.sh');
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✅ All tests passed!${colors.reset}`);
    console.log('\nFor comprehensive testing, run:');
    console.log('./scripts/run-comprehensive-tests.sh');
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('This script requires Node.js 18+ or install node-fetch');
  console.error('Run: npm install node-fetch');
  process.exit(1);
}

main().catch(console.error);
#!/usr/bin/env tsx
/**
 * Test to check why opportunities aren't displaying
 */

import puppeteer from 'puppeteer';

async function testOpportunitiesDisplay() {
  console.log('🔍 Testing Opportunities Display\n');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();
  
  // Enable console and network logging
  page.on('console', msg => console.log('📋 Browser:', msg.text()));
  page.on('response', response => {
    if (response.url().includes('/api/opportunities')) {
      console.log(`📡 API Response: ${response.url()} - ${response.status()}`);
    }
  });

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.href.includes('/dashboard'), { timeout: 10000 });
    console.log('✅ Logged in');
    
    // Step 2: Go to opportunities page
    console.log('\n2️⃣ Navigating to opportunities page...');
    await page.goto('http://localhost:3000/opportunities');
    
    // Wait a bit for React to render
    await new Promise(r => setTimeout(r, 3000));
    
    // Step 3: Check what's on the page
    console.log('\n3️⃣ Checking page content...');
    
    const pageInfo = await page.evaluate(() => {
      // Check for loading states
      const loadingElements = document.querySelectorAll('.animate-pulse, [data-testid="loading"]');
      
      // Check for opportunity cards
      const opportunityCards = document.querySelectorAll('[data-testid="opportunity-card"], .opportunity-card');
      
      // Check for links starting with /opportunities/
      const opportunityLinks = document.querySelectorAll('a[href^="/opportunities/"]:not([href="/opportunities"])');
      
      // Check for error messages
      const errorElements = document.querySelectorAll('[data-testid="error"], .error, [role="alert"]');
      
      // Check for any divs that might contain opportunities
      const possibleOpportunityContainers = Array.from(document.querySelectorAll('div')).filter(div => {
        const text = div.textContent || '';
        return text.includes('opportunity') || text.includes('contract') || text.includes('solicitation');
      });
      
      // Get page text
      const pageText = document.body.innerText;
      
      return {
        loadingCount: loadingElements.length,
        opportunityCardCount: opportunityCards.length,
        opportunityLinkCount: opportunityLinks.length,
        errorCount: errorElements.length,
        possibleContainers: possibleOpportunityContainers.length,
        hasNoOpportunitiesMessage: pageText.includes('No opportunities') || pageText.includes('no results'),
        pageTitle: document.title,
        mainHeading: document.querySelector('h1')?.textContent,
        // Get first few lines of text
        pagePreview: pageText.substring(0, 500)
      };
    });
    
    console.log('📊 Page Analysis:');
    console.log(`   Loading elements: ${pageInfo.loadingCount}`);
    console.log(`   Opportunity cards: ${pageInfo.opportunityCardCount}`);
    console.log(`   Opportunity links: ${pageInfo.opportunityLinkCount}`);
    console.log(`   Error elements: ${pageInfo.errorCount}`);
    console.log(`   Has "no opportunities" message: ${pageInfo.hasNoOpportunitiesMessage}`);
    console.log(`   Page title: ${pageInfo.pageTitle}`);
    console.log(`   Main heading: ${pageInfo.mainHeading}`);
    
    // Step 4: Check network requests
    console.log('\n4️⃣ Checking API calls...');
    
    // Intercept API calls
    const apiCalls: any[] = [];
    page.on('response', async response => {
      if (response.url().includes('/api/opportunities')) {
        const responseData = {
          url: response.url(),
          status: response.status(),
          ok: response.ok(),
          headers: response.headers()
        };
        
        try {
          const json = await response.json();
          responseData['data'] = json;
        } catch (e) {
          // Not JSON
        }
        
        apiCalls.push(responseData);
      }
    });
    
    // Refresh the page to capture API calls
    console.log('5️⃣ Refreshing page to capture API calls...');
    await page.reload();
    await new Promise(r => setTimeout(r, 5000));
    
    console.log(`\n📡 API Calls Made: ${apiCalls.length}`);
    apiCalls.forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`);
      console.log(`   URL: ${call.url}`);
      console.log(`   Status: ${call.status}`);
      if (call.data) {
        console.log(`   Data: ${JSON.stringify(call.data).substring(0, 200)}...`);
      }
    });
    
    // Step 5: Try calling the API directly from the page
    console.log('\n6️⃣ Testing API directly from page context...');
    
    const apiTest = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/opportunities/public-search?limit=5');
        const data = await response.json();
        return {
          status: response.status,
          ok: response.ok,
          dataLength: data.opportunities?.length || 0,
          error: data.error,
          totalCount: data.totalCount
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Direct API test:', apiTest);
    
    // Take screenshot
    await page.screenshot({ path: 'opportunities-display-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: opportunities-display-test.png');
    
    console.log('\n✅ Test completed!');
    await new Promise(r => setTimeout(r, 20000));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await new Promise(r => setTimeout(r, 30000));
  } finally {
    await browser.close();
  }
}

// Run test
testOpportunitiesDisplay().catch(console.error);
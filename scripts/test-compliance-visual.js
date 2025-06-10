#!/usr/bin/env node
/**
 * Visual Puppeteer test for Compliance Matrix feature
 * Run with: node scripts/test-compliance-visual.js
 */

const puppeteer = require('puppeteer');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  email: 'test@example.com',
  password: 'password123'
};

async function runComplianceTest() {
  console.log('🎭 Starting Visual Puppeteer Test for Compliance Matrix');
  console.log('👁️  Browser will be visible for you to watch!');
  console.log('');

  // Launch browser in visible mode
  const browser = await puppeteer.launch({
    headless: false, // Show the browser window
    slowMo: 100, // Slow down actions by 100ms for visibility
    devtools: false, // Set to true if you want DevTools open
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1400,900',
      '--start-maximized'
    ],
    defaultViewport: null // Use full window size
  });

  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('📋 Browser:', msg.text()));
  page.on('pageerror', error => console.error('❌ Page error:', error));

  try {
    // Step 1: Navigate to login page
    console.log('\n1️⃣ Navigating to login page...');
    await page.goto(`${TEST_CONFIG.baseUrl}/login`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await new Promise(r => setTimeout(r, 1000)); // Pause for visibility

    // Step 2: Login (using mock login for development)
    console.log('2️⃣ Logging in with mock authentication...');
    
    // Find and fill the email input
    await page.waitForSelector('input[id="email"]', { timeout: 10000 });
    await page.click('input[id="email"]');
    await page.keyboard.type('dev@medcontracthub.com', { delay: 50 });
    
    // Click the submit button
    const submitButton = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    await submitButton.click();
    
    // Wait for redirect to dashboard
    console.log('⏳ Waiting for dashboard to load...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    // Verify we're on the dashboard
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Logged in successfully!');
    } else {
      console.log('⚠️ Login might have failed, current URL:', currentUrl);
    }
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Navigate to opportunities
    console.log('\n3️⃣ Navigating to opportunities page...');
    await page.goto(`${TEST_CONFIG.baseUrl}/opportunities`, {
      waitUntil: 'networkidle2'
    });
    await new Promise(r => setTimeout(r, 2000));

    // Step 4: Find an opportunity
    console.log('4️⃣ Looking for an opportunity with attachments...');
    
    // Wait for opportunities to load
    await page.waitForSelector('[data-testid="opportunity-card"], .opportunity-card, a[href*="/opportunities/"]', {
      timeout: 30000
    });

    // Click on the first opportunity
    const opportunityLink = await page.$('a[href*="/opportunities/"]:not([href="/opportunities"])');
    if (!opportunityLink) {
      throw new Error('No opportunity found');
    }
    
    const opportunityUrl = await opportunityLink.evaluate(el => el.getAttribute('href'));
    console.log(`📄 Opening opportunity: ${opportunityUrl}`);
    await opportunityLink.click();
    
    // Wait for opportunity details to load
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Step 5: Look for compliance matrix button
    console.log('\n5️⃣ Looking for "Generate Compliance Matrix" button...');
    
    // Try multiple selectors
    let complianceButton = await page.$('[data-testid="generate-compliance-matrix"]');
    
    if (!complianceButton) {
      // Try text search
      complianceButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent && btn.textContent.includes('Compliance Matrix'));
      });
    }

    if (complianceButton) {
      console.log('✅ Found compliance matrix button!');
      await new Promise(r => setTimeout(r, 1000));
      
      // Highlight the button before clicking
      await page.evaluate((el) => {
        if (el && el.style) {
          el.style.border = '3px solid red';
          el.style.backgroundColor = 'yellow';
        }
      }, complianceButton);
      
      await new Promise(r => setTimeout(r, 1000));
      
      // Click the button
      console.log('6️⃣ Clicking compliance matrix button...');
      await page.evaluate((el) => el.click(), complianceButton);
      
      // Wait for navigation or modal
      await new Promise(r => setTimeout(r, 3000));
      
      // Check if we're on compliance page
      const currentUrl = page.url();
      if (currentUrl.includes('/compliance')) {
        console.log('✅ Navigated to compliance page!');
        
        // Look for extract button
        console.log('\n7️⃣ Looking for "Extract from RFP" button...');
        await new Promise(r => setTimeout(r, 2000));
        
        const extractButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => 
            btn.textContent && (
              btn.textContent.includes('Extract from RFP') || 
              btn.textContent.includes('Extract Requirements')
            )
          );
        });
        
        if (extractButton) {
          console.log('✅ Found extract button!');
          
          // Highlight it
          await page.evaluate((el) => {
            if (el && el.style) {
              el.style.border = '3px solid green';
              el.style.backgroundColor = 'lightgreen';
            }
          }, extractButton);
          
          await new Promise(r => setTimeout(r, 2000));
          console.log('🎯 Compliance Matrix feature is working!');
        } else {
          console.log('⚠️  Extract button not found on compliance page');
        }
      } else {
        console.log('⚠️  Did not navigate to compliance page');
      }
    } else {
      console.log('❌ Compliance matrix button not found!');
      console.log('   This might mean the feature is not deployed or visible');
      
      // Take a screenshot for debugging
      await page.screenshot({ 
        path: 'compliance-button-not-found.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved: compliance-button-not-found.png');
    }

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for 30 seconds for you to inspect...');
    console.log('   You can interact with the page manually');
    console.log('   Press Ctrl+C to close early');
    
    await new Promise(r => setTimeout(r, 30000));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'compliance-test-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: compliance-test-error.png');
    
    // Keep browser open on error
    console.log('\n🔍 Browser will stay open for debugging...');
    await new Promise(r => setTimeout(r, 60000));
  } finally {
    console.log('\n👋 Closing browser...');
    await browser.close();
  }
}

// Run the test
runComplianceTest().catch(console.error);
#!/usr/bin/env tsx
/**
 * Full Visual Puppeteer test for Compliance Matrix feature
 * Run with: npx tsx scripts/test-compliance-full.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  email: 'dev@medcontracthub.com',
  password: 'password123'
};

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runComplianceTest(): Promise<void> {
  console.log('🎭 Starting Full Visual Puppeteer Test for Compliance Matrix');
  console.log('👁️  Browser will be visible for you to watch!');
  console.log('📋 All features enabled - nothing skipped\n');

  let browser: Browser | null = null;
  
  try {
    // Launch browser with all features
    browser = await puppeteer.launch({
      headless: false, // Show browser
      slowMo: 100, // Slow down by 100ms for visibility
      devtools: false, // Set to true if you want DevTools
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1400,900',
        '--start-maximized'
      ],
      defaultViewport: null // Use full window
    });

    const page = await browser.newPage();
    
    // Enable request interception for monitoring
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      console.log(`📡 ${req.method()} ${req.resourceType()}: ${req.url().substring(0, 80)}...`);
      req.continue();
    });
    
    // Enable full console logging
    page.on('console', msg => console.log('📋 Browser:', msg.text()));
    page.on('pageerror', error => console.error('❌ Page error:', error));
    page.on('error', error => console.error('❌ Error:', error));

    // Step 1: Navigate to login page
    console.log('\n1️⃣ Navigating to login page...');
    await page.goto(`${TEST_CONFIG.baseUrl}/login`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for page to be fully loaded...');
    await delay(2000);

    // Step 2: Login - just click since email is pre-filled
    console.log('\n2️⃣ Logging in (email should be pre-filled)...');
    
    // First check if email is indeed pre-filled
    const emailValue = await page.$eval('#email', (el: any) => el.value);
    console.log(`📧 Email field value: "${emailValue}"`);
    
    // Find and click submit button
    const submitButton = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    console.log('🖱️ Clicking submit button...');
    await submitButton.click();
    
    // Wait for navigation - handle both regular navigation and window.location changes
    console.log('⏳ Waiting for dashboard...');
    try {
      // First try waiting for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
    } catch {
      // If that fails, wait for URL change
      console.log('⏳ Waiting for URL change...');
      await page.waitForFunction(
        () => window.location.href.includes('/dashboard'),
        { timeout: 10000 }
      );
    }
    
    await delay(2000); // Give dashboard time to load
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('/dashboard')) {
      throw new Error('Login failed - not on dashboard');
    }
    console.log('✅ Successfully logged in!');

    // Step 3: Navigate to opportunities
    console.log('\n3️⃣ Navigating to opportunities page...');
    await page.goto(`${TEST_CONFIG.baseUrl}/opportunities`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for opportunities to load...');
    await page.waitForSelector('a[href^="/opportunities/"]:not([href="/opportunities"])', {
      timeout: 30000
    });
    
    // Get all opportunity links
    const opportunityLinks = await page.$$eval(
      'a[href^="/opportunities/"]:not([href="/opportunities"])',
      links => links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim()
      }))
    );
    
    console.log(`📊 Found ${opportunityLinks.length} opportunities`);
    if (opportunityLinks.length > 0) {
      console.log(`📄 First opportunity: ${opportunityLinks[0].text}`);
    }

    // Step 4: Click first opportunity
    console.log('\n4️⃣ Opening first opportunity...');
    const firstLink = await page.$('a[href^="/opportunities/"]:not([href="/opportunities"])');
    if (!firstLink) {
      throw new Error('No opportunity links found');
    }
    
    await firstLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    console.log('⏳ Waiting for opportunity details to load...');
    await delay(3000);

    // Step 5: Look for compliance matrix button
    console.log('\n5️⃣ Looking for "Generate Compliance Matrix" button...');
    
    // Try multiple strategies
    let complianceButton = await page.$('[data-testid="generate-compliance-matrix"]');
    
    if (!complianceButton) {
      console.log('🔍 Test-id not found, searching by text...');
      complianceButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent || '';
          return text.includes('Generate Compliance Matrix') || 
                 text.includes('Compliance Matrix') ||
                 text.includes('Create Compliance');
        });
      });
    }
    
    if (!complianceButton) {
      console.log('🔍 Button not found, looking for links...');
      const complianceLink = await page.$('a[href*="/compliance"]');
      if (complianceLink) {
        complianceButton = complianceLink;
      }
    }

    if (complianceButton) {
      console.log('✅ Found compliance matrix button/link!');
      
      // Highlight and scroll into view
      await page.evaluate((el) => {
        if (el && el instanceof HTMLElement) {
          el.style.border = '3px solid red';
          el.style.backgroundColor = 'yellow';
          el.style.padding = '5px';
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, complianceButton);
      
      console.log('📸 Button highlighted in yellow with red border');
      await delay(2000); // Pause to see highlight
      
      // Click the button
      console.log('🖱️ Clicking compliance matrix button...');
      await page.evaluate((el) => {
        if (el && el instanceof HTMLElement) el.click();
      }, complianceButton);
      
      // Wait for navigation or modal
      console.log('⏳ Waiting for compliance page/modal...');
      await delay(3000);
      
      // Check if we navigated to compliance page
      const newUrl = page.url();
      if (newUrl.includes('/compliance')) {
        console.log('✅ Successfully navigated to compliance page!');
        console.log(`📍 Compliance URL: ${newUrl}`);
        
        // Look for extract button
        console.log('\n6️⃣ Looking for "Extract from RFP" button...');
        await delay(2000);
        
        const extractButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => {
            const text = btn.textContent || '';
            return text.includes('Extract from RFP') || 
                   text.includes('Extract Requirements') ||
                   text.includes('Extract Compliance');
          });
        });
        
        if (extractButton) {
          console.log('✅ Found extract button!');
          
          // Highlight it
          await page.evaluate((el) => {
            if (el && el instanceof HTMLElement) {
              el.style.border = '3px solid green';
              el.style.backgroundColor = 'lightgreen';
              el.style.padding = '5px';
            }
          }, extractButton);
          
          console.log('📸 Extract button highlighted in green');
          await delay(2000);
          
          console.log('\n🎉 SUCCESS! Compliance Matrix feature is working!');
        } else {
          console.log('⚠️  Extract button not found on compliance page');
        }
      } else {
        console.log('⚠️  Did not navigate to compliance page');
        console.log(`📍 Still on: ${newUrl}`);
      }
    } else {
      console.log('❌ Compliance matrix button not found!');
      console.log('   Taking screenshot for debugging...');
      
      await page.screenshot({ 
        path: 'compliance-button-not-found.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved: compliance-button-not-found.png');
      
      // List all buttons on page for debugging
      const allButtons = await page.$$eval('button', buttons => 
        buttons.map(btn => btn.textContent?.trim()).filter(text => text)
      );
      console.log('\n📋 All buttons on page:');
      allButtons.forEach((text, i) => console.log(`   ${i + 1}. ${text}`));
    }

    // Keep browser open
    console.log('\n🔍 Browser will stay open for 30 seconds for inspection...');
    console.log('   You can interact with the page manually');
    console.log('   Press Ctrl+C to close early');
    
    await delay(30000);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (browser) {
      const page = (await browser.pages())[0];
      await page.screenshot({ 
        path: 'compliance-test-error.png',
        fullPage: true 
      });
      console.log('📸 Error screenshot saved: compliance-test-error.png');
    }
    
    // Keep browser open on error
    console.log('\n🔍 Browser will stay open for debugging...');
    await delay(60000);
  } finally {
    if (browser) {
      console.log('\n👋 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
runComplianceTest().catch(console.error);
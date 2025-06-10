#!/usr/bin/env tsx
/**
 * Fast Visual Puppeteer test for Compliance Matrix feature
 * Run with: npm run tsx scripts/test-compliance-visual-fast.ts
 * Or directly: npx tsx scripts/test-compliance-visual-fast.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  email: 'dev@medcontracthub.com',
  password: 'password123'
};

// Type definitions for better performance
interface TestResults {
  loginSuccess: boolean;
  opportunityFound: boolean;
  complianceButtonFound: boolean;
  compliancePageLoaded: boolean;
  extractButtonFound: boolean;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runComplianceTest(): Promise<void> {
  console.log('🚀 Starting Fast Visual Puppeteer Test for Compliance Matrix');
  console.log('👁️  Browser will be visible for you to watch!');
  console.log('⚡ Using TypeScript for better performance\n');

  let browser: Browser | null = null;
  
  try {
    // Launch browser with optimized settings
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50, // Reduced from 100ms for faster execution
      devtools: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1400,900',
        '--start-maximized'
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();
    
    // Skip request interception - it can slow things down
    // Only enable minimal console logging
    page.on('pageerror', error => console.error('❌ Page error:', error));

    const results: TestResults = {
      loginSuccess: false,
      opportunityFound: false,
      complianceButtonFound: false,
      compliancePageLoaded: false,
      extractButtonFound: false
    };

    // Step 1: Login with optimized navigation
    console.log('1️⃣ Navigating to login page...');
    await page.goto(`${TEST_CONFIG.baseUrl}/login`, { 
      waitUntil: 'networkidle0', // Wait for page to fully load
      timeout: 30000 
    });

    // Wait for login form to be visible
    await page.waitForSelector('#email', { visible: true, timeout: 10000 });
    
    // The email is pre-filled, just need to click submit
    console.log('   Email is pre-filled, clicking submit...');
    
    const submitButton = await page.waitForSelector('button[type="submit"]', { visible: true });
    
    // Click the submit button
    await submitButton.click();
    
    // Wait for the page to navigate to dashboard (mock login uses window.location.href)
    // We can't use waitForNavigation with window.location.href, so we poll for URL change
    await page.waitForFunction(
      (targetUrl) => window.location.href.includes(targetUrl),
      { timeout: 15000 },
      'dashboard'
    );
    
    // Give the page time to fully load after navigation
    await delay(3000);
    
    results.loginSuccess = page.url().includes('/dashboard');
    console.log(results.loginSuccess ? '✅ Login successful!' : '❌ Login failed');
    console.log(`   Current URL: ${page.url()}`);

    if (!results.loginSuccess) {
      throw new Error('Login failed - cannot continue test');
    }

    // Step 2: Navigate to opportunities with direct URL
    console.log('\n2️⃣ Navigating to opportunities...');
    await page.goto(`${TEST_CONFIG.baseUrl}/opportunities`, {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for any opportunity link
    const opportunityLink = await page.waitForSelector(
      'a[href^="/opportunities/"]:not([href="/opportunities"])',
      { timeout: 10000 }
    );
    
    if (opportunityLink) {
      results.opportunityFound = true;
      console.log('✅ Found opportunity');
      
      // Get the href before clicking
      const href = await opportunityLink.evaluate(el => el.getAttribute('href'));
      console.log(`📄 Opening: ${href}`);
      
      // Navigate directly for speed
      await page.goto(`${TEST_CONFIG.baseUrl}${href}`, {
        waitUntil: 'domcontentloaded'
      });
    }

    // Step 3: Look for compliance button with multiple strategies
    console.log('\n3️⃣ Looking for compliance matrix button...');
    
    // Wait for the actions section to be visible
    await page.waitForSelector('.space-y-3', { visible: true });
    
    // Strategy 1: Direct test-id selector
    let complianceButton = await page.$('[data-testid="generate-compliance-matrix"]');
    
    // Strategy 2: Text search if test-id not found
    if (!complianceButton) {
      complianceButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent || '';
          return text.includes('Compliance Matrix') || text.includes('Generate Compliance');
        });
      });
    }
    
    // Strategy 3: Link search
    if (!complianceButton) {
      const complianceLink = await page.$('a[href*="/compliance"]');
      if (complianceLink) {
        complianceButton = complianceLink;
      }
    }

    if (complianceButton) {
      results.complianceButtonFound = true;
      console.log('✅ Found compliance button!');
      
      // Scroll the button into view and highlight it
      await page.evaluate((el) => {
        if (el && el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.border = '3px solid red';
          el.style.backgroundColor = 'yellow';
        }
      }, complianceButton);
      
      await delay(1500); // Brief pause to see highlight
      
      // Take screenshot before clicking
      await page.screenshot({ 
        path: 'before-compliance-click.png',
        fullPage: true 
      });
      
      // Try a more direct click approach
      console.log('   Clicking compliance button...');
      
      // Method 1: Direct click on the element handle
      try {
        await (complianceButton as any).click();
      } catch (e) {
        console.log('   Direct click failed, trying evaluate click...');
        // Method 2: Click via page.evaluate
        await page.evaluate((el) => {
          if (el && el instanceof HTMLElement) {
            el.click();
          }
        }, complianceButton);
      }
      
      // Wait for potential navigation
      await delay(3000);
      
      // Take screenshot after clicking
      await page.screenshot({ 
        path: 'after-compliance-click.png',
        fullPage: true 
      });
      
      // Check if URL changed
      const currentUrl = page.url();
      results.compliancePageLoaded = currentUrl.includes('/compliance');
      console.log(`   After click URL: ${currentUrl}`);
      
      if (results.compliancePageLoaded) {
        console.log('✅ Compliance page loaded!');
        
        // Look for extract button
        const extractButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => {
            const text = btn.textContent || '';
            return text.includes('Extract') && text.includes('RFP');
          });
        });
        
        if (extractButton) {
          results.extractButtonFound = true;
          console.log('✅ Extract from RFP button found!');
          
          // Highlight extract button
          await page.evaluate((el) => {
            if (el && el instanceof HTMLElement) {
              el.style.border = '3px solid green';
              el.style.backgroundColor = 'lightgreen';
            }
          }, extractButton);
        }
      }
    } else {
      console.log('❌ Compliance button not found');
      
      // Take debug screenshot
      await page.screenshot({ 
        path: 'compliance-button-not-found.png',
        fullPage: true 
      });
    }

    // Results summary
    console.log('\n📊 Test Results Summary:');
    console.log(`   Login: ${results.loginSuccess ? '✅' : '❌'}`);
    console.log(`   Opportunity Found: ${results.opportunityFound ? '✅' : '❌'}`);
    console.log(`   Compliance Button: ${results.complianceButtonFound ? '✅' : '❌'}`);
    console.log(`   Compliance Page: ${results.compliancePageLoaded ? '✅' : '❌'}`);
    console.log(`   Extract Button: ${results.extractButtonFound ? '✅' : '❌'}`);
    
    const allPassed = Object.values(results).every(v => v);
    console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
    
    // Keep browser open for inspection
    console.log('\n🔍 Browser will stay open for 20 seconds...');
    console.log('   Press Ctrl+C to close early');
    await delay(20000);

  } catch (error) {
    console.error('\n❌ Test error:', error);
    
    if (browser) {
      const page = (await browser.pages())[0];
      await page.screenshot({ 
        path: 'compliance-test-error.png',
        fullPage: true 
      });
      console.log('📸 Error screenshot saved');
    }
    
    // Keep open on error
    await delay(30000);
  } finally {
    if (browser) {
      console.log('\n👋 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
runComplianceTest().catch(console.error);
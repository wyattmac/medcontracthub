#!/usr/bin/env tsx
/**
 * Simple test to verify compliance matrix feature is accessible
 */

import puppeteer from 'puppeteer';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  email: 'dev@medcontracthub.com',
  password: 'password123'
};

async function runSimpleComplianceTest() {
  console.log('🧪 Testing Compliance Matrix Feature\n');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    devtools: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();
    
    // 1. Login
    console.log('1️⃣ Logging in...');
    await page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await page.waitForSelector('#email', { visible: true });
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.href.includes('/dashboard'), { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Logged in successfully');

    // 2. Go to opportunities
    console.log('\n2️⃣ Navigating to opportunities...');
    await page.goto(`${TEST_CONFIG.baseUrl}/opportunities`);
    await page.waitForSelector('a[href^="/opportunities/"]:not([href="/opportunities"])', { timeout: 10000 });
    
    // Get first opportunity link
    const opportunityHref = await page.$eval(
      'a[href^="/opportunities/"]:not([href="/opportunities"])',
      el => el.getAttribute('href')
    );
    console.log(`✅ Found opportunity: ${opportunityHref}`);

    // 3. Open opportunity detail
    console.log('\n3️⃣ Opening opportunity detail...');
    await page.goto(`${TEST_CONFIG.baseUrl}${opportunityHref}`);
    await page.waitForSelector('h1', { visible: true });
    
    // 4. Check for compliance button
    console.log('\n4️⃣ Checking for compliance matrix button...');
    
    // Take screenshot to see current page
    await page.screenshot({ path: 'opportunity-detail-page.png', fullPage: true });
    
    const complianceButton = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="generate-compliance-matrix"]');
      if (button) {
        return {
          found: true,
          text: button.textContent,
          visible: !!(button as HTMLElement).offsetParent
        };
      }
      
      // Also check for button with text
      const buttons = Array.from(document.querySelectorAll('button'));
      const textButton = buttons.find(btn => btn.textContent?.includes('Compliance Matrix'));
      if (textButton) {
        return {
          found: true,
          text: textButton.textContent,
          visible: !!(textButton as HTMLElement).offsetParent,
          byText: true
        };
      }
      
      return { found: false };
    });
    
    if (complianceButton.found) {
      console.log(`✅ Compliance button found: "${complianceButton.text}"`);
      console.log(`   Visible: ${complianceButton.visible}`);
      
      // 5. Try navigating directly to compliance page
      console.log('\n5️⃣ Navigating directly to compliance page...');
      const opportunityId = opportunityHref?.split('/').pop();
      const complianceUrl = `${TEST_CONFIG.baseUrl}/opportunities/${opportunityId}/compliance`;
      
      await page.goto(complianceUrl);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we're on the compliance page
      const pageTitle = await page.$eval('h1', el => el.textContent).catch(() => null);
      const currentUrl = page.url();
      
      console.log(`   Current URL: ${currentUrl}`);
      console.log(`   Page title: ${pageTitle}`);
      
      if (currentUrl.includes('/compliance') && pageTitle?.includes('Compliance Matrix')) {
        console.log('✅ Compliance Matrix page loaded successfully!');
        
        // Look for the compliance matrix generator component
        const generatorExists = await page.$('[data-testid="compliance-generator"]') !== null;
        const extractButton = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.some(btn => btn.textContent?.includes('Extract') && btn.textContent?.includes('RFP'));
        });
        
        console.log(`   Generator component: ${generatorExists ? '✅' : '❌'}`);
        console.log(`   Extract from RFP button: ${extractButton ? '✅' : '❌'}`);
      } else {
        console.log('❌ Failed to load compliance page');
      }
    } else {
      console.log('❌ Compliance button not found');
    }
    
    console.log('\n✅ Test completed. Browser will stay open for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    const pages = await browser.pages();
    if (pages.length > 0) {
      await pages[0].screenshot({ path: 'simple-test-error.png', fullPage: true });
    }
  } finally {
    await browser.close();
  }
}

runSimpleComplianceTest().catch(console.error);
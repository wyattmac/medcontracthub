#!/usr/bin/env tsx
/**
 * Direct test for Compliance Matrix feature
 * This bypasses authentication issues by going directly to pages
 * Run with: npx tsx scripts/test-compliance-direct.ts
 */

import puppeteer from 'puppeteer';

async function runTest() {
  console.log('🚀 Starting Direct Compliance Matrix Test');
  console.log('📋 This test bypasses auth and goes directly to pages\n');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();

  try {
    // Step 1: First, let's go to the login page and set up mock auth
    console.log('1️⃣ Setting up mock authentication...');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('button[type="submit"]');
    
    // Click login to set up session
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 3000));
    
    // Step 2: Go directly to a test opportunity page
    // Using a hardcoded ID that should exist in the mock data
    console.log('\n2️⃣ Going directly to a test opportunity...');
    
    // First, let's try to get an opportunity ID from the API
    const opportunityId = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test-opportunities');
        const data = await response.json();
        if (data.opportunities && data.opportunities.length > 0) {
          return data.opportunities[0].id;
        }
      } catch (e) {
        console.error('Could not fetch test opportunities:', e);
      }
      // Fallback to a mock ID
      return 'test-opportunity-123';
    });
    
    console.log(`📄 Using opportunity ID: ${opportunityId}`);
    
    // Navigate directly to the opportunity
    await page.goto(`http://localhost:3000/opportunities/${opportunityId}`);
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if we got a 404
    const pageTitle = await page.title();
    if (pageTitle.includes('404') || pageTitle.includes('Not Found')) {
      console.log('⚠️  Opportunity page returned 404, trying different approach...');
      
      // Let's create a test opportunity first
      console.log('\n3️⃣ Creating test opportunity...');
      await page.goto('http://localhost:3000/api/add-test-data');
      await new Promise(r => setTimeout(r, 2000));
      
      // Now try the opportunities list
      await page.goto('http://localhost:3000/opportunities');
      await new Promise(r => setTimeout(r, 3000));
      
      // Look for any opportunity cards
      const opportunityCards = await page.$$('[data-testid="opportunity-card"], .opportunity-card, a[href^="/opportunities/"]');
      console.log(`📊 Found ${opportunityCards.length} opportunity cards`);
      
      if (opportunityCards.length === 0) {
        console.log('❌ No opportunities found on the page');
        
        // Take a screenshot to debug
        await page.screenshot({ path: 'no-opportunities.png', fullPage: true });
        console.log('📸 Screenshot saved: no-opportunities.png');
        
        // Check what's actually on the page
        const pageContent = await page.evaluate(() => {
          return {
            title: document.title,
            headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent),
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent),
            links: Array.from(document.querySelectorAll('a')).map(a => ({
              text: a.textContent,
              href: a.getAttribute('href')
            }))
          };
        });
        
        console.log('\n📋 Page content:');
        console.log('Title:', pageContent.title);
        console.log('Headings:', pageContent.headings);
        console.log('Buttons:', pageContent.buttons.filter(b => b).slice(0, 10));
        console.log('Links:', pageContent.links.filter(l => l.href && l.href.includes('opportunities')).slice(0, 5));
      }
    } else {
      // We're on an opportunity page
      console.log('✅ On opportunity detail page');
      
      // Look for compliance button
      console.log('\n4️⃣ Looking for Compliance Matrix button...');
      
      // Wait a bit for dynamic content
      await new Promise(r => setTimeout(r, 2000));
      
      // Try multiple selectors
      let complianceButton = await page.$('[data-testid="generate-compliance-matrix"]');
      
      if (!complianceButton) {
        // Search by text
        complianceButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const found = buttons.find(btn => {
            const text = btn.textContent || '';
            return text.toLowerCase().includes('compliance') && 
                   (text.includes('Matrix') || text.includes('Generate'));
          });
          if (found) return found;
          
          // Also check links
          const links = Array.from(document.querySelectorAll('a'));
          return links.find(link => {
            const text = link.textContent || '';
            const href = link.getAttribute('href') || '';
            return (text.toLowerCase().includes('compliance') || href.includes('compliance'));
          });
        });
      }
      
      if (complianceButton) {
        console.log('✅ Found compliance button!');
        
        // Highlight it
        await page.evaluate(el => {
          if (el instanceof HTMLElement) {
            el.style.border = '3px solid red';
            el.style.backgroundColor = 'yellow';
            el.scrollIntoView({ block: 'center' });
          }
        }, complianceButton);
        
        await new Promise(r => setTimeout(r, 2000));
        
        // Click it
        console.log('5️⃣ Clicking compliance button...');
        await page.evaluate(el => (el as HTMLElement).click(), complianceButton);
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Check if we're on compliance page
        if (page.url().includes('/compliance')) {
          console.log('✅ Successfully navigated to compliance page!');
          console.log(`📍 URL: ${page.url()}`);
          
          // Take success screenshot
          await page.screenshot({ path: 'compliance-success.png', fullPage: true });
          console.log('📸 Success screenshot saved: compliance-success.png');
        }
      } else {
        console.log('❌ Compliance button not found');
        
        // Debug: List all buttons
        const allButtons = await page.$$eval('button', buttons => 
          buttons.map(btn => btn.textContent?.trim()).filter(text => text)
        );
        console.log('\n📋 All buttons on page:');
        allButtons.forEach((text, i) => {
          if (i < 15) console.log(`   ${i + 1}. ${text}`);
        });
        
        // Take screenshot
        await page.screenshot({ path: 'opportunity-page.png', fullPage: true });
        console.log('\n📸 Screenshot saved: opportunity-page.png');
      }
    }
    
    console.log('\n✨ Test complete! Browser stays open for 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: 'error.png', fullPage: true });
    await new Promise(r => setTimeout(r, 60000));
  } finally {
    await browser.close();
  }
}

runTest();
/**
 * Simple Puppeteer test for button functionality
 */

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('🧪 Testing button functionality...\n');
  
  // Test the test page first
  console.log('1️⃣ Testing button test page...');
  await page.goto('http://localhost:3000/test-buttons');
  await page.waitForTimeout(2000);
  
  // Click success toast button
  try {
    await page.click('button:has-text("Success Toast")');
    console.log('✅ Success toast button clicked');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log('❌ Could not click success toast button');
  }
  
  // Test main dashboard
  console.log('\n2️⃣ Testing main dashboard...');
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(3000);
  
  // Check if opportunities loaded
  const hasOpportunities = await page.$('.space-y-4');
  if (hasOpportunities) {
    console.log('✅ Opportunities list found');
    
    // Try to find save button
    const saveButtons = await page.$$('button');
    console.log(`   Found ${saveButtons.length} buttons on page`);
    
    // Log all button texts
    for (let i = 0; i < Math.min(5, saveButtons.length); i++) {
      const text = await saveButtons[i].evaluate(el => el.textContent);
      console.log(`   Button ${i + 1}: "${text}"`);
    }
  } else {
    console.log('❌ No opportunities list found');
  }
  
  // Check for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console error:', msg.text());
    }
  });
  
  await page.waitForTimeout(2000);
  console.log('\n✅ Test completed');
  
  await browser.close();
})();
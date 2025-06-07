import puppeteer from 'puppeteer';

async function testAIAnalyzeFeature() {
  console.log('🧪 Testing AI Analyze Feature with Puppeteer\n');

  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();
    
    // Go to the app
    console.log('📱 Navigating to app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Take initial screenshot
    await page.screenshot({ path: '/tmp/01-landing.png' });
    console.log('✅ Captured landing page');

    // Check if we need to login
    const loginButton = await page.$('a[href="/login"]');
    if (loginButton) {
      console.log('🔐 Need to login first...');
      await loginButton.click();
      await page.waitForNavigation();
      
      // Check for dev login option
      const devLoginButton = await page.$('button:has-text("Development Login")');
      if (devLoginButton) {
        console.log('👨‍💻 Using development login...');
        await devLoginButton.click();
        await page.waitForNavigation();
      } else {
        console.log('❌ No dev login found, manual login required');
        await browser.close();
        return;
      }
    }

    // Navigate to saved opportunities
    console.log('\n📌 Navigating to Saved Opportunities...');
    await page.goto('http://localhost:3000/saved', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);
    
    // Take screenshot of saved opportunities page
    await page.screenshot({ path: '/tmp/02-saved-opportunities.png' });
    console.log('✅ Captured saved opportunities page');

    // Look for AI Analyze buttons
    const aiAnalyzeButtons = await page.$$('button[title="Analyze opportunity attachments with AI"]');
    console.log(`\n🔍 Found ${aiAnalyzeButtons.length} AI Analyze buttons`);

    if (aiAnalyzeButtons.length === 0) {
      console.log('⚠️  No saved opportunities with AI Analyze buttons found');
      console.log('   Make sure you have saved opportunities first');
      
      // Check if there are any saved opportunities at all
      const noOpportunitiesText = await page.$('text=No saved opportunities');
      if (noOpportunitiesText) {
        console.log('   ℹ️  No saved opportunities found - save some opportunities first');
      }
    } else {
      // Click the first AI Analyze button
      console.log('\n🧠 Clicking AI Analyze button...');
      await aiAnalyzeButtons[0].click();
      
      // Wait for modal to appear
      await page.waitForTimeout(1000);
      
      // Check if modal opened
      const modalTitle = await page.$('h2:has-text("AI Analysis Results")');
      if (modalTitle) {
        console.log('✅ AI Analysis modal opened!');
        
        // Take screenshot of modal
        await page.screenshot({ path: '/tmp/03-ai-analysis-modal.png' });
        
        // Wait for analysis to complete (check for loading spinner)
        const loadingSpinner = await page.$('.animate-spin');
        if (loadingSpinner) {
          console.log('⏳ Waiting for analysis to complete...');
          await page.waitForSelector('.animate-spin', { hidden: true, timeout: 30000 });
          console.log('✅ Analysis completed!');
        }
        
        // Take screenshot of results
        await page.screenshot({ path: '/tmp/04-analysis-results.png' });
        
        // Check for results
        const resultsCards = await page.$$('[role="dialog"] .space-y-6 > div > div');
        console.log(`📊 Found ${resultsCards.length} result cards`);
        
        // Check for tabs
        const tabs = await page.$$('[role="tablist"] button');
        console.log(`📑 Found ${tabs.length} tabs in results`);
        
        if (tabs.length >= 3) {
          // Click through tabs
          for (let i = 0; i < Math.min(tabs.length, 3); i++) {
            const tabNames = ['Extracted Data', 'Medical Analysis', 'Text Preview'];
            console.log(`   Clicking ${tabNames[i]} tab...`);
            await tabs[i].click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: `/tmp/05-tab-${i + 1}-${tabNames[i].toLowerCase().replace(' ', '-')}.png` });
          }
        }
        
        // Check for error messages
        const errorAlert = await page.$('[role="dialog"] [role="alert"]');
        if (errorAlert) {
          const errorText = await errorAlert.textContent();
          console.log(`⚠️  Error found: ${errorText}`);
        }
        
      } else {
        console.log('❌ AI Analysis modal did not open');
        
        // Check for error toast
        const errorToast = await page.$('[data-radix-toast-viewport]');
        if (errorToast) {
          const toastText = await errorToast.textContent();
          console.log(`   Error toast: ${toastText}`);
        }
      }
    }

    // Test summary
    console.log('\n📊 Test Summary:');
    console.log('✅ App is running');
    console.log(`${aiAnalyzeButtons.length > 0 ? '✅' : '❌'} AI Analyze buttons are visible`);
    console.log(`${await page.$('h2:has-text("AI Analysis Results")') ? '✅' : '❌'} Modal opens on click`);
    
    console.log('\n📸 Screenshots saved to:');
    console.log('   /tmp/01-landing.png');
    console.log('   /tmp/02-saved-opportunities.png');
    if (aiAnalyzeButtons.length > 0) {
      console.log('   /tmp/03-ai-analysis-modal.png');
      console.log('   /tmp/04-analysis-results.png');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('\n✨ Test completed!');
  }
}

// Run the test
testAIAnalyzeFeature().catch(console.error);
#!/usr/bin/env node

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';

async function testNavAndButtons() {
  console.log('🧪 Testing Navigation and Buttons');
  console.log('='.repeat(50));
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Go to home page
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    console.log('✅ Loaded home page');
    
    // Find all navigation links
    const navLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/"]'));
      return links.map(link => ({
        text: link.textContent.trim(),
        href: link.getAttribute('href'),
        className: link.className
      }));
    });
    
    console.log('\n📍 Navigation Links Found:');
    navLinks.forEach(link => {
      console.log(`  - ${link.text || 'No text'}: ${link.href}`);
    });
    
    // Find all buttons
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.map(btn => ({
        text: btn.textContent.trim(),
        className: btn.className,
        hasIcon: btn.querySelector('svg') !== null,
        ariaLabel: btn.getAttribute('aria-label')
      }));
    });
    
    console.log(`\n🔘 Buttons Found: ${buttons.length}`);
    buttons.slice(0, 10).forEach(btn => {
      console.log(`  - ${btn.text || btn.ariaLabel || 'Icon button'} ${btn.hasIcon ? '(with icon)' : ''}`);
    });
    
    // Test each main page
    const pages = [
      { name: 'Opportunities', url: '/opportunities' },
      { name: 'Saved', url: '/saved' },
      { name: 'Analytics', url: '/analytics' },
      { name: 'Proposals', url: '/proposals' }
    ];
    
    for (const pageInfo of pages) {
      console.log(`\n📄 Testing ${pageInfo.name} page...`);
      
      try {
        await page.goto(`${BASE_URL}${pageInfo.url}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        
        // Wait a bit for content to load
        await page.waitForTimeout(2000);
        
        // Count interactive elements
        const stats = await page.evaluate(() => {
          return {
            buttons: document.querySelectorAll('button').length,
            links: document.querySelectorAll('a').length,
            inputs: document.querySelectorAll('input, select, textarea').length,
            clickable: document.querySelectorAll('[onclick], [role="button"]').length
          };
        });
        
        console.log(`  ✓ Loaded successfully`);
        console.log(`  - Buttons: ${stats.buttons}`);
        console.log(`  - Links: ${stats.links}`);
        console.log(`  - Form inputs: ${stats.inputs}`);
        console.log(`  - Other clickable: ${stats.clickable}`);
        
        // Check for specific elements on each page
        if (pageInfo.url === '/opportunities') {
          const hasSearch = await page.$('input[type="search"], input[placeholder*="Search"]');
          const hasBookmarks = await page.$$('button svg.lucide-bookmark');
          console.log(`  - Has search: ${!!hasSearch}`);
          console.log(`  - Bookmark buttons: ${hasBookmarks.length}`);
        }
        
      } catch (error) {
        console.log(`  ❌ Error loading ${pageInfo.name}: ${error.message}`);
      }
    }
    
    // Test mobile menu
    console.log('\n📱 Testing Mobile Menu...');
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    const mobileMenuBtn = await page.$('button svg.lucide-menu');
    if (mobileMenuBtn) {
      console.log('  ✓ Mobile menu button found');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Navigation and Button Test Complete');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testNavAndButtons().catch(console.error);
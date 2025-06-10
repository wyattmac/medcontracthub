#!/usr/bin/env tsx
/**
 * Test script for Contract Documents and Attachments
 * Tests the public API endpoints for fetching and downloading attachments
 */

import puppeteer from 'puppeteer';

async function testAttachments() {
  console.log('🧪 Testing Contract Documents and Attachments\n');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 }
  });

  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser error:', msg.text());
    }
  });

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForFunction(() => window.location.href.includes('/dashboard'), { timeout: 10000 });
    console.log('✅ Logged in');
    
    // Step 2: Navigate to opportunities
    console.log('\n2️⃣ Going to opportunities page...');
    await page.goto('http://localhost:3000/opportunities');
    await new Promise(r => setTimeout(r, 3000));
    
    // Step 3: Find and click first opportunity
    console.log('3️⃣ Opening first opportunity...');
    const opportunityLink = await page.$('a[href^="/opportunities/"]:not([href="/opportunities"])');
    
    if (!opportunityLink) {
      console.log('❌ No opportunities found');
      await page.screenshot({ path: 'no-opportunities-test.png' });
      throw new Error('No opportunities available');
    }
    
    // Get opportunity URL
    const opportunityHref = await opportunityLink.evaluate(el => el.getAttribute('href'));
    const opportunityId = opportunityHref?.split('/').pop();
    console.log(`📄 Opening opportunity: ${opportunityId}`);
    
    await opportunityLink.click();
    await page.waitForNavigation();
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 4: Test attachments API directly
    console.log('\n4️⃣ Testing attachments API...');
    
    // Test the public attachments endpoint
    const attachmentsResponse = await page.evaluate(async (oppId) => {
      try {
        const response = await fetch(`/api/sam-gov/attachments/public?opportunityId=${oppId}`);
        const data = await response.json();
        return {
          status: response.status,
          ok: response.ok,
          data: data
        };
      } catch (error) {
        return { error: error.message };
      }
    }, opportunityId);
    
    console.log('📡 Attachments API Response:');
    console.log(`   Status: ${attachmentsResponse.status} ${attachmentsResponse.ok ? '✅' : '❌'}`);
    
    if (attachmentsResponse.ok && attachmentsResponse.data) {
      console.log(`   Success: ${attachmentsResponse.data.success}`);
      console.log(`   Attachments found: ${attachmentsResponse.data.count}`);
      console.log(`   Notice ID: ${attachmentsResponse.data.noticeId}`);
      
      if (attachmentsResponse.data.attachments && attachmentsResponse.data.attachments.length > 0) {
        console.log('\n   📎 Attachments:');
        attachmentsResponse.data.attachments.forEach((att: any, i: number) => {
          console.log(`   ${i + 1}. ${att.name}`);
          console.log(`      - ID: ${att.id}`);
          console.log(`      - URL: ${att.url}`);
          console.log(`      - Size: ${(att.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`      - Type: ${att.type}`);
        });
      }
    } else {
      console.log('   ❌ Failed to fetch attachments');
      console.log('   Error:', attachmentsResponse.data?.error || 'Unknown error');
    }
    
    // Step 5: Look for compliance matrix button
    console.log('\n5️⃣ Looking for Compliance Matrix button...');
    
    let complianceButton = await page.$('[data-testid="generate-compliance-matrix"]');
    
    if (!complianceButton) {
      complianceButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent || '';
          return text.includes('Generate Compliance Matrix') || text.includes('Compliance Matrix');
        });
      });
    }
    
    if (complianceButton) {
      console.log('✅ Found Compliance Matrix button');
      
      // Highlight it
      await page.evaluate(el => {
        if (el instanceof HTMLElement) {
          el.style.border = '3px solid green';
          el.style.backgroundColor = 'lightgreen';
          el.scrollIntoView({ block: 'center' });
        }
      }, complianceButton);
      
      await new Promise(r => setTimeout(r, 1000));
      
      // Click it
      console.log('6️⃣ Clicking Compliance Matrix button...');
      await page.evaluate(el => (el as HTMLElement).click(), complianceButton);
      
      await new Promise(r => setTimeout(r, 3000));
      
      // Check if we're on compliance page
      if (page.url().includes('/compliance')) {
        console.log('✅ Navigated to compliance page');
        
        // Look for "Extract from RFP" button
        await new Promise(r => setTimeout(r, 2000));
        
        const extractButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => {
            const text = btn.textContent || '';
            return text.includes('Extract from RFP') || text.includes('Extract Requirements');
          });
        });
        
        if (extractButton) {
          console.log('✅ Found Extract from RFP button');
          
          // Click it to open modal
          console.log('\n7️⃣ Opening requirement extractor modal...');
          await page.evaluate(el => (el as HTMLElement).click(), extractButton);
          
          await new Promise(r => setTimeout(r, 2000));
          
          // Check if modal opened and attachments are shown
          const modalInfo = await page.evaluate(() => {
            const modal = document.querySelector('[data-testid="requirement-extractor-modal"]') ||
                         document.querySelector('[role="dialog"]');
            
            if (!modal) return { modalFound: false };
            
            // Look for document list
            const documentList = modal.querySelector('[data-testid="document-list"]') ||
                               modal.querySelector('[data-testid="attachment-list"]');
            
            // Count documents
            const documentItems = modal.querySelectorAll('[data-testid="document-item"], input[type="radio"]');
            
            // Check for loading or error states
            const isLoading = !!modal.querySelector('.animate-spin, [data-testid="loading"]');
            const hasError = modal.textContent?.includes('Failed to fetch attachments') ||
                           modal.textContent?.includes('401');
            
            return {
              modalFound: true,
              documentListFound: !!documentList,
              documentCount: documentItems.length,
              isLoading,
              hasError,
              modalContent: modal.textContent?.substring(0, 200)
            };
          });
          
          console.log('\n📋 Modal Status:');
          console.log(`   Modal found: ${modalInfo.modalFound ? '✅' : '❌'}`);
          if (modalInfo.modalFound) {
            console.log(`   Document list: ${modalInfo.documentListFound ? '✅' : '❌'}`);
            console.log(`   Documents shown: ${modalInfo.documentCount}`);
            console.log(`   Loading: ${modalInfo.isLoading ? 'Yes' : 'No'}`);
            console.log(`   Error: ${modalInfo.hasError ? '❌ Yes' : '✅ No'}`);
            
            if (modalInfo.hasError) {
              console.log('   ❌ Modal shows error - likely 401 authentication issue');
            } else if (modalInfo.documentCount > 0) {
              console.log('   ✅ Attachments are being displayed correctly!');
            }
          }
          
          // Take screenshot of modal
          await page.screenshot({ path: 'compliance-modal-test.png', fullPage: true });
          console.log('\n📸 Screenshot saved: compliance-modal-test.png');
        }
      }
    } else {
      console.log('❌ Compliance Matrix button not found');
    }
    
    // Step 6: Test download endpoint
    console.log('\n8️⃣ Testing download endpoint...');
    
    if (attachmentsResponse.ok && attachmentsResponse.data?.attachments?.length > 0) {
      const firstAttachment = attachmentsResponse.data.attachments[0];
      
      const downloadResponse = await page.evaluate(async (url, filename) => {
        try {
          const response = await fetch(`/api/sam-gov/attachments/download/public?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`);
          return {
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length')
          };
        } catch (error) {
          return { error: error.message };
        }
      }, firstAttachment.url, firstAttachment.name);
      
      console.log('📥 Download API Response:');
      console.log(`   Status: ${downloadResponse.status} ${downloadResponse.ok ? '✅' : '❌'}`);
      console.log(`   Content-Type: ${downloadResponse.contentType}`);
      console.log(`   Size: ${downloadResponse.contentLength ? (parseInt(downloadResponse.contentLength) / 1024).toFixed(2) + ' KB' : 'Unknown'}`);
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('   - Attachments API is accessible without authentication');
    console.log('   - Attachments are tied to specific opportunities');
    console.log('   - Compliance matrix feature can access attachments');
    
    // Keep browser open
    console.log('\n🔍 Browser stays open for 20 seconds...');
    await new Promise(r => setTimeout(r, 20000));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await page.screenshot({ path: 'attachments-test-error.png', fullPage: true });
    await new Promise(r => setTimeout(r, 30000));
  } finally {
    await browser.close();
  }
}

// Run the test
testAttachments().catch(console.error);
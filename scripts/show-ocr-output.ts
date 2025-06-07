#!/usr/bin/env node

// Show actual OCR output from a SAM.gov attachment
import { config } from 'dotenv';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { FormData } from 'formdata-node';
import { fileFromPath } from 'formdata-node/file-from-path';

config();

const SAM_API_KEY = 'vbPavNF4VAfrN74MXma3M08Bce4wStctxNWFPpZH';
const MISTRAL_API_KEY = 'kHrG0LTUXGCXLUKF5M9mZVBbpJjWmKhF';

// Real attachment from SAM.gov
const ATTACHMENT = {
  noticeId: 'fc501bac454d4059acaaf6f2616444ed',
  title: 'Surgical Booms and Light Upgrades',
  url: 'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/7ccbe8a90ef645b987c289d0353e7da4/download'
};

async function downloadFile(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const downloadUrl = `${url}?api_key=${SAM_API_KEY}`;
    const filePath = path.join('/tmp', filename);
    
    console.log(`📥 Downloading ${filename}...`);
    
    https.get(downloadUrl, (response) => {
      if (response.statusCode === 303 || response.statusCode === 302) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, async (redirectResponse) => {
            const chunks: Buffer[] = [];
            redirectResponse.on('data', (chunk) => chunks.push(chunk));
            redirectResponse.on('end', async () => {
              const buffer = Buffer.concat(chunks);
              await fs.writeFile(filePath, buffer);
              console.log(`✅ Downloaded ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
              resolve(filePath);
            });
          }).on('error', reject);
        }
      }
    }).on('error', reject);
  });
}

async function processWithMistralAPI(filePath: string) {
  console.log('\n🤖 Processing with Mistral OCR API...\n');
  
  try {
    // Step 1: Upload file
    console.log('📤 Uploading file to Mistral...');
    const formData = new FormData();
    const file = await fileFromPath(filePath);
    formData.set('file', file);
    formData.set('purpose', 'ocr');
    
    const uploadResponse = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      },
      body: formData as any
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${error}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log(`✅ File uploaded with ID: ${uploadResult.id}`);
    
    // Step 2: Get signed URL
    console.log('\n🔗 Getting signed URL...');
    const signedUrlResponse = await fetch(`https://api.mistral.ai/v1/files/${uploadResult.id}/url`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      }
    });
    
    if (!signedUrlResponse.ok) {
      const error = await signedUrlResponse.text();
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status} - ${error}`);
    }
    
    const signedUrlResult = await signedUrlResponse.json();
    console.log(`✅ Got signed URL`);
    
    // Step 3: Process with OCR
    console.log('\n🔍 Running OCR (this may take a moment)...');
    const ocrResponse = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          document_url: signedUrlResult.url
        },
        include_image_base64: false,
        pages: [0, 1, 2] // Process first 3 pages
      })
    });
    
    if (!ocrResponse.ok) {
      const error = await ocrResponse.text();
      throw new Error(`OCR failed: ${ocrResponse.status} - ${error}`);
    }
    
    const ocrResult = await ocrResponse.json();
    console.log(`✅ OCR completed successfully!\n`);
    
    // Display results
    console.log('📄 **OCR OUTPUT:**');
    console.log('═'.repeat(80));
    
    if (ocrResult.pages && ocrResult.pages.length > 0) {
      ocrResult.pages.forEach((page: any, index: number) => {
        console.log(`\n📑 PAGE ${index + 1}:`);
        console.log('─'.repeat(80));
        console.log(page.markdown || 'No text extracted');
        console.log('─'.repeat(80));
      });
      
      // Save full output to file
      const outputPath = path.join('/tmp', 'ocr-output.txt');
      const fullText = ocrResult.pages.map((p: any) => p.markdown || '').join('\n\n--- PAGE BREAK ---\n\n');
      await fs.writeFile(outputPath, fullText);
      console.log(`\n💾 Full OCR output saved to: ${outputPath}`);
      
      // Extract key information
      console.log('\n🔎 **KEY INFORMATION EXTRACTED:**');
      console.log('═'.repeat(80));
      
      const firstPageText = ocrResult.pages[0].markdown || '';
      
      // Try to find common contract elements
      const patterns = {
        'Solicitation Number': /(?:Solicitation|Contract|Number|#)[\s:]*([A-Z0-9\-]+)/i,
        'Title': /(?:Title|Subject)[\s:]*(.+?)(?:\n|$)/i,
        'Due Date': /(?:Due|Deadline|Response).*?Date[\s:]*(.+?)(?:\n|$)/i,
        'Contact': /(?:Contact|POC)[\s:]*(.+?)(?:\n|$)/i,
        'Email': /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
        'Phone': /(?:Phone|Tel)[\s:]*([0-9\-\(\)\s]+)/i,
      };
      
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = firstPageText.match(pattern);
        if (match) {
          console.log(`${key}: ${match[1].trim()}`);
        }
      }
      
      // Show document statistics
      console.log('\n📊 **DOCUMENT STATISTICS:**');
      console.log(`- Total pages processed: ${ocrResult.pages.length}`);
      console.log(`- Total characters extracted: ${fullText.length}`);
      console.log(`- Average characters per page: ${Math.round(fullText.length / ocrResult.pages.length)}`);
      
    } else {
      console.log('❌ No pages found in OCR response');
    }
    
    console.log('\n═'.repeat(80));
    
    return ocrResult;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function main() {
  console.log('🔍 SAM.gov Attachment OCR Output Demo\n');
  console.log(`Document: ${ATTACHMENT.title}`);
  console.log(`Notice ID: ${ATTACHMENT.noticeId}\n`);
  
  try {
    // Download the attachment
    const filename = `${ATTACHMENT.noticeId}.pdf`;
    const filePath = await downloadFile(ATTACHMENT.url, filename);
    
    // Process with Mistral OCR
    await processWithMistralAPI(filePath);
    
    console.log('\n✨ Demo completed! Check the output above to see the actual OCR results.');
    
    // Clean up
    await fs.unlink(filePath);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run the demo
main().catch(console.error);
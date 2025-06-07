#!/usr/bin/env node

// Process a real SAM.gov attachment with Mistral Document AI
import { config } from 'dotenv';
import { Mistral } from '@mistralai/mistralai';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';

config();

const SAM_API_KEY = process.env.SAM_GOV_API_KEY || 'vbPavNF4VAfrN74MXma3M08Bce4wStctxNWFPpZH';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'kHrG0LTUXGCXLUKF5M9mZVBbpJjWmKhF';

// Example attachment from a real opportunity
const EXAMPLE_ATTACHMENT = {
  noticeId: 'fc501bac454d4059acaaf6f2616444ed',
  title: 'Surgical Booms and Light Upgrades',
  url: 'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/7ccbe8a90ef645b987c289d0353e7da4/download'
};

async function downloadAttachment(url: string, filename: string): Promise<string> {
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
              console.log(`✅ Downloaded ${filename} (${buffer.length} bytes)`);
              resolve(filePath);
            });
          }).on('error', reject);
        }
      } else {
        // Direct download
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          await fs.writeFile(filePath, buffer);
          console.log(`✅ Downloaded ${filename} (${buffer.length} bytes)`);
          resolve(filePath);
        });
      }
    }).on('error', reject);
  });
}

async function processWithMistral(filePath: string) {
  console.log('\n🤖 Processing with Mistral Document AI...');
  
  const client = new Mistral({ apiKey: MISTRAL_API_KEY });
  
  try {
    // Read the file
    const fileContent = await fs.readFile(filePath);
    
    // Upload to Mistral
    console.log('📤 Uploading to Mistral...');
    const uploadedFile = await client.files.upload({
      file: {
        fileName: path.basename(filePath),
        content: fileContent,
      } as any,
      purpose: 'ocr'
    });
    
    console.log(`✅ Uploaded with ID: ${uploadedFile.id}`);
    
    // Get signed URL
    const signedUrl = await client.files.getSignedUrl({
      fileId: uploadedFile.id
    });
    
    // Process with OCR
    console.log('🔍 Running OCR...');
    const ocrResponse = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: signedUrl.url
      },
      includeImageBase64: false,
      pages: [0, 1, 2] // Process first 3 pages
    });
    
    // Extract text
    if (ocrResponse.pages && ocrResponse.pages.length > 0) {
      console.log(`✅ OCR completed! Processed ${ocrResponse.pages.length} pages`);
      
      const firstPageText = ocrResponse.pages[0].markdown || '';
      console.log('\n📄 First Page Preview:');
      console.log('=' . repeat(50));
      console.log(firstPageText.substring(0, 500) + '...');
      console.log('=' . repeat(50));
      
      // Analyze the document
      console.log('\n🧠 Analyzing document structure...');
      const analysisMessages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: `Analyze this government contract and extract:
1. Contract/Solicitation Number
2. Agency Name
3. Title/Description
4. Important Dates (posted, deadline, etc.)
5. Contract Type
6. Any medical/healthcare related requirements
7. Key submission requirements

Return as JSON format.`
            },
            {
              type: 'document_url' as const,
              documentUrl: signedUrl.url
            }
          ]
        }
      ];
      
      const analysisResponse = await client.chat.complete({
        model: 'mistral-small-latest',
        messages: analysisMessages,
        responseFormat: { type: 'json_object' }
      });
      
      if (analysisResponse.choices?.[0]?.message?.content) {
        const analysis = JSON.parse(analysisResponse.choices[0].message.content);
        console.log('\n📊 Document Analysis:');
        console.log(JSON.stringify(analysis, null, 2));
      }
      
      // Check medical relevance
      console.log('\n🏥 Checking medical relevance...');
      const relevanceMessages = [
        {
          role: 'user' as const,
          content: `Based on this document, determine:
1. Is this related to medical/healthcare supplies or services? (yes/no)
2. What specific medical items or services are mentioned?
3. Relevance score for medical suppliers (0-100)
4. Brief recommendation for medical suppliers

Return as JSON.`
        },
        {
          role: 'assistant' as const,
          content: `I'll analyze the document for medical relevance.`
        },
        {
          role: 'user' as const,
          content: firstPageText.substring(0, 4000) // Use first 4000 chars
        }
      ];
      
      const relevanceResponse = await client.chat.complete({
        model: 'mistral-small-latest',
        messages: relevanceMessages,
        responseFormat: { type: 'json_object' }
      });
      
      if (relevanceResponse.choices?.[0]?.message?.content) {
        const relevance = JSON.parse(relevanceResponse.choices[0].message.content);
        console.log('\n🏥 Medical Relevance Analysis:');
        console.log(JSON.stringify(relevance, null, 2));
      }
      
      return {
        success: true,
        pageCount: ocrResponse.pages.length,
        firstPageText,
        fileId: uploadedFile.id
      };
    } else {
      console.log('❌ No pages found in OCR response');
      return { success: false, error: 'No pages processed' };
    }
    
  } catch (error) {
    console.error('❌ Error processing with Mistral:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  console.log('🚀 SAM.gov Attachment Processing Demo\n');
  console.log(`Processing: ${EXAMPLE_ATTACHMENT.title}`);
  console.log(`Notice ID: ${EXAMPLE_ATTACHMENT.noticeId}\n`);
  
  try {
    // Download the attachment
    const filename = `${EXAMPLE_ATTACHMENT.noticeId}.pdf`;
    const filePath = await downloadAttachment(EXAMPLE_ATTACHMENT.url, filename);
    
    // Process with Mistral
    const result = await processWithMistral(filePath);
    
    if (result.success) {
      console.log('\n✨ Processing completed successfully!');
      console.log(`- Pages processed: ${result.pageCount}`);
      console.log(`- File ID: ${result.fileId}`);
      
      // Clean up
      await fs.unlink(filePath);
      console.log('🧹 Cleaned up temporary file');
    } else {
      console.log('\n❌ Processing failed:', result.error);
    }
    
    console.log('\n📝 Summary:');
    console.log('This demo shows the complete workflow:');
    console.log('1. ✅ Download attachment from SAM.gov');
    console.log('2. ✅ Upload to Mistral');
    console.log('3. ✅ Process with OCR');
    console.log('4. ✅ Extract structured data');
    console.log('5. ✅ Analyze medical relevance');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the demo
main().catch(console.error);
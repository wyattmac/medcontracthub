#!/usr/bin/env node

// Standalone test for SAM.gov attachment processing
// This test can run independently without full app configuration

import { config } from 'dotenv';
import https from 'https';
import { Mistral } from '@mistralai/mistralai';

// Load environment variables
config();

// Simple logger that doesn't depend on app infrastructure
const log = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  success: (...args: any[]) => console.log('✅', ...args),
  warn: (...args: any[]) => console.log('⚠️', ...args)
};

// Minimal SAM.gov attachment extractor
class SimpleSamGovExtractor {
  constructor(private apiKey: string) {}

  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.sam.gov',
        path: `/opportunities/v2/search?api_key=${this.apiKey}&limit=1&postedFrom=01/01/2025&postedTo=01/31/2025`,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            log.success(`SAM.gov API connection successful! Found ${json.totalRecords || 0} opportunities`);
            resolve(true);
          } else {
            log.error(`SAM.gov API error: ${res.statusCode} - ${data}`);
            resolve(false);
          }
        });
      });

      req.on('error', (e) => {
        log.error(`SAM.gov connection error: ${e.message}`);
        resolve(false);
      });

      req.end();
    });
  }

  extractAttachmentUrls(opportunity: any): string[] {
    const urls: string[] = [];
    
    // Check resourceLinks field
    if (opportunity.resourceLinks && Array.isArray(opportunity.resourceLinks)) {
      urls.push(...opportunity.resourceLinks);
    }
    
    // Check links field
    if (opportunity.links && Array.isArray(opportunity.links)) {
      for (const link of opportunity.links) {
        if (link.rel === 'attachment' && link.href) {
          urls.push(link.href);
        }
      }
    }
    
    return urls;
  }
}

// Minimal Mistral OCR processor
class SimpleMistralProcessor {
  private client: Mistral;

  constructor(apiKey: string) {
    this.client = new Mistral({ apiKey });
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple chat completion
      const response = await this.client.chat.complete({
        model: 'mistral-small-latest',
        messages: [{
          role: 'user',
          content: 'Say "OCR test successful" if you can read this.'
        }]
      });

      const content = response.choices?.[0]?.message?.content;
      if (content && content.includes('OCR test successful')) {
        log.success('Mistral API connection successful!');
        return true;
      }
      return false;
    } catch (error) {
      log.error('Mistral API error:', error);
      return false;
    }
  }

  async processTextSample(): Promise<void> {
    const sampleContractText = `
    SOLICITATION NUMBER: VA-2025-MED-001
    TITLE: Medical Supplies and Equipment
    RESPONSE DEADLINE: February 15, 2025
    CONTACT EMAIL: contracts@va.gov
    ESTIMATED VALUE: $2,500,000
    
    The Department of Veterans Affairs is seeking vendors for medical supplies including:
    - Surgical instruments
    - Disposable medical supplies
    - Patient monitoring equipment
    
    Requirements:
    - FDA approval for all medical devices
    - ISO 13485 certification
    - Delivery within 30 days of order
    `;

    try {
      const response = await this.client.chat.complete({
        model: 'mistral-small-latest',
        messages: [{
          role: 'user',
          content: `Extract the following from this government contract:
          - Contract Number
          - Deadline
          - Contact Email
          - Total Value
          
          Return as JSON.
          
          Contract text:
          ${sampleContractText}`
        }],
        responseFormat: { type: 'json_object' }
      });

      const extracted = JSON.parse(response.choices?.[0]?.message?.content || '{}');
      log.success('Structured data extraction successful:', extracted);
    } catch (error) {
      log.error('Failed to extract structured data:', error);
    }
  }
}

// Main test function
async function runStandaloneTest() {
  console.log('🧪 SAM.gov Attachment Processing - Standalone Test\n');

  // Check environment variables
  const samApiKey = process.env.SAM_GOV_API_KEY;
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!samApiKey || !mistralApiKey) {
    log.error('Missing required environment variables:');
    if (!samApiKey) log.error('  - SAM_GOV_API_KEY');
    if (!mistralApiKey) log.error('  - MISTRAL_API_KEY');
    
    console.log('\nTo fix this:');
    console.log('1. Create a .env file in the project root');
    console.log('2. Add the following lines:');
    console.log('   SAM_GOV_API_KEY=your_sam_gov_api_key');
    console.log('   MISTRAL_API_KEY=your_mistral_api_key');
    return;
  }

  log.success('Environment variables loaded');

  // Test SAM.gov connection
  console.log('\n📡 Testing SAM.gov API Connection...');
  const samExtractor = new SimpleSamGovExtractor(samApiKey);
  const samConnected = await samExtractor.testConnection();

  if (samConnected) {
    // Show example of attachment URL extraction
    const exampleOpportunity = {
      noticeId: 'example-123',
      resourceLinks: [
        'https://sam.gov/api/prod/opps/v3/opportunities/attachments/example.pdf'
      ],
      links: [
        { rel: 'attachment', href: 'https://sam.gov/attachments/RFP-2025.pdf' }
      ]
    };
    
    const urls = samExtractor.extractAttachmentUrls(exampleOpportunity);
    log.info(`Example: Found ${urls.length} attachment URLs from opportunity`);
    urls.forEach((url, i) => log.info(`  ${i + 1}. ${url}`));
  }

  // Test Mistral connection
  console.log('\n🤖 Testing Mistral API Connection...');
  const mistralProcessor = new SimpleMistralProcessor(mistralApiKey);
  const mistralConnected = await mistralProcessor.testConnection();

  if (mistralConnected) {
    console.log('\n📄 Testing Structured Data Extraction...');
    await mistralProcessor.processTextSample();
  }

  // Summary
  console.log('\n\n📊 Test Summary:');
  console.log(`  ${samConnected ? '✅' : '❌'} SAM.gov API Connection`);
  console.log(`  ${mistralConnected ? '✅' : '❌'} Mistral API Connection`);
  
  if (samConnected && mistralConnected) {
    console.log('\n✨ All systems operational! Ready to process SAM.gov attachments.');
    console.log('\nNext steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Use the /api/sam-gov/attachments/process endpoint');
    console.log('3. Or integrate into the opportunity detail pages');
  } else {
    console.log('\n⚠️  Some systems are not operational. Please check the errors above.');
  }
}

// Run the test
runStandaloneTest().catch(console.error);
/**
 * Playwright script to extract requirements from RFQ/Contract documents
 * in MedContractHub opportunities
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = './extracted-requirements';
const CREDENTIALS = {
  email: process.env.TEST_EMAIL || 'test@medcontracthub.com',
  password: process.env.TEST_PASSWORD || 'testpassword123'
};

// Extracted data structure
interface ExtractedRequirement {
  opportunityId: string;
  opportunityName: string;
  documentType: 'RFQ' | 'Contract' | 'Amendment' | 'Other';
  documentName: string;
  extractedDate: string;
  requirements: {
    deliverables: string[];
    technicalSpecs: string[];
    compliance: string[];
    timeline: string[];
    budget: string[];
    performance: string[];
    specialTerms: string[];
  };
  rawText?: string;
}

// Helper function to ensure output directory exists
function ensureOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Helper function to save results
function saveResults(results: ExtractedRequirement[], format: 'json' | 'csv' = 'json') {
  ensureOutputDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (format === 'json') {
    const filename = path.join(OUTPUT_DIR, `requirements-${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${filename}`);
  } else {
    const filename = path.join(OUTPUT_DIR, `requirements-${timestamp}.csv`);
    const csv = convertToCSV(results);
    fs.writeFileSync(filename, csv);
    console.log(`Results saved to: ${filename}`);
  }
}

// Convert results to CSV format
function convertToCSV(results: ExtractedRequirement[]): string {
  const headers = [
    'Opportunity ID',
    'Opportunity Name',
    'Document Type',
    'Document Name',
    'Extracted Date',
    'Deliverables',
    'Technical Specs',
    'Compliance',
    'Timeline',
    'Budget',
    'Performance',
    'Special Terms'
  ];
  
  const rows = results.map(r => [
    r.opportunityId,
    r.opportunityName,
    r.documentType,
    r.documentName,
    r.extractedDate,
    r.requirements.deliverables.join('; '),
    r.requirements.technicalSpecs.join('; '),
    r.requirements.compliance.join('; '),
    r.requirements.timeline.join('; '),
    r.requirements.budget.join('; '),
    r.requirements.performance.join('; '),
    r.requirements.specialTerms.join('; ')
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

// Login helper
async function login(page: Page) {
  await page.goto(BASE_URL);
  
  // Check if already logged in
  const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
  if (isLoggedIn) {
    console.log('Already logged in');
    return;
  }
  
  // Perform login
  await page.click('[data-testid="login-button"]');
  await page.fill('[data-testid="email-input"]', CREDENTIALS.email);
  await page.fill('[data-testid="password-input"]', CREDENTIALS.password);
  await page.click('[data-testid="submit-login"]');
  
  // Wait for login to complete
  await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
  console.log('Login successful');
}

// Navigate to opportunities page
async function navigateToOpportunities(page: Page) {
  // Try multiple possible selectors
  const navigationSelectors = [
    '[data-testid="opportunities-nav"]',
    'a[href="/opportunities"]',
    'text=Opportunities',
    'nav >> text=Opportunities'
  ];
  
  for (const selector of navigationSelectors) {
    const element = await page.locator(selector).first();
    if (await element.isVisible().catch(() => false)) {
      await element.click();
      break;
    }
  }
  
  // Wait for opportunities to load
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="opportunity-card"], .opportunity-item, [class*="opportunity"]', { 
    timeout: 15000 
  });
}

// Extract requirements from document text
function extractRequirements(text: string): ExtractedRequirement['requirements'] {
  const requirements = {
    deliverables: [] as string[],
    technicalSpecs: [] as string[],
    compliance: [] as string[],
    timeline: [] as string[],
    budget: [] as string[],
    performance: [] as string[],
    specialTerms: [] as string[]
  };
  
  // Deliverables and milestones patterns
  const deliverablePatterns = [
    /deliverable[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /milestone[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /scope of work:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /task[s]? to be performed:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ];
  
  // Technical specifications patterns
  const techSpecPatterns = [
    /technical requirement[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /specification[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /technical specification[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /system requirement[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ];
  
  // Compliance patterns
  const compliancePatterns = [
    /compliance requirement[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /regulatory requirement[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /certification[s]? required:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /FAR\s+\d+\.\d+[^\n]*/gi,
    /DFARS\s+\d+\.\d+[^\n]*/gi
  ];
  
  // Timeline patterns
  const timelinePatterns = [
    /timeline:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /deadline[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /period of performance:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /due date[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /delivery schedule:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ];
  
  // Budget patterns
  const budgetPatterns = [
    /budget:?\s*\$?[\d,]+(?:\.\d{2})?/gi,
    /estimated cost:?\s*\$?[\d,]+(?:\.\d{2})?/gi,
    /not to exceed:?\s*\$?[\d,]+(?:\.\d{2})?/gi,
    /funding limit[s]?:?\s*([^\n]+)/gi,
    /cost constraint[s]?:?\s*([^\n]+)/gi
  ];
  
  // Performance patterns
  const performancePatterns = [
    /performance criteria:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /performance metric[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /acceptance criteria:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /quality standard[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ];
  
  // Special terms patterns
  const specialTermsPatterns = [
    /special term[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /special condition[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /additional requirement[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /note[s]?:?\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ];
  
  // Extract requirements using patterns
  const extractWithPatterns = (patterns: RegExp[], targetArray: string[]) => {
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const extracted = match[1] || match[0];
        const cleaned = extracted
          .trim()
          .replace(/\s+/g, ' ')
          .substring(0, 500); // Limit length
        
        if (cleaned.length > 10 && !targetArray.includes(cleaned)) {
          targetArray.push(cleaned);
        }
      }
    });
  };
  
  extractWithPatterns(deliverablePatterns, requirements.deliverables);
  extractWithPatterns(techSpecPatterns, requirements.technicalSpecs);
  extractWithPatterns(compliancePatterns, requirements.compliance);
  extractWithPatterns(timelinePatterns, requirements.timeline);
  extractWithPatterns(budgetPatterns, requirements.budget);
  extractWithPatterns(performancePatterns, requirements.performance);
  extractWithPatterns(specialTermsPatterns, requirements.specialTerms);
  
  return requirements;
}

// Determine document type from filename or content
function determineDocumentType(filename: string, content?: string): ExtractedRequirement['documentType'] {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = content?.toLowerCase() || '';
  
  if (lowerFilename.includes('rfq') || lowerContent.includes('request for quotation')) {
    return 'RFQ';
  } else if (lowerFilename.includes('contract') || lowerContent.includes('contract number')) {
    return 'Contract';
  } else if (lowerFilename.includes('amendment') || lowerContent.includes('modification')) {
    return 'Amendment';
  }
  
  return 'Other';
}

// Main test
test.describe('Extract Requirements from Opportunities', () => {
  test('Extract requirements from all available documents', async ({ page }) => {
    // Set longer timeout for this comprehensive test
    test.setTimeout(300000); // 5 minutes
    
    const extractedData: ExtractedRequirement[] = [];
    
    try {
      // Login
      await login(page);
      
      // Navigate to opportunities
      await navigateToOpportunities(page);
      
      // Get all opportunity cards
      const opportunitySelectors = [
        '[data-testid="opportunity-card"]',
        '.opportunity-card',
        '[class*="opportunity-item"]',
        'article[class*="opportunity"]'
      ];
      
      let opportunities;
      for (const selector of opportunitySelectors) {
        opportunities = await page.locator(selector).all();
        if (opportunities.length > 0) break;
      }
      
      console.log(`Found ${opportunities?.length || 0} opportunities to process`);
      
      if (!opportunities || opportunities.length === 0) {
        console.warn('No opportunities found');
        return;
      }
      
      // Process each opportunity
      for (let i = 0; i < Math.min(opportunities.length, 10); i++) { // Limit to 10 for demo
        try {
          console.log(`Processing opportunity ${i + 1}/${opportunities.length}`);
          
          // Click on the opportunity
          await opportunities[i].click();
          await page.waitForLoadState('networkidle');
          
          // Extract opportunity info
          const opportunityId = await page.locator('[data-testid="opportunity-id"], .opportunity-id, [class*="notice-id"]')
            .textContent()
            .catch(() => `OPP-${Date.now()}`);
          
          const opportunityName = await page.locator('[data-testid="opportunity-title"], h1, .opportunity-title')
            .textContent()
            .catch(() => 'Unknown Opportunity');
          
          console.log(`Processing: ${opportunityName} (${opportunityId})`);
          
          // Look for document links
          const documentSelectors = [
            '[data-testid="document-link"]',
            'a[href*="document"]',
            'a[href*=".pdf"]',
            '.document-link',
            '[class*="attachment"]'
          ];
          
          let documentLinks;
          for (const selector of documentSelectors) {
            documentLinks = await page.locator(selector).all();
            if (documentLinks.length > 0) break;
          }
          
          if (!documentLinks || documentLinks.length === 0) {
            console.log('No documents found for this opportunity');
            await page.goBack();
            continue;
          }
          
          // Process each document
          for (const docLink of documentLinks) {
            try {
              const documentName = await docLink.textContent() || 'Unknown Document';
              console.log(`  Processing document: ${documentName}`);
              
              // Click document link
              await docLink.click();
              
              // Wait for document to load or process
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(2000); // Give OCR time to process
              
              // Extract text from various possible containers
              let documentText = '';
              const textSelectors = [
                '[data-testid="document-content"]',
                '.document-viewer',
                '.ocr-result',
                '[class*="document-text"]',
                'main',
                'article'
              ];
              
              for (const selector of textSelectors) {
                const element = await page.locator(selector).first();
                if (await element.isVisible().catch(() => false)) {
                  documentText = await element.textContent() || '';
                  if (documentText.length > 100) break;
                }
              }
              
              // If no text found, check if it's a PDF viewer
              if (documentText.length < 100) {
                const pdfViewer = await page.locator('iframe[src*="pdf"], embed[type*="pdf"]').first();
                if (await pdfViewer.isVisible().catch(() => false)) {
                  console.log('  PDF viewer detected - would need OCR processing');
                  // In production, you'd trigger OCR here
                }
              }
              
              // Extract requirements
              const requirements = extractRequirements(documentText);
              const documentType = determineDocumentType(documentName, documentText);
              
              // Create extracted data entry
              const extractedEntry: ExtractedRequirement = {
                opportunityId: opportunityId || '',
                opportunityName: opportunityName || '',
                documentType,
                documentName,
                extractedDate: new Date().toISOString(),
                requirements,
                rawText: documentText.substring(0, 1000) // Store first 1000 chars for reference
              };
              
              extractedData.push(extractedEntry);
              
              // Go back to opportunity details
              await page.goBack();
              await page.waitForLoadState('networkidle');
              
            } catch (docError) {
              console.error(`  Error processing document: ${docError}`);
              // Try to recover by going back
              await page.goBack().catch(() => {});
            }
          }
          
          // Go back to opportunities list
          await page.goBack();
          await page.waitForLoadState('networkidle');
          
          // Re-get opportunities list as DOM may have changed
          opportunities = await page.locator(opportunitySelectors[0]).all();
          
        } catch (oppError) {
          console.error(`Error processing opportunity: ${oppError}`);
          // Try to recover by navigating back to opportunities
          await navigateToOpportunities(page).catch(() => {});
        }
      }
      
      // Save results
      if (extractedData.length > 0) {
        saveResults(extractedData, 'json');
        saveResults(extractedData, 'csv');
        
        // Print summary
        console.log('\n=== Extraction Summary ===');
        console.log(`Total opportunities processed: ${extractedData.length}`);
        console.log(`Documents by type:`);
        const typeCounts = extractedData.reduce((acc, item) => {
          acc[item.documentType] = (acc[item.documentType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(typeCounts).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
        
        console.log('\nRequirements extracted:');
        const reqCounts = {
          deliverables: 0,
          technicalSpecs: 0,
          compliance: 0,
          timeline: 0,
          budget: 0,
          performance: 0,
          specialTerms: 0
        };
        
        extractedData.forEach(item => {
          Object.keys(reqCounts).forEach(key => {
            reqCounts[key as keyof typeof reqCounts] += item.requirements[key as keyof typeof item.requirements].length;
          });
        });
        
        Object.entries(reqCounts).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      } else {
        console.log('No data extracted');
      }
      
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
  
  // Test for processing a single opportunity (useful for debugging)
  test('Extract requirements from a specific opportunity', async ({ page }) => {
    test.skip(); // Skip by default, enable when needed
    
    const SPECIFIC_OPPORTUNITY_ID = 'YOUR-OPPORTUNITY-ID';
    
    await login(page);
    
    // Navigate directly to the opportunity
    await page.goto(`${BASE_URL}/opportunities/${SPECIFIC_OPPORTUNITY_ID}`);
    await page.waitForLoadState('networkidle');
    
    // Process documents (same logic as above)
    // ... implementation ...
  });
});

// Standalone script version (can be run outside of Playwright test)
export async function extractRequirementsStandalone() {
  const { chromium } = require('playwright');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Use the same logic as in the test
    await login(page);
    await navigateToOpportunities(page);
    // ... rest of the extraction logic
    
  } finally {
    await browser.close();
  }
}

// Allow running as a script
if (require.main === module) {
  extractRequirementsStandalone().catch(console.error);
}
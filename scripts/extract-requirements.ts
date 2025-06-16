#!/usr/bin/env ts-node

/**
 * Standalone script to extract requirements from MedContractHub opportunities
 * Can be run daily via cron or scheduled tasks
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  outputDir: process.env.OUTPUT_DIR || './extracted-requirements',
  credentials: {
    email: process.env.EXTRACT_EMAIL || process.env.TEST_EMAIL || 'test@medcontracthub.com',
    password: process.env.EXTRACT_PASSWORD || process.env.TEST_PASSWORD || 'testpassword123'
  },
  headless: process.env.HEADLESS !== 'false',
  maxOpportunities: parseInt(process.env.MAX_OPPORTUNITIES || '50'),
  screenshotOnError: process.env.SCREENSHOT_ON_ERROR === 'true'
};

// Requirement extraction patterns
const EXTRACTION_PATTERNS = {
  deliverables: [
    /deliverable[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /milestone[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /(\d+\.\s*[A-Z][^.]+deliverable[^.]+\.)/g,
    /work\s*product[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ],
  technicalSpecs: [
    /technical\s*requirement[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /specification[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /(\d+\.\s*[A-Z][^.]+technical[^.]+\.)/g,
    /equipment\s*requirement[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ],
  compliance: [
    /compliance\s*requirement[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /regulatory\s*requirement[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /(FAR\s+\d+\.\d+[^\n]*)/gi,
    /(DFARS\s+\d+\.\d+[^\n]*)/gi,
    /certification[s]?\s*required\s*[:：]\s*([^\n]+)/gi
  ],
  timeline: [
    /timeline\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /deadline[s]?\s*[:：]\s*([^\n]+)/gi,
    /period\s*of\s*performance\s*[:：]\s*([^\n]+)/gi,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[^.]*delivery[^.]+\.)/gi,
    /due\s*date[s]?\s*[:：]\s*([^\n]+)/gi
  ],
  budget: [
    /budget\s*[:：]\s*(\$?[\d,]+(?:\.\d{2})?[^\n]*)/gi,
    /estimated\s*cost\s*[:：]\s*(\$?[\d,]+(?:\.\d{2})?[^\n]*)/gi,
    /not\s*to\s*exceed\s*[:：]?\s*(\$?[\d,]+(?:\.\d{2})?)/gi,
    /total\s*value\s*[:：]\s*(\$?[\d,]+(?:\.\d{2})?[^\n]*)/gi
  ],
  performance: [
    /performance\s*criteria\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /acceptance\s*criteria\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /quality\s*standard[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /KPI[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ],
  specialTerms: [
    /special\s*term[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /special\s*condition[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /additional\s*requirement[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi,
    /note[s]?\s*[:：]\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/gi
  ]
};

interface ExtractedRequirement {
  opportunityId: string;
  opportunityName: string;
  documentType: 'RFQ' | 'Contract' | 'Amendment' | 'Other';
  documentName: string;
  documentUrl?: string;
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
  metadata?: {
    processingTime: number;
    textLength: number;
    extractionMethod: string;
  };
}

class RequirementsExtractor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private results: ExtractedRequirement[] = [];
  
  async initialize() {
    console.log('Initializing browser...');
    this.browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    this.page = await context.newPage();
    
    // Set up console message logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
  }
  
  async login() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('Logging in...');
    await this.page.goto(config.baseUrl);
    
    // Check if already logged in
    const isLoggedIn = await this.page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
    if (isLoggedIn) {
      console.log('Already logged in');
      return;
    }
    
    // Perform login
    await this.page.click('[data-testid="login-button"]');
    await this.page.fill('[data-testid="email-input"]', config.credentials.email);
    await this.page.fill('[data-testid="password-input"]', config.credentials.password);
    await this.page.click('[data-testid="submit-login"]');
    
    // Wait for login to complete
    await this.page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });
    console.log('Login successful');
  }
  
  async navigateToOpportunities() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('Navigating to opportunities...');
    
    // Try multiple navigation methods
    const success = await this.page.locator('[data-testid="opportunities-nav"]').click()
      .catch(() => this.page!.locator('a[href="/opportunities"]').click())
      .catch(() => this.page!.locator('text=Opportunities').first().click())
      .catch(() => false);
    
    if (!success) {
      // Direct navigation as fallback
      await this.page.goto(`${config.baseUrl}/opportunities`);
    }
    
    await this.page.waitForLoadState('networkidle');
  }
  
  async extractOpportunities() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('Finding opportunities...');
    
    // Wait for opportunities to load
    await this.page.waitForSelector('[data-testid="opportunity-card"], .opportunity-card', {
      timeout: 30000
    });
    
    // Get all opportunity elements
    const opportunities = await this.page.locator('[data-testid="opportunity-card"], .opportunity-card').all();
    console.log(`Found ${opportunities.length} opportunities`);
    
    const maxToProcess = Math.min(opportunities.length, config.maxOpportunities);
    
    for (let i = 0; i < maxToProcess; i++) {
      try {
        console.log(`\nProcessing opportunity ${i + 1}/${maxToProcess}`);
        
        // Get opportunity details before clicking
        const opportunityText = await opportunities[i].textContent() || '';
        
        // Click opportunity
        await opportunities[i].click();
        await this.page.waitForLoadState('networkidle');
        
        // Extract opportunity details
        const opportunityId = await this.extractText([
          '[data-testid="opportunity-id"]',
          '.opportunity-id',
          '[class*="notice-id"]'
        ]) || `OPP-${Date.now()}-${i}`;
        
        const opportunityName = await this.extractText([
          '[data-testid="opportunity-title"]',
          'h1',
          '.opportunity-title'
        ]) || opportunityText.substring(0, 100);
        
        console.log(`  ID: ${opportunityId}`);
        console.log(`  Name: ${opportunityName}`);
        
        // Process documents
        await this.processOpportunityDocuments(opportunityId, opportunityName);
        
        // Go back to opportunities list
        await this.page.goBack();
        await this.page.waitForLoadState('networkidle');
        
        // Re-get opportunities as DOM may have changed
        opportunities.splice(0, opportunities.length, 
          ...(await this.page.locator('[data-testid="opportunity-card"], .opportunity-card').all())
        );
        
      } catch (error) {
        console.error(`Error processing opportunity ${i + 1}:`, error);
        
        if (config.screenshotOnError) {
          await this.page.screenshot({ 
            path: path.join(config.outputDir, `error-opp-${i}-${Date.now()}.png`) 
          });
        }
        
        // Try to recover
        await this.navigateToOpportunities().catch(() => {});
      }
    }
  }
  
  async processOpportunityDocuments(opportunityId: string, opportunityName: string) {
    if (!this.page) throw new Error('Page not initialized');
    
    // Find document links
    const documentLinks = await this.page.locator(
      '[data-testid="document-link"], a[href*="document"], a[href*=".pdf"], .document-link'
    ).all();
    
    console.log(`  Found ${documentLinks.length} documents`);
    
    for (let j = 0; j < documentLinks.length; j++) {
      try {
        const startTime = Date.now();
        const documentName = await documentLinks[j].textContent() || `Document ${j + 1}`;
        const documentUrl = await documentLinks[j].getAttribute('href') || '';
        
        console.log(`    Processing: ${documentName}`);
        
        // Click document
        await documentLinks[j].click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(2000); // Allow time for rendering
        
        // Extract document text
        const documentText = await this.extractDocumentText();
        
        if (documentText.length > 100) {
          // Extract requirements
          const requirements = this.extractRequirements(documentText);
          const documentType = this.determineDocumentType(documentName, documentText);
          
          // Create result entry
          const result: ExtractedRequirement = {
            opportunityId,
            opportunityName,
            documentType,
            documentName,
            documentUrl: documentUrl.startsWith('http') ? documentUrl : `${config.baseUrl}${documentUrl}`,
            extractedDate: new Date().toISOString(),
            requirements,
            metadata: {
              processingTime: Date.now() - startTime,
              textLength: documentText.length,
              extractionMethod: 'pattern-matching'
            }
          };
          
          this.results.push(result);
          console.log(`      ✓ Extracted ${Object.values(requirements).flat().length} requirements`);
        } else {
          console.log(`      ⚠ Insufficient text extracted (${documentText.length} chars)`);
        }
        
        // Go back to opportunity
        await this.page.goBack();
        await this.page.waitForLoadState('networkidle');
        
      } catch (error) {
        console.error(`    Error processing document ${j + 1}:`, error);
        await this.page.goBack().catch(() => {});
      }
    }
  }
  
  async extractDocumentText(): Promise<string> {
    if (!this.page) return '';
    
    // Try multiple selectors for document content
    const contentSelectors = [
      '[data-testid="document-content"]',
      '.document-viewer',
      '.ocr-result',
      '[class*="document-text"]',
      '.prose',
      'article',
      'main'
    ];
    
    for (const selector of contentSelectors) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible()) {
          const text = await element.textContent();
          if (text && text.length > 100) {
            return text;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Fallback: get all text from body
    return await this.page.locator('body').textContent() || '';
  }
  
  async extractText(selectors: string[]): Promise<string | null> {
    if (!this.page) return null;
    
    for (const selector of selectors) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible()) {
          return await element.textContent();
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    return null;
  }
  
  extractRequirements(text: string): ExtractedRequirement['requirements'] {
    const requirements: ExtractedRequirement['requirements'] = {
      deliverables: [],
      technicalSpecs: [],
      compliance: [],
      timeline: [],
      budget: [],
      performance: [],
      specialTerms: []
    };
    
    // Process each category
    Object.entries(EXTRACTION_PATTERNS).forEach(([category, patterns]) => {
      const extracted = new Set<string>();
      
      patterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern);
        while ((match = regex.exec(text)) !== null) {
          const value = (match[1] || match[0])
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 500);
          
          if (value.length > 15) {
            extracted.add(value);
          }
        }
      });
      
      requirements[category as keyof typeof requirements] = Array.from(extracted);
    });
    
    return requirements;
  }
  
  determineDocumentType(filename: string, content: string): ExtractedRequirement['documentType'] {
    const lower = (filename + ' ' + content).toLowerCase();
    
    if (lower.includes('request for quotation') || lower.includes('rfq')) {
      return 'RFQ';
    } else if (lower.includes('contract') && !lower.includes('contractor')) {
      return 'Contract';
    } else if (lower.includes('amendment') || lower.includes('modification')) {
      return 'Amendment';
    }
    
    return 'Other';
  }
  
  async saveResults() {
    // Ensure output directory exists
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON
    const jsonPath = path.join(config.outputDir, `requirements-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    console.log(`\nJSON results saved to: ${jsonPath}`);
    
    // Save CSV
    const csvPath = path.join(config.outputDir, `requirements-${timestamp}.csv`);
    const csv = this.convertToCSV();
    fs.writeFileSync(csvPath, csv);
    console.log(`CSV results saved to: ${csvPath}`);
    
    // Save summary
    const summaryPath = path.join(config.outputDir, `summary-${timestamp}.txt`);
    const summary = this.generateSummary();
    fs.writeFileSync(summaryPath, summary);
    console.log(`Summary saved to: ${summaryPath}`);
  }
  
  convertToCSV(): string {
    const headers = [
      'Opportunity ID',
      'Opportunity Name',
      'Document Type',
      'Document Name',
      'Document URL',
      'Extracted Date',
      'Deliverables Count',
      'Technical Specs Count',
      'Compliance Count',
      'Timeline Count',
      'Budget Count',
      'Performance Count',
      'Special Terms Count',
      'Processing Time (ms)',
      'Sample Deliverable',
      'Sample Technical Spec',
      'Sample Compliance'
    ];
    
    const rows = this.results.map(r => [
      r.opportunityId,
      r.opportunityName,
      r.documentType,
      r.documentName,
      r.documentUrl || '',
      r.extractedDate,
      r.requirements.deliverables.length.toString(),
      r.requirements.technicalSpecs.length.toString(),
      r.requirements.compliance.length.toString(),
      r.requirements.timeline.length.toString(),
      r.requirements.budget.length.toString(),
      r.requirements.performance.length.toString(),
      r.requirements.specialTerms.length.toString(),
      r.metadata?.processingTime.toString() || '',
      r.requirements.deliverables[0] || '',
      r.requirements.technicalSpecs[0] || '',
      r.requirements.compliance[0] || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }
  
  generateSummary(): string {
    const totalRequirements = this.results.reduce((sum, r) => 
      sum + Object.values(r.requirements).flat().length, 0
    );
    
    const byType = this.results.reduce((acc, r) => {
      acc[r.documentType] = (acc[r.documentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const requirementCounts = {
      deliverables: 0,
      technicalSpecs: 0,
      compliance: 0,
      timeline: 0,
      budget: 0,
      performance: 0,
      specialTerms: 0
    };
    
    this.results.forEach(r => {
      Object.entries(r.requirements).forEach(([key, values]) => {
        requirementCounts[key as keyof typeof requirementCounts] += values.length;
      });
    });
    
    return `
Requirements Extraction Summary
==============================
Extraction Date: ${new Date().toISOString()}
Total Documents Processed: ${this.results.length}
Total Requirements Extracted: ${totalRequirements}

Documents by Type:
${Object.entries(byType).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

Requirements by Category:
${Object.entries(requirementCounts).map(([cat, count]) => `  ${cat}: ${count}`).join('\n')}

Top Opportunities by Requirements:
${this.results
  .sort((a, b) => Object.values(b.requirements).flat().length - Object.values(a.requirements).flat().length)
  .slice(0, 5)
  .map(r => `  ${r.opportunityName}: ${Object.values(r.requirements).flat().length} requirements`)
  .join('\n')}
`;
  }
  
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
  
  async run() {
    try {
      await this.initialize();
      await this.login();
      await this.navigateToOpportunities();
      await this.extractOpportunities();
      await this.saveResults();
      
      console.log('\n✅ Extraction completed successfully!');
      console.log(`Total documents processed: ${this.results.length}`);
      console.log(`Total requirements extracted: ${
        this.results.reduce((sum, r) => sum + Object.values(r.requirements).flat().length, 0)
      }`);
      
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
if (require.main === module) {
  const extractor = new RequirementsExtractor();
  extractor.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { RequirementsExtractor, ExtractedRequirement };
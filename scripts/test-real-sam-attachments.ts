#!/usr/bin/env node

// Test with real SAM.gov data to find opportunities with attachments
import { config } from 'dotenv';
import https from 'https';

config();

const SAM_API_KEY = process.env.SAM_GOV_API_KEY || 'vbPavNF4VAfrN74MXma3M08Bce4wStctxNWFPpZH';

interface SamOpportunity {
  noticeId: string;
  title: string;
  resourceLinks?: string[];
  links?: Array<{ rel: string; href: string; title?: string }>;
  postedDate: string;
  responseDeadline?: string;
}

async function fetchSamOpportunities(): Promise<SamOpportunity[]> {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const postedFrom = `${(lastWeek.getMonth() + 1).toString().padStart(2, '0')}/${lastWeek.getDate().toString().padStart(2, '0')}/${lastWeek.getFullYear()}`;
    const postedTo = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
    
    const params = new URLSearchParams({
      api_key: SAM_API_KEY,
      postedFrom,
      postedTo,
      limit: '100',
      naicsCode: '339112' // Surgical and Medical Instrument Manufacturing
    });

    const options = {
      hostname: 'api.sam.gov',
      path: `/opportunities/v2/search?${params}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    console.log(`🔍 Fetching opportunities from ${postedFrom} to ${postedTo}...`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            const opportunities = json.opportunitiesData || [];
            resolve(opportunities);
          } catch (e) {
            reject(e);
          }
        } else {
          console.error(`API Error: ${res.statusCode}`);
          console.error(data);
          reject(new Error(`API returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function findOpportunitiesWithAttachments() {
  console.log('🧪 Finding SAM.gov Opportunities with Attachments\n');

  try {
    const opportunities = await fetchSamOpportunities();
    console.log(`✅ Found ${opportunities.length} medical opportunities\n`);

    const opportunitiesWithAttachments = opportunities.filter(opp => {
      const hasResourceLinks = opp.resourceLinks && opp.resourceLinks.length > 0;
      const hasAttachmentLinks = opp.links && opp.links.some(link => link.rel === 'attachment');
      return hasResourceLinks || hasAttachmentLinks;
    });

    console.log(`📎 ${opportunitiesWithAttachments.length} opportunities have attachments:\n`);

    // Show first 5 opportunities with attachments
    opportunitiesWithAttachments.slice(0, 5).forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.title}`);
      console.log(`   Notice ID: ${opp.noticeId}`);
      console.log(`   Posted: ${new Date(opp.postedDate).toLocaleDateString()}`);
      
      if (opp.responseDeadline) {
        console.log(`   Deadline: ${new Date(opp.responseDeadline).toLocaleDateString()}`);
      }

      if (opp.resourceLinks) {
        console.log(`   Resource Links (${opp.resourceLinks.length}):`);
        opp.resourceLinks.slice(0, 3).forEach(link => {
          console.log(`   - ${link}`);
        });
      }

      if (opp.links) {
        const attachmentLinks = opp.links.filter(l => l.rel === 'attachment');
        if (attachmentLinks.length > 0) {
          console.log(`   Attachment Links (${attachmentLinks.length}):`);
          attachmentLinks.slice(0, 3).forEach(link => {
            console.log(`   - ${link.title || 'Attachment'}: ${link.href}`);
          });
        }
      }

      console.log('');
    });

    // Test downloading an attachment if available
    if (opportunitiesWithAttachments.length > 0) {
      const firstOpp = opportunitiesWithAttachments[0];
      const attachmentUrl = firstOpp.resourceLinks?.[0] || 
        firstOpp.links?.find(l => l.rel === 'attachment')?.href;

      if (attachmentUrl) {
        console.log('🔽 Testing attachment download...');
        console.log(`   URL: ${attachmentUrl}`);
        
        // Test HEAD request to get metadata
        const url = new URL(attachmentUrl);
        const headUrl = `${url.pathname}${url.search}${url.search.includes('?') ? '&' : '?'}api_key=${SAM_API_KEY}`;
        
        const headOptions = {
          hostname: url.hostname,
          path: headUrl,
          method: 'HEAD',
          headers: {
            'Accept': '*/*'
          }
        };

        const headReq = https.request(headOptions, (res) => {
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Content-Type: ${res.headers['content-type'] || 'unknown'}`);
          console.log(`   Content-Length: ${res.headers['content-length'] || 'unknown'} bytes`);
          console.log(`   ✅ Attachment is accessible!\n`);
        });

        headReq.on('error', (e) => {
          console.error(`   ❌ Error accessing attachment: ${e.message}\n`);
        });

        headReq.end();
      }
    }

    console.log('\n📋 Summary:');
    console.log(`- Total opportunities found: ${opportunities.length}`);
    console.log(`- Opportunities with attachments: ${opportunitiesWithAttachments.length}`);
    console.log(`- Success rate: ${((opportunitiesWithAttachments.length / opportunities.length) * 100).toFixed(1)}%`);
    
    console.log('\n✨ Next Steps:');
    console.log('1. Use the Notice IDs above in the /api/sam-gov/attachments/process endpoint');
    console.log('2. The system will download and process these attachments with OCR');
    console.log('3. Extracted data will be stored in the contract_documents table');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
findOpportunitiesWithAttachments().catch(console.error);
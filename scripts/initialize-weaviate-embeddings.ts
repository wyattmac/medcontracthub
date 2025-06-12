#!/usr/bin/env tsx
/**
 * Weaviate Vector Database Initializer
 * Creates schemas and populates embeddings for AI-powered search
 */

import weaviate, { WeaviateClient } from 'weaviate-ts-client'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import chalk from 'chalk'
import cliProgress from 'cli-progress'
import pLimit from 'p-limit'

// Configuration
const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080'
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY || ''

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const BATCH_SIZE = parseInt(process.env.WEAVIATE_BATCH_SIZE || '100')
const PARALLEL_WORKERS = parseInt(process.env.WEAVIATE_WORKERS || '3')

// Initialize clients
const client: WeaviateClient = weaviate.client({
  scheme: WEAVIATE_URL.includes('https') ? 'https' : 'http',
  host: WEAVIATE_URL.replace(/https?:\/\//, ''),
  apiKey: WEAVIATE_API_KEY ? new weaviate.ApiKey(WEAVIATE_API_KEY) : undefined
})

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

interface SchemaClass {
  class: string
  description: string
  properties: any[]
  vectorizer: string
  moduleConfig?: any
}

class WeaviateInitializer {
  private progress: cliProgress.SingleBar
  private limit = pLimit(PARALLEL_WORKERS)

  constructor() {
    this.progress = new cliProgress.SingleBar({
      format: 'Embedding Progress |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    })
  }

  async initialize() {
    console.log(chalk.blue('🚀 Initializing Weaviate Vector Database...'))
    
    // Check connection
    const isReady = await client.misc.readyChecker().do()
    if (!isReady) {
      throw new Error('Weaviate is not ready')
    }

    // Create schemas
    await this.createSchemas()
    
    console.log(chalk.green('✓ Weaviate initialization complete'))
  }

  private async createSchemas() {
    console.log(chalk.yellow('Creating vector schemas...'))

    // Define schemas
    const schemas: SchemaClass[] = [
      {
        class: 'Opportunity',
        description: 'Federal contracting opportunity with semantic search',
        properties: [
          {
            name: 'opportunityId',
            dataType: ['string'],
            description: 'Unique opportunity identifier'
          },
          {
            name: 'noticeId',
            dataType: ['string'],
            description: 'SAM.gov notice ID'
          },
          {
            name: 'title',
            dataType: ['text'],
            description: 'Opportunity title',
            moduleConfig: {
              'text2vec-transformers': {
                skip: false,
                vectorizePropertyName: false
              }
            }
          },
          {
            name: 'description',
            dataType: ['text'],
            description: 'Full opportunity description',
            moduleConfig: {
              'text2vec-transformers': {
                skip: false,
                vectorizePropertyName: false
              }
            }
          },
          {
            name: 'agency',
            dataType: ['string'],
            description: 'Issuing agency'
          },
          {
            name: 'noticeType',
            dataType: ['string'],
            description: 'Type of notice'
          },
          {
            name: 'naicsCode',
            dataType: ['string'],
            description: 'NAICS classification code'
          },
          {
            name: 'setAsideType',
            dataType: ['string'],
            description: 'Small business set-aside type'
          },
          {
            name: 'keywords',
            dataType: ['text[]'],
            description: 'Extracted keywords for search'
          },
          {
            name: 'requirements',
            dataType: ['text[]'],
            description: 'Extracted requirements'
          },
          {
            name: 'responseDeadline',
            dataType: ['date'],
            description: 'Submission deadline'
          },
          {
            name: 'awardAmount',
            dataType: ['number'],
            description: 'Expected award amount'
          },
          {
            name: 'embeddingVersion',
            dataType: ['int'],
            description: 'Version of embedding model used'
          }
        ],
        vectorizer: 'text2vec-transformers',
        moduleConfig: {
          'text2vec-transformers': {
            poolingStrategy: 'masked_mean',
            vectorizeClassName: false
          }
        }
      },
      {
        class: 'Document',
        description: 'Contract documents and attachments',
        properties: [
          {
            name: 'documentId',
            dataType: ['string'],
            description: 'Unique document identifier'
          },
          {
            name: 'opportunityId',
            dataType: ['string'],
            description: 'Related opportunity ID'
          },
          {
            name: 'documentType',
            dataType: ['string'],
            description: 'Type of document'
          },
          {
            name: 'fileName',
            dataType: ['string'],
            description: 'Original file name'
          },
          {
            name: 'content',
            dataType: ['text'],
            description: 'Extracted text content',
            moduleConfig: {
              'text2vec-transformers': {
                skip: false,
                vectorizePropertyName: false
              }
            }
          },
          {
            name: 'extractedRequirements',
            dataType: ['text[]'],
            description: 'Requirements extracted from document'
          },
          {
            name: 'extractedEntities',
            dataType: ['string[]'],
            description: 'Named entities found in document'
          },
          {
            name: 'pageCount',
            dataType: ['int'],
            description: 'Number of pages'
          },
          {
            name: 'processedAt',
            dataType: ['date'],
            description: 'When document was processed'
          }
        ],
        vectorizer: 'text2vec-transformers'
      },
      {
        class: 'Proposal',
        description: 'Proposal content for similarity matching',
        properties: [
          {
            name: 'proposalId',
            dataType: ['string'],
            description: 'Unique proposal identifier'
          },
          {
            name: 'opportunityId',
            dataType: ['string'],
            description: 'Related opportunity ID'
          },
          {
            name: 'companyId',
            dataType: ['string'],
            description: 'Company that created proposal'
          },
          {
            name: 'title',
            dataType: ['text'],
            description: 'Proposal title'
          },
          {
            name: 'executiveSummary',
            dataType: ['text'],
            description: 'Executive summary content',
            moduleConfig: {
              'text2vec-transformers': {
                skip: false,
                vectorizePropertyName: false
              }
            }
          },
          {
            name: 'technicalApproach',
            dataType: ['text'],
            description: 'Technical approach section',
            moduleConfig: {
              'text2vec-transformers': {
                skip: false,
                vectorizePropertyName: false
              }
            }
          },
          {
            name: 'winThemes',
            dataType: ['text[]'],
            description: 'Identified win themes'
          },
          {
            name: 'discriminators',
            dataType: ['text[]'],
            description: 'Key discriminators'
          },
          {
            name: 'score',
            dataType: ['number'],
            description: 'Proposal score'
          },
          {
            name: 'outcome',
            dataType: ['string'],
            description: 'Win/loss outcome'
          }
        ],
        vectorizer: 'text2vec-transformers'
      },
      {
        class: 'CompanyProfile',
        description: 'Company capabilities for matching',
        properties: [
          {
            name: 'companyId',
            dataType: ['string'],
            description: 'Unique company identifier'
          },
          {
            name: 'companyName',
            dataType: ['string'],
            description: 'Company name'
          },
          {
            name: 'capabilities',
            dataType: ['text'],
            description: 'Company capabilities statement',
            moduleConfig: {
              'text2vec-transformers': {
                skip: false,
                vectorizePropertyName: false
              }
            }
          },
          {
            name: 'pastPerformance',
            dataType: ['text[]'],
            description: 'Past performance descriptions'
          },
          {
            name: 'naicsCodes',
            dataType: ['string[]'],
            description: 'NAICS codes for company'
          },
          {
            name: 'certifications',
            dataType: ['string[]'],
            description: 'Business certifications'
          },
          {
            name: 'keywords',
            dataType: ['text[]'],
            description: 'Capability keywords'
          }
        ],
        vectorizer: 'text2vec-transformers'
      }
    ]

    // Create each schema
    for (const schema of schemas) {
      try {
        // Check if class exists
        const exists = await client.schema
          .classGetter()
          .withClassName(schema.class)
          .do()
          .catch(() => null)

        if (exists) {
          console.log(chalk.yellow(`  Schema ${schema.class} already exists, skipping...`))
          continue
        }

        // Create class
        await client.schema
          .classCreator()
          .withClass(schema)
          .do()

        console.log(chalk.green(`  ✓ Created schema: ${schema.class}`))
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to create schema ${schema.class}:`), error)
        throw error
      }
    }
  }

  async populateOpportunityEmbeddings() {
    console.log(chalk.blue('\n🎯 Populating Opportunity Embeddings...'))

    // Get opportunities that need embeddings
    const { data: opportunities, count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact' })
      .eq('embedding_version', 0)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (!opportunities || opportunities.length === 0) {
      console.log(chalk.yellow('No opportunities need embeddings'))
      return
    }

    this.progress.start(opportunities.length, 0)

    // Process in batches
    for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
      const batch = opportunities.slice(i, i + BATCH_SIZE)
      
      const batcher = client.batch.objectsBatcher()
      let addedCount = 0

      for (const opp of batch) {
        // Prepare object for Weaviate
        const weaviateObject = {
          class: 'Opportunity',
          id: opp.id,
          properties: {
            opportunityId: opp.id,
            noticeId: opp.notice_id,
            title: opp.title || '',
            description: this.cleanText(opp.description || ''),
            agency: opp.agency || '',
            noticeType: opp.notice_type || '',
            naicsCode: opp.naics_code || '',
            setAsideType: opp.set_aside_type || '',
            keywords: this.extractKeywords(opp),
            requirements: opp.requirements || [],
            responseDeadline: opp.response_deadline ? new Date(opp.response_deadline).toISOString() : null,
            awardAmount: parseFloat(opp.award_amount) || null,
            embeddingVersion: 1
          }
        }

        batcher.withObject(weaviateObject)
        addedCount++

        // Send batch when full
        if (addedCount >= BATCH_SIZE) {
          await this.sendBatch(batcher)
          addedCount = 0
        }

        this.progress.increment()
      }

      // Send remaining objects
      if (addedCount > 0) {
        await this.sendBatch(batcher)
      }

      // Update embedding version in PostgreSQL
      const ids = batch.map(o => o.id)
      await supabase
        .from('opportunities')
        .update({ embedding_version: 1 })
        .in('id', ids)
    }

    this.progress.stop()
    console.log(chalk.green(`✓ Created embeddings for ${opportunities.length} opportunities`))
  }

  async populateDocumentEmbeddings() {
    console.log(chalk.blue('\n📄 Populating Document Embeddings...'))

    // Get processed documents
    const { data: documents, count } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('processing_status', 'completed')
      .not('extracted_text', 'is', null)
      .limit(500)

    if (!documents || documents.length === 0) {
      console.log(chalk.yellow('No documents to embed'))
      return
    }

    this.progress.start(documents.length, 0)

    // Process documents
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE)
      
      const batcher = client.batch.objectsBatcher()

      for (const doc of batch) {
        const weaviateObject = {
          class: 'Document',
          id: doc.id,
          properties: {
            documentId: doc.id,
            opportunityId: doc.opportunity_id || '',
            documentType: doc.document_type || 'attachment',
            fileName: doc.file_name || '',
            content: this.cleanText(doc.extracted_text || ''),
            extractedRequirements: doc.requirements || [],
            extractedEntities: doc.extracted_metadata?.entities || [],
            pageCount: doc.page_count || 1,
            processedAt: doc.processing_completed_at ? new Date(doc.processing_completed_at).toISOString() : null
          }
        }

        batcher.withObject(weaviateObject)
        this.progress.increment()
      }

      await this.sendBatch(batcher)
    }

    this.progress.stop()
    console.log(chalk.green(`✓ Created embeddings for ${documents.length} documents`))
  }

  async populateCompanyProfiles() {
    console.log(chalk.blue('\n🏢 Populating Company Profiles...'))

    // Get companies with profiles
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .not('capabilities_statement', 'is', null)

    if (!companies || companies.length === 0) {
      console.log(chalk.yellow('No company profiles to embed'))
      return
    }

    this.progress.start(companies.length, 0)

    const batcher = client.batch.objectsBatcher()

    for (const company of companies) {
      const weaviateObject = {
        class: 'CompanyProfile',
        id: company.id,
        properties: {
          companyId: company.id,
          companyName: company.name,
          capabilities: company.capabilities_statement || '',
          pastPerformance: company.past_performance || [],
          naicsCodes: company.naics_codes || [],
          certifications: company.certifications || [],
          keywords: this.extractCompanyKeywords(company)
        }
      }

      batcher.withObject(weaviateObject)
      this.progress.increment()
    }

    await this.sendBatch(batcher)
    
    this.progress.stop()
    console.log(chalk.green(`✓ Created embeddings for ${companies.length} company profiles`))
  }

  private async sendBatch(batcher: any) {
    const result = await batcher.do()
    
    // Check for errors
    const errors = result.filter((r: any) => r.result?.errors)
    if (errors.length > 0) {
      console.error(chalk.red('\nBatch errors:'), errors[0].result.errors)
    }
  }

  private cleanText(text: string): string {
    // Remove excessive whitespace and clean up text
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 50000) // Limit to 50k chars
  }

  private extractKeywords(opportunity: any): string[] {
    const keywords: string[] = []
    
    // Extract from title
    if (opportunity.title) {
      const titleWords = opportunity.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
      keywords.push(...titleWords)
    }

    // Extract from NAICS
    if (opportunity.naics_code) {
      keywords.push(`naics-${opportunity.naics_code}`)
    }

    // Extract from set-aside
    if (opportunity.set_aside_type) {
      keywords.push(opportunity.set_aside_type.toLowerCase())
    }

    // Deduplicate
    return [...new Set(keywords)].slice(0, 50)
  }

  private extractCompanyKeywords(company: any): string[] {
    const keywords: string[] = []

    // Extract from capabilities
    if (company.capabilities_statement) {
      const words = company.capabilities_statement
        .toLowerCase()
        .match(/\b\w{4,}\b/g) || []
      keywords.push(...words.slice(0, 30))
    }

    // Add NAICS codes
    if (company.naics_codes) {
      keywords.push(...company.naics_codes.map((n: string) => `naics-${n}`))
    }

    // Add certifications
    if (company.certifications) {
      keywords.push(...company.certifications.map((c: string) => c.toLowerCase()))
    }

    return [...new Set(keywords)].slice(0, 100)
  }

  async testSimilaritySearch() {
    console.log(chalk.blue('\n🔍 Testing Similarity Search...'))

    // Test opportunity search
    const testQuery = 'medical equipment supply contract'
    
    const result = await client.graphql
      .get()
      .withClassName('Opportunity')
      .withNearText({ concepts: [testQuery] })
      .withLimit(5)
      .withFields('title agency noticeType _additional { distance }')
      .do()

    console.log(chalk.yellow(`\nSearch results for "${testQuery}":`))
    
    if (result.data.Get.Opportunity) {
      result.data.Get.Opportunity.forEach((opp: any, i: number) => {
        console.log(chalk.white(`  ${i + 1}. ${opp.title}`))
        console.log(chalk.gray(`     Agency: ${opp.agency}`))
        console.log(chalk.gray(`     Type: ${opp.noticeType}`))
        console.log(chalk.gray(`     Distance: ${opp._additional.distance.toFixed(4)}`))
      })
    }
  }

  async createCrossReferences() {
    console.log(chalk.blue('\n🔗 Creating Cross-References...'))

    // This would create relationships between:
    // - Opportunities and Documents
    // - Proposals and Opportunities
    // - Companies and Proposals

    console.log(chalk.yellow('Cross-reference creation would be implemented here'))
  }
}

// Main execution
async function main() {
  const initializer = new WeaviateInitializer()

  try {
    await initializer.initialize()
    
    // Populate embeddings
    await initializer.populateOpportunityEmbeddings()
    await initializer.populateDocumentEmbeddings()
    await initializer.populateCompanyProfiles()
    
    // Test search
    await initializer.testSimilaritySearch()
    
    // Create relationships
    await initializer.createCrossReferences()

    console.log(chalk.green('\n✅ Weaviate initialization completed successfully!'))

  } catch (error) {
    console.error(chalk.red('\n❌ Initialization failed:'), error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { WeaviateInitializer }
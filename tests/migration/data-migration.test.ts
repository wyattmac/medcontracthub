import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { KafkaDataMigrator } from '../../scripts/migrate-to-kafka'
import { ClickHousePopulator } from '../../scripts/populate-clickhouse-analytics'
import { WeaviateInitializer } from '../../scripts/initialize-weaviate-embeddings'
import { DataConsistencyChecker } from '../../scripts/check-data-consistency'
import { execSync } from 'child_process'
import { v4 as uuidv4 } from 'uuid'

// Test configuration
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321'
const TEST_SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY, {
  auth: { persistSession: false }
})

// Mock data generators
function generateMockOpportunity() {
  return {
    id: uuidv4(),
    notice_id: `TEST-${Date.now()}`,
    title: `Test Opportunity ${Math.random()}`,
    agency: 'Test Agency',
    notice_type: 'Solicitation',
    description: 'This is a test opportunity for migration testing',
    naics_code: '541512',
    set_aside_type: 'SBA',
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    posted_date: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
}

function generateMockProposal(opportunityId: string, companyId: string) {
  return {
    id: uuidv4(),
    opportunity_id: opportunityId,
    company_id: companyId,
    title: 'Test Proposal',
    status: 'draft',
    score: 85.5,
    created_at: new Date().toISOString()
  }
}

function generateMockDocument(opportunityId: string) {
  return {
    id: uuidv4(),
    opportunity_id: opportunityId,
    document_type: 'attachment',
    file_name: 'test-document.pdf',
    file_size: 1024 * 100,
    mime_type: 'application/pdf',
    extracted_text: 'This is extracted text from the test document',
    processing_status: 'completed',
    processing_completed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
}

describe('Data Migration Test Suite', () => {
  let testOpportunities: any[] = []
  let testProposals: any[] = []
  let testDocuments: any[] = []
  let testCompanyId: string

  beforeAll(async () => {
    // Apply migrations
    console.log('Applying test migrations...')
    execSync('npm run db:migrate', { env: { ...process.env, DATABASE_URL: TEST_SUPABASE_URL } })

    // Create test company
    const { data: company } = await supabase
      .from('companies')
      .insert({
        name: 'Test Company',
        ein: '12-3456789',
        duns: '123456789',
        cage_code: 'TEST1'
      })
      .select()
      .single()

    testCompanyId = company.id

    // Create test data
    console.log('Creating test data...')
    for (let i = 0; i < 10; i++) {
      const opp = generateMockOpportunity()
      testOpportunities.push(opp)
      
      if (i % 2 === 0) {
        testProposals.push(generateMockProposal(opp.id, testCompanyId))
        testDocuments.push(generateMockDocument(opp.id))
      }
    }

    // Insert test data
    await supabase.from('opportunities').insert(testOpportunities)
    await supabase.from('proposals').insert(testProposals)
    await supabase.from('contract_documents').insert(testDocuments)
  })

  afterAll(async () => {
    // Cleanup test data
    console.log('Cleaning up test data...')
    await supabase.from('proposals').delete().in('id', testProposals.map(p => p.id))
    await supabase.from('contract_documents').delete().in('id', testDocuments.map(d => d.id))
    await supabase.from('opportunities').delete().in('id', testOpportunities.map(o => o.id))
    await supabase.from('companies').delete().eq('id', testCompanyId)
  })

  describe('Database Migrations', () => {
    it('should create event sourcing tables', async () => {
      const tables = ['event_store', 'event_outbox', 'event_snapshots', 'event_type_registry']
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        expect(error).toBeNull()
        expect(data).toBeDefined()
      }
    })

    it('should create service tracking columns', async () => {
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('processed_by_services, last_sync_to_kafka, embedding_version')
        .limit(1)
        .single()

      expect(opportunity).toHaveProperty('processed_by_services')
      expect(opportunity).toHaveProperty('last_sync_to_kafka')
      expect(opportunity).toHaveProperty('embedding_version')
    })

    it('should create migration state tables', async () => {
      const { data: migrationState } = await supabase
        .from('data_migration_state')
        .select('*')
        .limit(1)

      expect(migrationState).toBeDefined()
    })

    it('should handle event versioning correctly', async () => {
      const aggregateId = uuidv4()
      
      // Append multiple events
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase.rpc('append_event', {
          p_aggregate_id: aggregateId,
          p_aggregate_type: 'TestAggregate',
          p_event_type: 'TestEvent',
          p_event_data: { version: i + 1 }
        })

        expect(error).toBeNull()
        expect(data).toBeDefined()
      }

      // Verify versions are sequential
      const { data: events } = await supabase
        .from('event_store')
        .select('event_version')
        .eq('aggregate_id', aggregateId)
        .order('event_version')

      expect(events).toHaveLength(3)
      expect(events.map(e => e.event_version)).toEqual([1, 2, 3])
    })
  })

  describe('Kafka Migration', () => {
    let migrator: KafkaDataMigrator

    beforeEach(() => {
      migrator = new KafkaDataMigrator()
    })

    it('should migrate opportunities to Kafka', async () => {
      // Mock Kafka producer
      const mockSend = jest.fn().mockResolvedValue({})
      migrator['context'].producer.send = mockSend

      // Run migration for test opportunities
      await migrator['publishOpportunityEvent'](testOpportunities[0])

      expect(mockSend).toHaveBeenCalledWith({
        topic: 'contracts.opportunities.events',
        messages: expect.arrayContaining([
          expect.objectContaining({
            key: testOpportunities[0].id,
            value: expect.stringContaining('OpportunityMigrated')
          })
        ])
      })
    })

    it('should handle migration checkpoints', async () => {
      const migrationId = uuidv4()
      const processedIds = testOpportunities.slice(0, 5).map(o => o.id)

      const { error } = await supabase.rpc('save_migration_checkpoint', {
        p_migration_id: migrationId,
        p_processed_ids: processedIds,
        p_last_successful_id: processedIds[processedIds.length - 1],
        p_batch_time_ms: 1000
      })

      expect(error).toBeNull()

      // Verify checkpoint was saved
      const { data: checkpoint } = await supabase
        .from('migration_checkpoints')
        .select('*')
        .eq('migration_id', migrationId)
        .single()

      expect(checkpoint.processed_ids).toHaveLength(5)
      expect(checkpoint.entities_per_second).toBeGreaterThan(0)
    })

    it('should track failed migrations', async () => {
      const migrationId = uuidv4()
      const entityId = uuidv4()

      await supabase.rpc('track_migration_failure', {
        p_migration_id: migrationId,
        p_entity_id: entityId,
        p_entity_type: 'opportunity',
        p_error_code: 'KAFKA_TIMEOUT',
        p_error_message: 'Failed to publish to Kafka'
      })

      const { data: failure } = await supabase
        .from('migration_failed_entities')
        .select('*')
        .eq('migration_id', migrationId)
        .single()

      expect(failure.error_code).toBe('KAFKA_TIMEOUT')
      expect(failure.retry_count).toBe(0)
    })
  })

  describe('ClickHouse Population', () => {
    let populator: ClickHousePopulator

    beforeEach(() => {
      populator = new ClickHousePopulator()
    })

    it('should create analytics tables', async () => {
      // Mock ClickHouse query
      const mockQuery = jest.fn().mockReturnValue({
        toPromise: jest.fn().mockResolvedValue([])
      })
      populator['clickhouse'].query = mockQuery

      await populator['createAnalyticsTables']()

      // Verify tables were created
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS')
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('opportunity_events')
      )
    })

    it('should batch insert data correctly', async () => {
      const mockQuery = jest.fn().mockReturnValue({
        toPromise: jest.fn().mockResolvedValue([])
      })
      populator['clickhouse'].query = mockQuery

      const testData = testOpportunities.slice(0, 3).map(o => ({
        event_id: o.id,
        opportunity_id: o.id,
        title: o.title,
        created_at: o.created_at
      }))

      await populator['insertBatch']('opportunity_events', testData)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO')
      )
    })
  })

  describe('Weaviate Initialization', () => {
    let initializer: WeaviateInitializer

    beforeEach(() => {
      initializer = new WeaviateInitializer()
    })

    it('should create vector schemas', async () => {
      // Mock Weaviate client
      const mockClassCreator = jest.fn().mockReturnValue({
        withClass: jest.fn().mockReturnValue({
          do: jest.fn().mockResolvedValue({})
        })
      })

      initializer['client'].schema = {
        classCreator: mockClassCreator,
        classGetter: jest.fn().mockReturnValue({
          withClassName: jest.fn().mockReturnValue({
            do: jest.fn().mockRejectedValue(new Error('Not found'))
          })
        })
      }

      await initializer['createSchemas']()

      expect(mockClassCreator).toHaveBeenCalled()
    })

    it('should extract keywords correctly', () => {
      const keywords = initializer['extractKeywords']({
        title: 'Medical Equipment Supply Contract',
        naics_code: '541512',
        set_aside_type: 'WOSB'
      })

      expect(keywords).toContain('medical')
      expect(keywords).toContain('equipment')
      expect(keywords).toContain('naics-541512')
      expect(keywords).toContain('wosb')
    })
  })

  describe('Data Consistency', () => {
    let checker: DataConsistencyChecker

    beforeEach(() => {
      checker = new DataConsistencyChecker()
    })

    it('should detect count discrepancies', async () => {
      // Mock different counts
      checker['getPostgresCount'] = jest.fn().mockResolvedValue(100)
      checker['getClickHouseCount'] = jest.fn().mockResolvedValue(95)
      checker['getWeaviateCount'] = jest.fn().mockResolvedValue(98)

      await checker['checkOpportunityConsistency']()

      const report = checker['report']
      const check = report.checks.find(c => c.name === 'Opportunity Data Consistency')

      expect(check.status).toBe('warning')
      expect(check.details.differences.clickhouse).toBe('5.00%')
    })

    it('should check event ordering', async () => {
      // Create events with gap
      const aggregateId = uuidv4()
      
      await supabase.from('event_store').insert([
        {
          aggregate_id: aggregateId,
          aggregate_type: 'Test',
          event_type: 'TestEvent',
          event_version: 1,
          event_data: {}
        },
        {
          aggregate_id: aggregateId,
          aggregate_type: 'Test',
          event_type: 'TestEvent',
          event_version: 3, // Gap here
          event_data: {}
        }
      ])

      // Run consistency check
      await checker['checkEventOrdering']()

      const check = checker['report'].checks.find(c => c.name === 'Event Ordering Integrity')
      expect(check.status).toBe('failed')
    })
  })

  describe('Rollback Procedures', () => {
    it('should generate rollback snapshot', async () => {
      const migrationId = uuidv4()
      
      // Start migration
      const { data: migration } = await supabase.rpc('start_migration', {
        p_migration_name: 'test_rollback_migration',
        p_migration_type: 'full_sync',
        p_entity_type: 'opportunities',
        p_target_system: 'kafka'
      })

      expect(migration).toBeDefined()

      // Simulate some progress
      await supabase
        .from('data_migration_state')
        .update({
          total_processed: 50,
          status: 'running'
        })
        .eq('id', migration)

      // Get migration state for rollback
      const { data: state } = await supabase
        .from('data_migration_state')
        .select('*')
        .eq('id', migration)
        .single()

      expect(state.total_processed).toBe(50)
      expect(state.status).toBe('running')
    })

    it('should validate rollback script exists', () => {
      const scriptPath = './scripts/rollback-microservices.sh'
      const fs = require('fs')
      
      expect(fs.existsSync(scriptPath)).toBe(true)
      
      // Check script is executable
      const stats = fs.statSync(scriptPath)
      expect(stats.mode & 0o100).toBeTruthy() // Check execute bit
    })
  })

  describe('End-to-End Migration Flow', () => {
    it('should complete full migration cycle', async () => {
      // This is a simplified E2E test
      const testOpp = generateMockOpportunity()
      
      // 1. Insert opportunity
      await supabase.from('opportunities').insert(testOpp)

      // 2. Create event
      const { data: eventId } = await supabase.rpc('append_event', {
        p_aggregate_id: testOpp.id,
        p_aggregate_type: 'Opportunity',
        p_event_type: 'OpportunityCreated',
        p_event_data: testOpp
      })

      expect(eventId).toBeDefined()

      // 3. Check outbox
      const { data: outboxEntry } = await supabase
        .from('event_outbox')
        .select('*')
        .eq('aggregate_id', testOpp.id)
        .single()

      expect(outboxEntry.status).toBe('pending')
      expect(outboxEntry.topic).toBe('contracts.opportunities.events')

      // Cleanup
      await supabase.from('opportunities').delete().eq('id', testOpp.id)
    })
  })
})
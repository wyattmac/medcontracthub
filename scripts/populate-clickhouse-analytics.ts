#!/usr/bin/env tsx
/**
 * ClickHouse Analytics Populator
 * Creates analytics tables and migrates historical data
 */

import { ClickHouse } from 'clickhouse'
import { createClient } from '@supabase/supabase-js'
import { format, subDays } from 'date-fns'
import chalk from 'chalk'
import cliProgress from 'cli-progress'

// Configuration
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123'
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'medcontracthub'
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'default'
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || ''

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const BATCH_SIZE = parseInt(process.env.CLICKHOUSE_BATCH_SIZE || '10000')
const RETENTION_DAYS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90')

// Initialize clients
const clickhouse = new ClickHouse({
  url: CLICKHOUSE_URL,
  port: 8123,
  debug: false,
  basicAuth: CLICKHOUSE_USER ? {
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD
  } : null,
  isUseGzip: true,
  format: 'json'
})

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

class ClickHousePopulator {
  private progress: cliProgress.SingleBar

  constructor() {
    this.progress = new cliProgress.SingleBar({
      format: 'Analytics Migration |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    })
  }

  async initialize() {
    console.log(chalk.blue('🚀 Initializing ClickHouse Analytics...'))
    
    // Create database if not exists
    await clickhouse.query(`CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}`).toPromise()
    
    // Create tables
    await this.createAnalyticsTables()
    
    console.log(chalk.green('✓ ClickHouse initialization complete'))
  }

  private async createAnalyticsTables() {
    console.log(chalk.yellow('Creating analytics tables...'))

    // Opportunity events table
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.opportunity_events (
        event_id UUID,
        event_type String,
        opportunity_id UUID,
        notice_id String,
        title String,
        agency String,
        notice_type String,
        naics_code Nullable(String),
        set_aside_type Nullable(String),
        response_deadline DateTime,
        posted_date Date,
        award_amount Nullable(Decimal64(2)),
        award_date Nullable(Date),
        
        -- User context
        user_id Nullable(UUID),
        company_id Nullable(UUID),
        action String,
        
        -- Timestamps
        created_at DateTime DEFAULT now(),
        event_timestamp DateTime,
        
        -- Derived fields
        days_until_deadline Int32 MATERIALIZED dateDiff('day', created_at, response_deadline),
        response_time_days Int32 MATERIALIZED dateDiff('day', posted_date, response_deadline),
        is_small_business_setaside UInt8 MATERIALIZED set_aside_type IN ('SBA', 'SBP', 'WOSB', '8(a)'),
        
        -- Indexes
        INDEX idx_opportunity_id opportunity_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_notice_type notice_type TYPE set(100) GRANULARITY 1,
        INDEX idx_agency agency TYPE set(1000) GRANULARITY 1,
        INDEX idx_naics naics_code TYPE bloom_filter GRANULARITY 1
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(created_at)
      ORDER BY (created_at, opportunity_id, event_type)
      TTL created_at + INTERVAL ${RETENTION_DAYS} DAY
    `).toPromise()

    // API usage metrics table
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.api_usage_events (
        event_id UUID DEFAULT generateUUIDv4(),
        user_id UUID,
        company_id UUID,
        endpoint String,
        method Enum8('GET' = 1, 'POST' = 2, 'PUT' = 3, 'DELETE' = 4, 'PATCH' = 5),
        status_code UInt16,
        response_time_ms UInt32,
        request_size_bytes UInt32,
        response_size_bytes UInt32,
        cost_units Decimal32(4),
        
        -- Context
        user_agent String,
        ip_address String,
        country_code FixedString(2),
        
        -- Error tracking
        error_code Nullable(String),
        error_message Nullable(String),
        
        -- Timestamps
        timestamp DateTime DEFAULT now(),
        
        -- Derived fields
        is_error UInt8 MATERIALIZED status_code >= 400,
        endpoint_category String MATERIALIZED splitByChar('/', endpoint)[3],
        
        INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_endpoint endpoint TYPE set(1000) GRANULARITY 1,
        INDEX idx_status status_code TYPE set(100) GRANULARITY 1
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (timestamp, user_id, endpoint)
      TTL timestamp + INTERVAL 30 DAY
    `).toPromise()

    // User activity events table
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.user_activity_events (
        event_id UUID DEFAULT generateUUIDv4(),
        user_id UUID,
        company_id UUID,
        session_id UUID,
        event_type String,
        event_category String,
        
        -- Event details
        entity_type Nullable(String),
        entity_id Nullable(UUID),
        action String,
        
        -- Context
        page_url String,
        referrer_url Nullable(String),
        device_type Enum8('desktop' = 1, 'mobile' = 2, 'tablet' = 3),
        browser String,
        
        -- Performance
        page_load_time_ms Nullable(UInt32),
        
        -- Timestamps
        timestamp DateTime DEFAULT now(),
        
        INDEX idx_user_activity user_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_session session_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_event_type event_type TYPE set(100) GRANULARITY 1
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (timestamp, user_id, session_id)
      TTL timestamp + INTERVAL 60 DAY
    `).toPromise()

    // Proposal analytics table
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.proposal_events (
        event_id UUID,
        proposal_id UUID,
        opportunity_id UUID,
        company_id UUID,
        event_type String,
        
        -- Proposal details
        status String,
        score Nullable(Decimal32(2)),
        submission_date Nullable(Date),
        award_status Nullable(String),
        
        -- Metrics
        preparation_days Nullable(Int32),
        team_size Nullable(UInt8),
        revision_count Nullable(UInt16),
        
        -- Timestamps
        created_at DateTime DEFAULT now(),
        event_timestamp DateTime,
        
        INDEX idx_proposal_id proposal_id TYPE bloom_filter GRANULARITY 1,
        INDEX idx_company_id company_id TYPE bloom_filter GRANULARITY 1
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(created_at)
      ORDER BY (created_at, company_id, proposal_id)
    `).toPromise()

    // Create materialized views for real-time aggregations
    await this.createMaterializedViews()
  }

  private async createMaterializedViews() {
    console.log(chalk.yellow('Creating materialized views...'))

    // Hourly opportunity metrics
    await clickhouse.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${CLICKHOUSE_DATABASE}.opportunity_metrics_hourly
      ENGINE = SummingMergeTree()
      PARTITION BY toYYYYMM(hour)
      ORDER BY (hour, notice_type, agency)
      AS SELECT
        toStartOfHour(created_at) as hour,
        notice_type,
        agency,
        count() as total_opportunities,
        countIf(action = 'viewed') as views,
        countIf(action = 'saved') as saves,
        countIf(action = 'downloaded') as downloads,
        avg(award_amount) as avg_award_amount,
        max(award_amount) as max_award_amount
      FROM ${CLICKHOUSE_DATABASE}.opportunity_events
      GROUP BY hour, notice_type, agency
    `).toPromise()

    // User engagement metrics
    await clickhouse.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${CLICKHOUSE_DATABASE}.user_engagement_daily
      ENGINE = SummingMergeTree()
      PARTITION BY toYYYYMM(date)
      ORDER BY (date, company_id)
      AS SELECT
        toDate(timestamp) as date,
        company_id,
        uniq(user_id) as unique_users,
        count() as total_events,
        countIf(event_type = 'page_view') as page_views,
        countIf(event_type = 'opportunity_saved') as opportunities_saved,
        countIf(event_type = 'proposal_created') as proposals_created,
        avg(page_load_time_ms) as avg_page_load_time
      FROM ${CLICKHOUSE_DATABASE}.user_activity_events
      GROUP BY date, company_id
    `).toPromise()

    // API performance metrics
    await clickhouse.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${CLICKHOUSE_DATABASE}.api_performance_5min
      ENGINE = AggregatingMergeTree()
      PARTITION BY toYYYYMM(interval_start)
      ORDER BY (interval_start, endpoint)
      AS SELECT
        toStartOfFiveMinute(timestamp) as interval_start,
        endpoint,
        count() as request_count,
        avg(response_time_ms) as avg_response_time,
        quantile(0.95)(response_time_ms) as p95_response_time,
        quantile(0.99)(response_time_ms) as p99_response_time,
        countIf(is_error = 1) as error_count,
        sum(cost_units) as total_cost_units
      FROM ${CLICKHOUSE_DATABASE}.api_usage_events
      GROUP BY interval_start, endpoint
    `).toPromise()
  }

  async migrateHistoricalOpportunities() {
    console.log(chalk.blue('\n📊 Migrating Historical Opportunities...'))

    const startDate = subDays(new Date(), RETENTION_DAYS)
    
    // Get total count
    const { count } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())

    if (!count) {
      console.log(chalk.yellow('No opportunities to migrate'))
      return
    }

    this.progress.start(count, 0)

    let offset = 0
    let processed = 0

    while (offset < count) {
      // Fetch batch from PostgreSQL
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          saved_opportunities (
            user_id,
            company_id,
            created_at
          )
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at')
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) throw error
      if (!opportunities || opportunities.length === 0) break

      // Transform to ClickHouse format
      const events = opportunities.flatMap(opp => {
        const baseEvent = {
          event_id: opp.id,
          event_type: 'historical_import',
          opportunity_id: opp.id,
          notice_id: opp.notice_id,
          title: opp.title,
          agency: opp.agency,
          notice_type: opp.notice_type,
          naics_code: opp.naics_code,
          set_aside_type: opp.set_aside_type,
          response_deadline: opp.response_deadline,
          posted_date: opp.posted_date,
          award_amount: opp.award_amount,
          award_date: opp.award_date,
          created_at: opp.created_at,
          event_timestamp: opp.created_at,
          action: 'created'
        }

        // Include saved events
        const savedEvents = (opp.saved_opportunities || []).map(save => ({
          ...baseEvent,
          event_id: save.id,
          event_type: 'opportunity_saved',
          user_id: save.user_id,
          company_id: save.company_id,
          created_at: save.created_at,
          event_timestamp: save.created_at,
          action: 'saved'
        }))

        return [baseEvent, ...savedEvents]
      })

      // Insert into ClickHouse
      await this.insertBatch('opportunity_events', events)
      
      processed += opportunities.length
      this.progress.update(processed)
      offset += BATCH_SIZE
    }

    this.progress.stop()
    console.log(chalk.green(`✓ Migrated ${processed} opportunities`))
  }

  async migrateApiUsageMetrics() {
    console.log(chalk.blue('\n📈 Migrating API Usage Metrics...'))

    // Get usage data from sam_api_usage
    const { data: usage, error } = await supabase
      .from('sam_api_usage')
      .select('*')
      .order('created_at')

    if (error) throw error
    if (!usage || usage.length === 0) {
      console.log(chalk.yellow('No API usage data to migrate'))
      return
    }

    this.progress.start(usage.length, 0)

    // Transform and insert in batches
    for (let i = 0; i < usage.length; i += BATCH_SIZE) {
      const batch = usage.slice(i, i + BATCH_SIZE)
      
      const events = batch.map(u => ({
        user_id: u.user_id,
        company_id: u.company_id || '00000000-0000-0000-0000-000000000000',
        endpoint: u.endpoint || '/api/opportunities/search',
        method: u.method || 'GET',
        status_code: 200,
        response_time_ms: Math.floor(Math.random() * 500) + 100,
        request_size_bytes: 0,
        response_size_bytes: u.response_size || 0,
        cost_units: u.cost || 1,
        user_agent: 'historical-import',
        ip_address: '0.0.0.0',
        country_code: 'US',
        timestamp: u.created_at
      }))

      await this.insertBatch('api_usage_events', events)
      this.progress.update(i + batch.length)
    }

    this.progress.stop()
    console.log(chalk.green(`✓ Migrated ${usage.length} API usage records`))
  }

  private async insertBatch(table: string, data: any[]) {
    if (data.length === 0) return

    const columns = Object.keys(data[0])
    const values = data.map(row => 
      columns.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`
        if (val instanceof Date) return `'${val.toISOString()}'`
        return val
      }).join(',')
    ).join('),(')

    const query = `
      INSERT INTO ${CLICKHOUSE_DATABASE}.${table} 
      (${columns.join(',')}) 
      VALUES (${values})
    `

    await clickhouse.query(query).toPromise()
  }

  async createSampleDashboardData() {
    console.log(chalk.blue('\n📊 Creating Sample Dashboard Data...'))

    // Generate some recent activity for dashboards
    const now = new Date()
    const events = []

    // Generate hourly data for last 24 hours
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now.getTime() - hour * 60 * 60 * 1000)
      
      // API usage
      for (let i = 0; i < Math.floor(Math.random() * 100) + 50; i++) {
        events.push({
          user_id: '00000000-0000-0000-0000-000000000001',
          company_id: '00000000-0000-0000-0000-000000000001',
          endpoint: ['/api/opportunities/search', '/api/opportunities/save', '/api/proposals'][Math.floor(Math.random() * 3)],
          method: 'GET',
          status_code: Math.random() > 0.95 ? 500 : 200,
          response_time_ms: Math.floor(Math.random() * 300) + 50,
          request_size_bytes: 1024,
          response_size_bytes: 4096,
          cost_units: 1,
          user_agent: 'dashboard-demo',
          ip_address: '127.0.0.1',
          country_code: 'US',
          timestamp: timestamp.toISOString()
        })
      }
    }

    await this.insertBatch('api_usage_events', events)
    console.log(chalk.green(`✓ Created ${events.length} sample events`))
  }

  async verifyMigration() {
    console.log(chalk.blue('\n🔍 Verifying Migration...'))

    const tables = [
      'opportunity_events',
      'api_usage_events',
      'user_activity_events',
      'proposal_events'
    ]

    for (const table of tables) {
      const result = await clickhouse.query(`
        SELECT count() as count 
        FROM ${CLICKHOUSE_DATABASE}.${table}
      `).toPromise()

      console.log(chalk.white(`  ${table}: ${result[0].count} records`))
    }

    // Check materialized views
    console.log(chalk.yellow('\nMaterialized Views:'))
    const views = [
      'opportunity_metrics_hourly',
      'user_engagement_daily',
      'api_performance_5min'
    ]

    for (const view of views) {
      const result = await clickhouse.query(`
        SELECT count() as count 
        FROM ${CLICKHOUSE_DATABASE}.${view}
      `).toPromise()

      console.log(chalk.white(`  ${view}: ${result[0].count} aggregated records`))
    }
  }
}

// Main execution
async function main() {
  const populator = new ClickHousePopulator()

  try {
    await populator.initialize()
    
    // Run migrations
    await populator.migrateHistoricalOpportunities()
    await populator.migrateApiUsageMetrics()
    await populator.createSampleDashboardData()
    
    // Verify
    await populator.verifyMigration()

    console.log(chalk.green('\n✅ ClickHouse population completed successfully!'))

  } catch (error) {
    console.error(chalk.red('\n❌ Population failed:'), error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ClickHousePopulator }
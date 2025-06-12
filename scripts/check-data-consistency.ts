#!/usr/bin/env tsx
/**
 * Data Consistency Checker
 * Validates data synchronization across PostgreSQL, Kafka, ClickHouse, and Weaviate
 */

import { createClient } from '@supabase/supabase-js'
import { Kafka } from 'kafkajs'
import { ClickHouse } from 'clickhouse'
import weaviate, { WeaviateClient } from 'weaviate-ts-client'
import chalk from 'chalk'
import { differenceInMinutes, format } from 'date-fns'
import Table from 'cli-table3'

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'http://localhost:8123'
const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080'

// Thresholds
const COUNT_TOLERANCE_PERCENT = 1 // Allow 1% difference
const LAG_THRESHOLD_MINUTES = 5 // Alert if lag > 5 minutes

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

const kafka = new Kafka({
  clientId: 'consistency-checker',
  brokers: KAFKA_BROKERS
})

const clickhouse = new ClickHouse({
  url: CLICKHOUSE_URL,
  port: 8123,
  debug: false,
  format: 'json'
})

const weaviateClient: WeaviateClient = weaviate.client({
  scheme: WEAVIATE_URL.includes('https') ? 'https' : 'http',
  host: WEAVIATE_URL.replace(/https?:\/\//, '')
})

interface ConsistencyReport {
  timestamp: string
  checks: ConsistencyCheck[]
  summary: {
    totalChecks: number
    passed: number
    failed: number
    warnings: number
  }
}

interface ConsistencyCheck {
  name: string
  status: 'passed' | 'failed' | 'warning'
  details: any
  recommendations?: string[]
}

class DataConsistencyChecker {
  private report: ConsistencyReport = {
    timestamp: new Date().toISOString(),
    checks: [],
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  }

  async runAllChecks() {
    console.log(chalk.blue('🔍 Starting Data Consistency Checks...\n'))

    // Run all consistency checks
    await this.checkOpportunityConsistency()
    await this.checkProposalConsistency()
    await this.checkDocumentConsistency()
    await this.checkEventOrdering()
    await this.checkKafkaLag()
    await this.checkDataFreshness()
    await this.checkReferentialIntegrity()
    await this.checkEmbeddingCompleteness()

    // Generate report
    this.generateReport()
  }

  private async checkOpportunityConsistency() {
    console.log(chalk.yellow('📊 Checking Opportunity Consistency...'))

    try {
      // Get counts from each system
      const pgCount = await this.getPostgresCount('opportunities')
      const kafkaCount = await this.getKafkaTopicMessageCount('contracts.opportunities.events')
      const clickhouseCount = await this.getClickHouseCount('opportunity_events')
      const weaviateCount = await this.getWeaviateCount('Opportunity')

      // Calculate differences
      const maxCount = Math.max(pgCount, clickhouseCount, weaviateCount)
      const kafkaDiff = Math.abs(kafkaCount - pgCount) / pgCount * 100
      const clickhouseDiff = Math.abs(clickhouseCount - pgCount) / pgCount * 100
      const weaviateDiff = Math.abs(weaviateCount - pgCount) / pgCount * 100

      const check: ConsistencyCheck = {
        name: 'Opportunity Data Consistency',
        status: 'passed',
        details: {
          postgresql: pgCount,
          kafka: kafkaCount,
          clickhouse: clickhouseCount,
          weaviate: weaviateCount,
          differences: {
            kafka: `${kafkaDiff.toFixed(2)}%`,
            clickhouse: `${clickhouseDiff.toFixed(2)}%`,
            weaviate: `${weaviateDiff.toFixed(2)}%`
          }
        }
      }

      // Check if differences exceed tolerance
      if (clickhouseDiff > COUNT_TOLERANCE_PERCENT || weaviateDiff > COUNT_TOLERANCE_PERCENT) {
        check.status = 'warning'
        check.recommendations = [
          'Run incremental sync to update lagging systems',
          'Check for failed migration batches',
          'Verify service health and processing queues'
        ]
      }

      if (clickhouseDiff > 5 || weaviateDiff > 5) {
        check.status = 'failed'
      }

      this.addCheck(check)

    } catch (error) {
      this.addCheck({
        name: 'Opportunity Data Consistency',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  private async checkProposalConsistency() {
    console.log(chalk.yellow('📄 Checking Proposal Consistency...'))

    try {
      const pgCount = await this.getPostgresCount('proposals')
      const clickhouseCount = await this.getClickHouseCount('proposal_events')
      const weaviateCount = await this.getWeaviateCount('Proposal')

      const clickhouseDiff = Math.abs(clickhouseCount - pgCount) / pgCount * 100
      const weaviateDiff = Math.abs(weaviateCount - pgCount) / pgCount * 100

      this.addCheck({
        name: 'Proposal Data Consistency',
        status: (clickhouseDiff > COUNT_TOLERANCE_PERCENT || weaviateDiff > COUNT_TOLERANCE_PERCENT) ? 'warning' : 'passed',
        details: {
          postgresql: pgCount,
          clickhouse: clickhouseCount,
          weaviate: weaviateCount,
          differences: {
            clickhouse: `${clickhouseDiff.toFixed(2)}%`,
            weaviate: `${weaviateDiff.toFixed(2)}%`
          }
        }
      })

    } catch (error) {
      this.addCheck({
        name: 'Proposal Data Consistency',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  private async checkDocumentConsistency() {
    console.log(chalk.yellow('📎 Checking Document Consistency...'))

    try {
      const pgCount = await this.getPostgresCount('contract_documents', "processing_status = 'completed'")
      const weaviateCount = await this.getWeaviateCount('Document')

      const diff = Math.abs(weaviateCount - pgCount) / pgCount * 100

      this.addCheck({
        name: 'Document Data Consistency',
        status: diff > COUNT_TOLERANCE_PERCENT ? 'warning' : 'passed',
        details: {
          postgresql: pgCount,
          weaviate: weaviateCount,
          difference: `${diff.toFixed(2)}%`
        }
      })

    } catch (error) {
      this.addCheck({
        name: 'Document Data Consistency',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  private async checkEventOrdering() {
    console.log(chalk.yellow('🔢 Checking Event Ordering...'))

    try {
      // Check for event version gaps
      const { data: gaps, error } = await supabase.rpc('get_event_version_gaps')

      if (error) throw error

      const hasGaps = gaps && gaps.length > 0

      this.addCheck({
        name: 'Event Ordering Integrity',
        status: hasGaps ? 'failed' : 'passed',
        details: {
          gapsFound: gaps?.length || 0,
          gaps: gaps?.slice(0, 10) || []
        },
        recommendations: hasGaps ? [
          'Investigate missing events',
          'Check for concurrent write conflicts',
          'Verify event publishing reliability'
        ] : undefined
      })

    } catch (error) {
      this.addCheck({
        name: 'Event Ordering Integrity',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  private async checkKafkaLag() {
    console.log(chalk.yellow('📊 Checking Kafka Consumer Lag...'))

    const admin = kafka.admin()
    await admin.connect()

    try {
      const groups = await admin.listGroups()
      const consumerGroups = groups.groups.map(g => g.groupId)

      const lagDetails: any[] = []
      let maxLag = 0

      for (const groupId of consumerGroups) {
        const description = await admin.describeGroups([groupId])
        const offsets = await admin.fetchOffsets({ groupId })

        for (const topic of offsets) {
          for (const partition of topic.partitions) {
            const lag = parseInt(partition.offset) - parseInt(partition.low)
            maxLag = Math.max(maxLag, lag)
            
            if (lag > 1000) {
              lagDetails.push({
                group: groupId,
                topic: topic.topic,
                partition: partition.partition,
                lag: lag
              })
            }
          }
        }
      }

      this.addCheck({
        name: 'Kafka Consumer Lag',
        status: maxLag > 10000 ? 'failed' : (maxLag > 1000 ? 'warning' : 'passed'),
        details: {
          maxLag,
          highLagConsumers: lagDetails
        },
        recommendations: maxLag > 1000 ? [
          'Scale up consumer instances',
          'Check for processing bottlenecks',
          'Verify consumer health'
        ] : undefined
      })

    } catch (error) {
      this.addCheck({
        name: 'Kafka Consumer Lag',
        status: 'failed',
        details: { error: error.message }
      })
    } finally {
      await admin.disconnect()
    }
  }

  private async checkDataFreshness() {
    console.log(chalk.yellow('⏱️  Checking Data Freshness...'))

    try {
      // Check latest record timestamps
      const { data: pgLatest } = await supabase
        .from('opportunities')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const chLatest = await clickhouse.query(`
        SELECT max(created_at) as latest 
        FROM medcontracthub.opportunity_events
      `).toPromise()

      const pgTime = new Date(pgLatest?.created_at || 0)
      const chTime = new Date(chLatest[0]?.latest || 0)
      const lagMinutes = differenceInMinutes(pgTime, chTime)

      this.addCheck({
        name: 'Data Freshness',
        status: lagMinutes > LAG_THRESHOLD_MINUTES ? 'warning' : 'passed',
        details: {
          postgresLatest: format(pgTime, 'yyyy-MM-dd HH:mm:ss'),
          clickhouseLatest: format(chTime, 'yyyy-MM-dd HH:mm:ss'),
          lagMinutes
        },
        recommendations: lagMinutes > LAG_THRESHOLD_MINUTES ? [
          'Check if data sync is running',
          'Verify Kafka consumers are active',
          'Look for processing errors'
        ] : undefined
      })

    } catch (error) {
      this.addCheck({
        name: 'Data Freshness',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  private async checkReferentialIntegrity() {
    console.log(chalk.yellow('🔗 Checking Referential Integrity...'))

    try {
      // Check for orphaned saved opportunities
      const { data: orphanedSaves } = await supabase
        .from('saved_opportunities')
        .select('id, opportunity_id')
        .is('opportunity_id', null)

      // Check for proposals without opportunities
      const { data: orphanedProposals } = await supabase
        .from('proposals')
        .select('id, opportunity_id')
        .is('opportunity_id', null)

      const hasOrphans = (orphanedSaves?.length || 0) > 0 || (orphanedProposals?.length || 0) > 0

      this.addCheck({
        name: 'Referential Integrity',
        status: hasOrphans ? 'warning' : 'passed',
        details: {
          orphanedSavedOpportunities: orphanedSaves?.length || 0,
          orphanedProposals: orphanedProposals?.length || 0
        },
        recommendations: hasOrphans ? [
          'Run data cleanup script',
          'Add foreign key constraints',
          'Investigate data deletion patterns'
        ] : undefined
      })

    } catch (error) {
      this.addCheck({
        name: 'Referential Integrity',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  private async checkEmbeddingCompleteness() {
    console.log(chalk.yellow('🧠 Checking Embedding Completeness...'))

    try {
      // Check opportunities without embeddings
      const { count: totalOpps } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })

      const { count: embeddedOpps } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .gt('embedding_version', 0)

      const completeness = (embeddedOpps || 0) / (totalOpps || 1) * 100

      this.addCheck({
        name: 'Embedding Completeness',
        status: completeness < 95 ? 'warning' : 'passed',
        details: {
          totalOpportunities: totalOpps,
          embeddedOpportunities: embeddedOpps,
          completenessPercentage: `${completeness.toFixed(2)}%`
        },
        recommendations: completeness < 95 ? [
          'Run embedding population script',
          'Check AI service health',
          'Verify Weaviate capacity'
        ] : undefined
      })

    } catch (error) {
      this.addCheck({
        name: 'Embedding Completeness',
        status: 'failed',
        details: { error: error.message }
      })
    }
  }

  // Helper methods
  private async getPostgresCount(table: string, condition?: string): Promise<number> {
    let query = supabase.from(table).select('*', { count: 'exact', head: true })
    
    if (condition) {
      // Parse simple conditions (this is simplified, real implementation would be more robust)
      const [field, op, value] = condition.split(' ')
      if (op === '=') {
        query = query.eq(field, value.replace(/'/g, ''))
      }
    }

    const { count } = await query
    return count || 0
  }

  private async getKafkaTopicMessageCount(topic: string): Promise<number> {
    const admin = kafka.admin()
    await admin.connect()

    try {
      const topicOffsets = await admin.fetchTopicOffsets(topic)
      let totalMessages = 0

      for (const partition of topicOffsets) {
        const high = parseInt(partition.high)
        const low = parseInt(partition.low)
        totalMessages += (high - low)
      }

      return totalMessages
    } finally {
      await admin.disconnect()
    }
  }

  private async getClickHouseCount(table: string): Promise<number> {
    const result = await clickhouse.query(`
      SELECT count() as count 
      FROM medcontracthub.${table}
    `).toPromise()

    return parseInt(result[0]?.count || '0')
  }

  private async getWeaviateCount(className: string): Promise<number> {
    const result = await weaviateClient.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do()

    return result.data.Aggregate[className]?.[0]?.meta?.count || 0
  }

  private addCheck(check: ConsistencyCheck) {
    this.report.checks.push(check)
    this.report.summary.totalChecks++
    this.report.summary[check.status === 'passed' ? 'passed' : check.status === 'warning' ? 'warnings' : 'failed']++
  }

  private generateReport() {
    console.log(chalk.blue('\n📋 Consistency Check Report'))
    console.log(chalk.blue('========================\n'))

    // Summary table
    const summaryTable = new Table({
      head: ['Metric', 'Value'],
      style: { head: ['cyan'] }
    })

    summaryTable.push(
      ['Total Checks', this.report.summary.totalChecks],
      ['Passed', chalk.green(this.report.summary.passed)],
      ['Warnings', chalk.yellow(this.report.summary.warnings)],
      ['Failed', chalk.red(this.report.summary.failed)]
    )

    console.log(summaryTable.toString())
    console.log()

    // Detailed results
    console.log(chalk.blue('Detailed Results:'))
    console.log(chalk.blue('----------------\n'))

    for (const check of this.report.checks) {
      const statusIcon = check.status === 'passed' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
      const statusColor = check.status === 'passed' ? chalk.green : check.status === 'warning' ? chalk.yellow : chalk.red

      console.log(`${statusIcon} ${chalk.white(check.name)}: ${statusColor(check.status.toUpperCase())}`)
      
      if (check.status !== 'passed') {
        console.log(chalk.gray(JSON.stringify(check.details, null, 2)))
        
        if (check.recommendations) {
          console.log(chalk.cyan('\n  Recommendations:'))
          check.recommendations.forEach(rec => {
            console.log(chalk.cyan(`  - ${rec}`))
          })
        }
      }
      console.log()
    }

    // Save report to file
    const reportPath = `consistency_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`
    require('fs').writeFileSync(reportPath, JSON.stringify(this.report, null, 2))
    console.log(chalk.blue(`\n📄 Full report saved to: ${reportPath}`))

    // Overall status
    const overallStatus = this.report.summary.failed > 0 ? 'CRITICAL' :
                         this.report.summary.warnings > 3 ? 'NEEDS ATTENTION' :
                         'HEALTHY'
    
    const statusColor = overallStatus === 'CRITICAL' ? chalk.red :
                       overallStatus === 'NEEDS ATTENTION' ? chalk.yellow :
                       chalk.green

    console.log(chalk.blue('\n🏁 Overall System Status: ') + statusColor(overallStatus))
  }
}

// Main execution
async function main() {
  const checker = new DataConsistencyChecker()

  try {
    await checker.runAllChecks()
  } catch (error) {
    console.error(chalk.red('\n❌ Consistency check failed:'), error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { DataConsistencyChecker }
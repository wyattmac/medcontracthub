#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function optimizeSupabaseBulk() {
  try {
    console.log('🔧 Optimizing Supabase for bulk operations...\n')

    // Check current database configuration
    console.log('📊 Checking current database settings...')
    
    // Check table statistics
    const { data: tableStats, error: statsError } = await supabase
      .rpc('get_table_stats', {})
      .select()

    if (!statsError && tableStats) {
      console.log('Database table statistics:')
      tableStats.forEach((stat: any) => {
        console.log(`- ${stat.table_name}: ${stat.n_tup_ins} inserts, ${stat.n_tup_upd} updates`)
      })
    }

    // Check index usage
    console.log('\n📈 Checking index usage...')
    const { data: indexStats, error: indexError } = await supabase.rpc('get_index_usage')

    if (!indexError && indexStats) {
      console.log('Most used indexes:')
      indexStats.slice(0, 10).forEach((idx: any) => {
        console.log(`- ${idx.indexname}: ${idx.idx_scan} scans`)
      })
    }

    // Optimize for bulk inserts by checking notice_id uniqueness constraint
    console.log('\n🔍 Checking for bulk insert optimizations...')
    
    const { data: constraints, error: constraintError } = await supabase
      .rpc('get_table_constraints', { table_name: 'opportunities' })

    if (!constraintError && constraints) {
      console.log('Current constraints on opportunities table:')
      constraints.forEach((constraint: any) => {
        console.log(`- ${constraint.constraint_name}: ${constraint.constraint_type}`)
      })
    }

    // Check connection pool settings
    console.log('\n🔗 Checking connection settings...')
    const { data: connections, error: connError } = await supabase
      .rpc('get_connection_info')

    if (!connError && connections) {
      console.log(`Active connections: ${connections[0]?.active_connections || 'N/A'}`)
      console.log(`Max connections: ${connections[0]?.max_connections || 'N/A'}`)
    }

    // Test bulk insert performance
    console.log('\n⚡ Testing bulk insert performance...')
    const testData = Array.from({ length: 100 }, (_, i) => ({
      notice_id: `test_bulk_${Date.now()}_${i}`,
      title: `Test Bulk Opportunity ${i}`,
      description: `Test description for bulk insert performance test ${i}`,
      agency: 'TEST AGENCY',
      posted_date: new Date().toISOString(),
      response_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active' as const
    }))

    const startTime = Date.now()
    const { data: insertResult, error: insertError } = await supabase
      .from('opportunities')
      .insert(testData)
      .select('id')

    if (insertError) {
      console.error('❌ Bulk insert test failed:', insertError)
    } else {
      const endTime = Date.now()
      console.log(`✅ Bulk inserted 100 records in ${endTime - startTime}ms`)
      console.log(`📊 Average: ${(endTime - startTime) / 100}ms per record`)

      // Clean up test data
      if (insertResult) {
        const testIds = insertResult.map(r => r.id)
        await supabase.from('opportunities').delete().in('id', testIds)
        console.log('🧹 Cleaned up test data')
      }
    }

    // Recommendations for bulk operations
    console.log('\n💡 Recommendations for optimal bulk operations:')
    console.log('1. Use batch inserts of 1000-5000 records at a time')
    console.log('2. Use upsert operations for updating existing records')
    console.log('3. Consider using COPY for very large datasets (>10k records)')
    console.log('4. Monitor connection pool usage during bulk operations')
    console.log('5. Use transactions for related bulk operations')

  } catch (error) {
    console.error('❌ Optimization check failed:', error)
  }
}

optimizeSupabaseBulk()
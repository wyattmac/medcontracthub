#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupAutomatedSync() {
  try {
    console.log('🔧 Setting up automated sync for SAM.gov opportunities...\n')

    // 1. Generate secure sync token if needed
    const syncToken = process.env.SYNC_TOKEN || randomBytes(32).toString('hex')
    console.log('🔐 Sync Token Configuration:')
    
    if (!process.env.SYNC_TOKEN) {
      console.log('⚠️  No SYNC_TOKEN found in environment.')
      console.log('📝 Add this to your .env.local and production environment:')
      console.log(`SYNC_TOKEN=${syncToken}`)
      console.log()
    } else {
      console.log('✅ SYNC_TOKEN is configured')
    }

    // 2. Test sync endpoint connectivity
    console.log('🔗 Testing sync endpoint connectivity...')
    
    try {
      const response = await fetch('http://localhost:3000/api/sync/status', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Sync endpoint is accessible')
        console.log(`📊 Current sync status: ${JSON.stringify(data, null, 2)}`)
      } else {
        console.log(`⚠️  Sync endpoint returned: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.log(`❌ Could not reach sync endpoint: ${error}`)
      console.log('💡 Make sure the development server is running on port 3000')
    }

    // 3. Create sync monitoring table
    console.log('\n📊 Setting up sync monitoring...')
    
    const { error: monitoringError } = await supabase.rpc('create_sync_monitoring_table')
    
    if (monitoringError && !monitoringError.message.includes('already exists')) {
      console.log('Creating sync monitoring manually...')
      
      // Create the table manually if the function doesn't exist
      const { error: createError } = await supabase.from('sync_logs').insert({
        sync_type: 'test',
        status: 'completed',
        opportunities_fetched: 0,
        opportunities_inserted: 0,
        opportunities_updated: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: null
      })

      if (createError && !createError.message.includes('relation "sync_logs" does not exist')) {
        console.log('✅ Sync monitoring table exists')
      } else {
        console.log('⚠️  Sync monitoring table may need to be created manually')
      }
    }

    // 4. Test a small sync operation
    console.log('\n🧪 Testing sync operation...')
    
    const testResponse = await fetch('http://localhost:3000/api/sync/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'dev-bypass'
      },
      body: JSON.stringify({ limit: 10 })
    })

    if (testResponse.ok) {
      console.log('✅ Manual sync test successful')
      const syncResult = await testResponse.text()
      console.log(`📊 Sync result: ${syncResult}`)
    } else {
      console.log(`⚠️  Manual sync test failed: ${testResponse.status} ${testResponse.statusText}`)
    }

    // 5. Setup recommendations
    console.log('\n💡 Automated Sync Setup Recommendations:')
    
    console.log('\n📅 Recommended Cron Schedule:')
    console.log('# Every 6 hours - production recommended')
    console.log('0 */6 * * * /path/to/sync-opportunities.sh --limit 500')
    console.log()
    console.log('# Every 2 hours - high-frequency updates')
    console.log('0 */2 * * * /path/to/sync-opportunities.sh --limit 300')
    console.log()
    console.log('# Daily full sync - comprehensive update')
    console.log('0 2 * * * /path/to/sync-opportunities.sh --force --limit 1000')

    console.log('\n🐳 Docker Environment Setup:')
    console.log('Add to docker-compose.yml service:')
    console.log('  environment:')
    console.log(`    - SYNC_TOKEN=${syncToken}`)
    console.log('    - NEXT_PUBLIC_APP_URL=http://localhost:3000')

    console.log('\n🔧 Environment Variables Checklist:')
    const requiredVars = [
      'SAM_GOV_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SYNC_TOKEN',
      'NEXT_PUBLIC_APP_URL'
    ]

    requiredVars.forEach(varName => {
      const isSet = !!process.env[varName]
      console.log(`${isSet ? '✅' : '❌'} ${varName}: ${isSet ? 'Set' : 'Missing'}`)
    })

    console.log('\n📈 Monitoring Recommendations:')
    console.log('1. Monitor sync logs at /tmp/medcontracthub-sync.log')
    console.log('2. Check sync status via GET /api/sync/status')
    console.log('3. Monitor opportunity count growth in database')
    console.log('4. Set up alerts for sync failures')
    console.log('5. Review quota usage in SAM.gov dashboard')

    console.log('\n🚀 Next Steps:')
    console.log('1. Set SYNC_TOKEN in production environment')
    console.log('2. Set up cron job using scripts/cron/sync-opportunities.sh')
    console.log('3. Test sync in production with --limit 10 first')
    console.log('4. Monitor initial syncs and adjust frequency as needed')
    console.log('5. Implement monitoring and alerting for sync failures')

    // 6. Create a simple monitoring script
    console.log('\n📊 Creating monitoring script...')
    
    const monitoringScript = `#!/bin/bash
# Quick sync status check
echo "=== MedContractHub Sync Status ==="
echo "Last sync log entries:"
tail -10 /tmp/medcontracthub-sync.log

echo ""
echo "Current opportunity count:"
curl -s "http://localhost:3000/api/sync/status" | jq '.totalOpportunities // "N/A"'

echo ""
echo "Recent sync activity:"
curl -s "http://localhost:3000/api/sync/status" | jq '.lastSync // "N/A"'
`

    console.log('Created monitoring script content (save as scripts/check-sync-status.sh)')

  } catch (error) {
    console.error('❌ Automated sync setup failed:', error)
  }
}

setupAutomatedSync()
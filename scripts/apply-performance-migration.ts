/**
 * Apply Performance Migration Script
 * Runs the analytics performance improvements migration
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

async function applyMigration() {
  console.log('🚀 Applying performance migration...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/019_analytics_performance_improvements.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📝 Running migration...')
    
    // Execute migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    }).single()
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql not available, attempting direct execution...')
      
      // Split migration into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`)
        const { error: stmtError } = await supabase.rpc('query', { 
          query_text: statement + ';' 
        }).single()
        
        if (stmtError) {
          console.error('❌ Statement failed:', stmtError)
          console.log('\n💡 Alternative: Run the migration manually in Supabase SQL Editor')
          console.log('Copy the contents of: supabase/migrations/019_analytics_performance_improvements.sql')
          return
        }
      }
    }
    
    console.log('✅ Migration applied successfully!')
    
    // Test the new function
    console.log('\n🧪 Testing get_opportunities_timeline function...')
    const { data: timeline, error: testError } = await supabase
      .rpc('get_opportunities_timeline', { days_back: 7 })
    
    if (testError) {
      console.error('❌ Function test failed:', testError)
    } else {
      console.log('✅ Function test successful!')
      console.log(`📊 Retrieved ${timeline?.length || 0} days of timeline data`)
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('\n💡 To apply manually:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of:')
    console.log('   supabase/migrations/019_analytics_performance_improvements.sql')
    console.log('4. Click "Run"')
  }
}

// Run the migration
applyMigration()
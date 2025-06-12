/**
 * Check opportunity data in database
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkOpportunities() {
  console.log('🔍 Checking opportunity data in database...\n')
  
  try {
    // Fetch some opportunities
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select('id, title, notice_id, solicitation_number, sam_url')
      .limit(5)
    
    if (error) {
      console.error('Error fetching opportunities:', error)
      return
    }
    
    if (!opportunities || opportunities.length === 0) {
      console.log('❌ No opportunities found in database')
      return
    }
    
    console.log(`Found ${opportunities.length} opportunities:\n`)
    
    opportunities.forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.title}`)
      console.log(`   ID: ${opp.id}`)
      console.log(`   Notice ID: ${opp.notice_id || 'NOT SET'}`)
      console.log(`   Solicitation: ${opp.solicitation_number || 'NOT SET'}`)
      console.log(`   SAM URL: ${opp.sam_url || 'NOT SET'}`)
      console.log(`   Has SAM.gov ID: ${!!opp.notice_id}`)
      console.log('')
    })
    
    // Count opportunities with and without notice IDs
    const { count: withNoticeId } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .not('notice_id', 'is', null)
    
    const { count: totalCount } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
    
    console.log('📊 Summary:')
    console.log(`   Total opportunities: ${totalCount}`)
    console.log(`   With SAM.gov notice ID: ${withNoticeId}`)
    console.log(`   Without notice ID: ${(totalCount || 0) - (withNoticeId || 0)}`)
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Run the check
checkOpportunities()
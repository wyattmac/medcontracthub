/**
 * Check if specific opportunity exists in database
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkOpportunity(opportunityId: string) {
  console.log(`🔍 Checking for opportunity: ${opportunityId}\n`)
  
  try {
    // First check if opportunity exists
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('❌ Opportunity not found in database')
        console.log(`   ID: ${opportunityId}`)
        
        // Let's check what opportunities do exist
        const { data: sampleOpps } = await supabase
          .from('opportunities')
          .select('id, title')
          .limit(5)
        
        console.log('\n📋 Sample opportunities in database:')
        sampleOpps?.forEach((opp, i) => {
          console.log(`   ${i + 1}. ${opp.title}`)
          console.log(`      ID: ${opp.id}`)
        })
      } else {
        console.error('Database error:', error)
      }
      return
    }
    
    if (opportunity) {
      console.log('✅ Opportunity found!')
      console.log(`   Title: ${opportunity.title}`)
      console.log(`   ID: ${opportunity.id}`)
      console.log(`   Notice ID: ${opportunity.notice_id}`)
      console.log(`   Agency: ${opportunity.agency}`)
      console.log(`   Status: ${opportunity.status}`)
      console.log(`   Created: ${opportunity.created_at}`)
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Check the specific opportunity
checkOpportunity('f9bbc315-17a5-441f-a025-00534b854ae9')
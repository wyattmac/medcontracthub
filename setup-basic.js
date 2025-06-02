const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://icxhwszgneovjzmqdjri.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeGh3c3pnbmVvdmp6bXFkanJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgzNDAwNywiZXhwIjoyMDY0NDEwMDA3fQ.6e3BDjww2YRm7F_cb1gPEDyZqIQ0qKwwManHTvFcMeg'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('🔌 Testing Supabase connection...')
  
  try {
    // Test basic connection by trying to access auth.users
    const { data, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }
    
    console.log('✅ Supabase connected successfully!')
    console.log(`📊 Found ${data.users.length} users in auth.users`)
    
    // Check if companies table exists
    const { data: tables, error: tableError } = await supabase
      .from('companies')
      .select('count')
      .limit(1)
    
    if (tableError) {
      console.log('⚠️ Companies table does not exist yet - need to run schema')
      console.log('📋 To setup the database:')
      console.log('   1. Go to https://supabase.com/dashboard/project/icxhwszgneovjzmqdjri/sql')
      console.log('   2. Copy and paste the contents of supabase/schema.sql')
      console.log('   3. Click "Run" to execute the schema')
      return false
    } else {
      console.log('✅ Database tables exist!')
      return true
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    return false
  }
}

async function addSampleData() {
  console.log('📊 Adding sample opportunities...')
  
  const sampleOpportunities = [
    {
      notice_id: 'SAMPLE_001',
      title: 'Medical Supplies for VA Hospital System',
      description: 'Procurement of medical supplies including surgical instruments, diagnostic equipment, and consumables for multiple VA hospital locations.',
      agency: 'Department of Veterans Affairs',
      sub_agency: 'Veterans Health Administration',
      posted_date: new Date().toISOString(),
      response_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      naics_code: '339112',
      naics_description: 'Surgical and Medical Instrument Manufacturing',
      place_of_performance_state: 'CA',
      place_of_performance_city: 'Los Angeles',
      set_aside_type: 'Small Business',
      contract_type: 'Fixed Price',
      estimated_value_min: 500000,
      estimated_value_max: 2000000,
      status: 'active',
      solicitation_number: 'VA-2024-001',
      sam_url: 'https://sam.gov/opp/sample001'
    },
    {
      notice_id: 'SAMPLE_002', 
      title: 'Diagnostic Equipment Maintenance Services',
      description: 'Comprehensive maintenance and repair services for diagnostic imaging equipment including MRI, CT, and X-ray machines.',
      agency: 'Department of Defense',
      sub_agency: 'Defense Health Agency',
      posted_date: new Date().toISOString(),
      response_deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      naics_code: '811219',
      naics_description: 'Other Electronic and Precision Equipment Repair and Maintenance',
      place_of_performance_state: 'TX',
      place_of_performance_city: 'San Antonio',
      set_aside_type: 'SDVOSB',
      contract_type: 'Cost Plus Fixed Fee',
      estimated_value_min: 1000000,
      estimated_value_max: 5000000,
      status: 'active',
      solicitation_number: 'DOD-2024-MED-002',
      sam_url: 'https://sam.gov/opp/sample002'
    }
  ]
  
  const { error } = await supabase
    .from('opportunities')
    .insert(sampleOpportunities)
  
  if (error) {
    console.warn('⚠️ Sample data insertion failed:', error.message)
  } else {
    console.log('✅ Sample opportunities added!')
  }
}

async function main() {
  const isConnected = await testConnection()
  
  if (isConnected) {
    await addSampleData()
    console.log('🎉 Setup complete! You can now use the app.')
  }
}

main()
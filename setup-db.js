const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://icxhwszgneovjzmqdjri.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeGh3c3pnbmVvdmp6bXFkanJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgzNDAwNywiZXhwIjoyMDY0NDEwMDA3fQ.6e3BDjww2YRm7F_cb1gPEDyZqIQ0qKwwManHTvFcMeg'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDatabase() {
  console.log('🗄️ Setting up database schema...')
  
  try {
    // Read the schema file
    const schema = fs.readFileSync('./supabase/schema.sql', 'utf8')
    
    // Execute the schema
    const { error } = await supabase.rpc('exec_sql', { sql: schema })
    
    if (error) {
      console.error('❌ Schema execution failed:', error)
      return
    }
    
    console.log('✅ Database schema created successfully!')
    
    // Insert some sample data
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
    
    const { error: oppError } = await supabase
      .from('opportunities')
      .insert(sampleOpportunities)
    
    if (oppError) {
      console.warn('⚠️ Sample data insertion failed:', oppError.message)
    } else {
      console.log('✅ Sample opportunities added!')
    }
    
    console.log('🎉 Database setup complete!')
    console.log('🚀 You can now use the app at http://localhost:3000')
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

setupDatabase()
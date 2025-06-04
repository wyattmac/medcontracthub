#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkProfile(email: string) {
  // Get user by email
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('Error listing users:', userError)
    return
  }

  const user = users.find(u => u.email === email)
  if (!user) {
    console.error(`User not found: ${email}`)
    return
  }

  console.log('User ID:', user.id)

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching profile:', profileError)
    return
  }

  console.log('Profile:', JSON.stringify(profile, null, 2))

  // Get company if exists
  if (profile.company_id) {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()

    if (companyError) {
      console.error('Error fetching company:', companyError)
    } else {
      console.log('Company:', JSON.stringify(company, null, 2))
    }
  }
}

const email = process.argv[2] || 'locklearwyatt@gmail.com'
checkProfile(email).catch(console.error)
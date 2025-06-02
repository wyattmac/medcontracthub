// Based on Context7 research: Supabase SSR authentication setup for Next.js
// Reference: /supabase/supabase - nextjs ssr authentication setup

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { ConfigurationError } from '@/lib/errors/types'
import { logger } from '@/lib/errors/logger'

// Validate environment variables at module load
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const error = new ConfigurationError(
    'Missing Supabase configuration. Please check your environment variables.',
    { missing: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].filter(
      key => !process.env[key]
    )}
  )
  logger.error('Supabase client configuration error', error)
  throw error
}

export function createClient() {
  try {
    const client = createBrowserClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            'x-client-info': 'medcontracthub-web'
          }
        },
        auth: {
          persistSession: true,
          detectSessionInUrl: true,
          autoRefreshToken: true
        },
        db: {
          schema: 'public'
        }
      }
    )
    
    return client
  } catch (error) {
    logger.error('Failed to create Supabase client', error)
    throw new ConfigurationError(
      'Failed to initialize Supabase client',
      { originalError: error }
    )
  }
}
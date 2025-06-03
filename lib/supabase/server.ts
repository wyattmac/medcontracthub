// Based on Context7 research: Supabase SSR authentication setup for Next.js
// Reference: /supabase/supabase - nextjs ssr authentication setup

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { ConfigurationError, DatabaseError } from '@/lib/errors/types'
import { dbLogger } from '@/lib/errors/logger'

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
  dbLogger.error('Supabase server configuration error', error)
  throw error
}

export async function createClient() {
  try {
    const cookieStore = await cookies()

    const client = createServerClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: any[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }: any) => {
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
              dbLogger.debug('Cookie set error in server component', { error })
            }
          }
        },
        global: {
          headers: {
            'x-client-info': 'medcontracthub-server'
          }
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true
        },
        db: {
          schema: 'public'
        }
      }
    )

    // Test database connection
    const { error: pingError } = await client
      .from('profiles')
      .select('count')
      .limit(1)
      .maybeSingle()

    if (pingError) {
      dbLogger.warn('Database connection test failed', { error: pingError })
    }

    return client
  } catch (error) {
    dbLogger.error('Failed to create Supabase server client', error)
    throw new DatabaseError(
      'Failed to initialize database connection',
      undefined,
      { originalError: error }
    )
  }
}

// Service role client for admin operations
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    throw new ConfigurationError(
      'Missing SUPABASE_SERVICE_ROLE_KEY for service operations'
    )
  }

  try {
    return createServerClient<Database>(
      supabaseUrl!,
      serviceRoleKey!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {}
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            'x-client-info': 'medcontracthub-service'
          }
        }
      }
    )
  } catch (error) {
    dbLogger.error('Failed to create service client', error)
    throw new DatabaseError(
      'Failed to initialize service client',
      undefined,
      { originalError: error }
    )
  }
}
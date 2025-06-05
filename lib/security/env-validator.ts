import { z } from 'zod'

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().startsWith('https://'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(40),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  
  // External APIs
  SAM_GOV_API_KEY: z.string().min(20),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  MISTRAL_API_KEY: z.string().optional(),
  
  // Email Configuration
  FROM_EMAIL: z.string().email(),
  FROM_NAME: z.string().default('MedContractHub'),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url(),
  
  // Security
  CSRF_SECRET: z.string().min(32),
  
  // Optional OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

// Cached environment after validation
let cachedEnv: Env | undefined

/**
 * Validates and returns environment variables
 * Throws detailed errors in development, generic errors in production
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv
  
  try {
    cachedEnv = envSchema.parse(process.env)
    return cachedEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'))
      
      const invalid = error.errors
        .filter(err => err.code !== 'invalid_type' || err.received !== 'undefined')
        .map(err => `${err.path.join('.')}: ${err.message}`)
      
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Environment validation failed:')
        if (missing.length > 0) {
          console.error('Missing variables:', missing.join(', '))
        }
        if (invalid.length > 0) {
          console.error('Invalid variables:', invalid.join(', '))
        }
        throw new Error(`Environment validation failed. Check console for details.`)
      } else {
        // In production, don't expose details
        throw new Error('Server configuration error')
      }
    }
    throw error
  }
}

/**
 * Type-safe environment variable access
 */
export const env = new Proxy({} as Env, {
  get(_, key: string) {
    const validatedEnv = getEnv()
    return validatedEnv[key as keyof Env]
  }
})

// Alias for backward compatibility
export { getEnv as validateEnvironment }

// Validate on module load in development
if (process.env.NODE_ENV === 'development') {
  getEnv()
}
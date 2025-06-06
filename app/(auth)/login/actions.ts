// Based on Context7 research: Supabase server actions for authentication
// Reference: /supabase/supabase - nextjs ssr authentication setup

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  console.log('[Login Action] Starting login process...')
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // Developer bypass - skip authentication in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Login Action] Development mode - bypassing authentication')
    redirect('/dashboard')
    return
  }
  
  // Early validation
  if (!email || !password) {
    console.error('[Login Action] Missing email or password')
    redirect('/login?error=' + encodeURIComponent('Email and password are required'))
    return
  }
  
  console.log('[Login Action] Attempting login for:', email)
  
  try {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[Login Action] Login failed:', error.message)
      redirect('/login?error=' + encodeURIComponent(error.message))
      return
    }

    console.log('[Login Action] Login successful for:', data.user?.email)
    
    // Check if user has completed onboarding
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', data.user.id)
      .single()
    
    revalidatePath('/', 'layout')
    
    // Redirect to onboarding if profile doesn't have a company_id
    if (!profile || profileError || !profile?.company_id) {
      console.log('[Login Action] User needs to complete onboarding')
      redirect('/onboarding')
    }
    
    redirect('/dashboard')
  } catch (error: any) {
    // Handle Next.js redirect (not an actual error)
    if (error?.digest?.includes('NEXT_REDIRECT')) {
      throw error
    }
    console.error('[Login Action] Unexpected error:', error)
    redirect('/login?error=' + encodeURIComponent('An unexpected error occurred'))
  }
}

export async function signup(formData: FormData) {
  console.log('[Signup Action] Starting signup process...')
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // Early validation
  if (!email || !password) {
    console.error('[Signup Action] Missing email or password')
    redirect('/signup?error=' + encodeURIComponent('Email and password are required'))
    return
  }
  
  console.log('[Signup Action] Attempting signup for:', email)
  
  try {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error('[Signup Action] Signup failed:', error.message)
      redirect('/signup?error=' + encodeURIComponent(error.message))
      return
    }

    console.log('[Signup Action] Signup successful for:', data.user?.email)
    revalidatePath('/', 'layout')
    redirect('/onboarding')
  } catch (error: any) {
    // Handle Next.js redirect (not an actual error)
    if (error?.digest?.includes('NEXT_REDIRECT')) {
      throw error
    }
    console.error('[Signup Action] Unexpected error:', error)
    redirect('/signup?error=' + encodeURIComponent('An unexpected error occurred'))
  }
}
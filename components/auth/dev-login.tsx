/**
 * Development Login Component
 * For testing purposes - bypasses real authentication
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Zap } from 'lucide-react'

export function DevLogin() {
  const [email, setEmail] = useState('dev@medcontracthub.com')
  const [password, setPassword] = useState('devpassword123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Try to sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        // If sign in fails, try to sign up
        console.log('Sign in failed, trying sign up:', signInError.message)
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: 'Dev User'
            }
          }
        })

        if (signUpError) {
          setError(`Login/Signup failed: ${signUpError.message}`)
          return
        }

        if (signUpData.user) {
          // User created, now create profile and company
          await createDevProfile(signUpData.user.id)
          router.push('/dashboard')
        }
      } else {
        // Sign in successful
        console.log('Sign in successful')
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const createDevProfile = async (userId: string) => {
    try {
      // Create company first
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: 'Dev Medical Supplies',
          description: 'Development medical equipment company',
          address_line1: '123 Dev Street',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94105',
          phone: '555-0123',
          website: 'https://dev.example.com',
          naics_codes: ['339112', '423450'],
          certifications: ['small_business'],
          ein: '12-3456789',
          duns_number: '123456789',
          cage_code: 'DEV123'
        })
        .select()
        .single()

      if (companyError) {
        console.error('Company creation error:', companyError)
        return
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: company.id,
          full_name: 'Dev User',
          title: 'Developer',
          phone: '555-0123',
          role: 'admin',
          onboarding_completed: true,
          email_notifications: true
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }

      console.log('Dev profile created successfully')
    } catch (err) {
      console.error('Profile creation error:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Zap className="h-8 w-8 text-blue-600 mr-2" />
            <span 
              className="text-2xl font-bold"
              style={{
                background: 'linear-gradient(to right, #2563eb, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              MedContractHub
            </span>
          </div>
          <CardTitle className="text-2xl">Development Login</CardTitle>
          <p className="text-muted-foreground">
            Quick access for development and testing
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@medcontracthub.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In / Sign Up'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Development Mode</p>
            <p>Auto-creates test data if user doesn't exist</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
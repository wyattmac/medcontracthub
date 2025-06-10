/**
 * Mock Login Component
 * For development without Supabase - creates mock user session
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Zap, User } from 'lucide-react'

export function MockLogin() {
  const [email, setEmail] = useState('dev@medcontracthub.com')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleMockLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Simulate login process
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create mock user session in localStorage for development
    const mockUser = {
      id: 'mock-user-id',
      email,
      user_metadata: {
        full_name: 'Dev User'
      },
      created_at: new Date().toISOString(),
      app_metadata: {},
      aud: 'authenticated'
    }

    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'bearer',
      user: mockUser
    }

    // Store in localStorage for the mock auth to pick up
    localStorage.setItem('mock-auth-session', JSON.stringify(mockSession))
    localStorage.setItem('mock-auth-user', JSON.stringify(mockUser))
    
    // Also set a cookie for middleware to recognize
    document.cookie = `mock-auth-session=${encodeURIComponent(JSON.stringify(mockSession))}; path=/; max-age=3600`
    document.cookie = `mock-auth-user=${encodeURIComponent(JSON.stringify(mockUser))}; path=/; max-age=3600`

    // Trigger a page reload to initialize the mock session
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-blue-600 mr-2" />
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
          <CardTitle className="text-2xl">Mock Development Login</CardTitle>
          <p className="text-muted-foreground">
            Bypass authentication for development testing
          </p>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-blue-200 bg-blue-50">
            <Zap className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Development Mode:</strong> This creates a mock user session without requiring Supabase authentication.
            </AlertDescription>
          </Alert>
          
          <form onSubmit={handleMockLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email (Mock)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dev@medcontracthub.com"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Any valid email format will work
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Mock Session...' : 'Enter Development Mode'}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <div className="border-t pt-4">
              <p className="font-medium">Mock Development Features:</p>
              <ul className="text-xs space-y-1 mt-2">
                <li>• Bypasses Supabase authentication</li>
                <li>• Creates mock user and company data</li>
                <li>• Full access to all dashboard features</li>
                <li>• SAM.gov API quota management active</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
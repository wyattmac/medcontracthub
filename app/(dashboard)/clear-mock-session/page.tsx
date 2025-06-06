'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

export default function ClearMockSessionPage() {
  const router = useRouter()

  const clearMockSession = () => {
    // Clear mock session from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mock-auth-session')
      localStorage.removeItem('mock-user-profile')
      
      // Also clear any cached data
      sessionStorage.clear()
      
      // Redirect to login page
      router.push('/login')
    }
  }

  const continueWithMock = () => {
    router.push('/opportunities')
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Switch to Real Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You are currently viewing mock data. To see real opportunities from SAM.gov:
          </p>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Clear mock session and log in</p>
                <p className="text-sm text-muted-foreground">
                  This will remove the mock session and redirect you to the login page where you can authenticate with Supabase
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Button onClick={clearMockSession} className="flex-1">
              Clear Mock Session & Log In
            </Button>
            <Button onClick={continueWithMock} variant="outline" className="flex-1">
              Continue with Mock Data
            </Button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> To see real SAM.gov opportunities, you need:
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-2">
              <li>A valid Supabase account</li>
              <li>SAM.gov API credentials configured</li>
              <li>To complete the onboarding process</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
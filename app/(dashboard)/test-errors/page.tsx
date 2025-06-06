'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api/error-interceptor'
import { useError } from '@/providers/error-provider'
import { AlertCircle, Bug, Zap, Database, Shield, Globe, RefreshCcw } from 'lucide-react'

export default function TestErrorsPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<any>(null)
  const { reportError } = useError()
  
  const testError = async (type: string) => {
    setIsLoading(type)
    setLastResponse(null)
    
    try {
      const response = await api.get(
        `/api/test-error?type=${type}&throwError=true`
      )
      setLastResponse(response)
    } catch (error) {
      // Error is already handled by interceptor
      console.log('Error caught:', error)
    } finally {
      setIsLoading(null)
    }
  }
  
  const testComponentError = () => {
    throw new Error('Test component error - this should be caught by error boundary')
  }
  
  const testManualError = () => {
    const error = new Error('Manually reported error for testing')
    reportError(error, {
      component: 'TestErrorsPage',
      action: 'manual-test',
      customData: { timestamp: new Date().toISOString() }
    })
  }
  
  const errorTypes = [
    {
      type: 'validation',
      title: 'Validation Error',
      description: 'Simulates form validation failures',
      icon: AlertCircle,
      color: 'text-yellow-500'
    },
    {
      type: 'auth',
      title: 'Authentication Error',
      description: 'Simulates unauthorized access',
      icon: Shield,
      color: 'text-red-500'
    },
    {
      type: 'database',
      title: 'Database Error',
      description: 'Simulates Supabase connection issues',
      icon: Database,
      color: 'text-orange-500'
    },
    {
      type: 'external',
      title: 'External API Error',
      description: 'Simulates SAM.gov API failures',
      icon: Globe,
      color: 'text-purple-500'
    },
    {
      type: 'rate-limit',
      title: 'Rate Limit Error',
      description: 'Simulates API rate limiting',
      icon: Zap,
      color: 'text-blue-500'
    },
    {
      type: 'unknown',
      title: 'Unknown Error',
      description: 'Simulates unexpected errors',
      icon: Bug,
      color: 'text-gray-500'
    }
  ]
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Error Handling Test Page</h1>
        <p className="text-muted-foreground">
          Test different error scenarios to see the enhanced error handling in action
        </p>
      </div>
      
      <Alert className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Development Mode</AlertTitle>
        <AlertDescription>
          Enhanced error details are only shown in development. In production, users see friendly messages.
        </AlertDescription>
      </Alert>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {errorTypes.map(({ type, title, description, icon: Icon, color }) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => testError(type)}
                disabled={isLoading === type}
                className="w-full"
                variant="outline"
              >
                {isLoading === type ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  `Trigger ${title}`
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Component Error Boundary Test</CardTitle>
            <CardDescription>
              This will throw an error that should be caught by the error boundary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testComponentError}
              variant="destructive"
              className="w-full"
            >
              Throw Component Error
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Manual Error Reporting</CardTitle>
            <CardDescription>
              Report an error manually with custom context
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testManualError}
              variant="outline"
              className="w-full"
            >
              Report Manual Error
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {lastResponse && (
        <Card>
          <CardHeader>
            <CardTitle>Last Successful Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto p-4 bg-muted rounded">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
      
      <div className="mt-8 p-4 border rounded-lg bg-muted/50">
        <h3 className="font-semibold mb-2">💡 Tips for Testing</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Open the browser console to see detailed error logs</li>
          <li>Check the Network tab to see API error responses</li>
          <li>Try the visual debugging buttons in the error boundary</li>
          <li>Test rate limiting by clicking the same error multiple times quickly</li>
          <li>The error boundary will show debugging hints and suggested actions</li>
        </ul>
      </div>
    </div>
  )
}
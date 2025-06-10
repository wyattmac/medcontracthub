'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestButtonsPage() {
  const testToast = (type: string) => {
    console.log(`Testing ${type} toast`)
    
    switch (type) {
      case 'success':
        toast.success('Success!', {
          description: 'This is a success toast notification'
        })
        break
      case 'error':
        toast.error('Error!', {
          description: 'This is an error toast notification'
        })
        break
      case 'info':
        toast.info('Info!', {
          description: 'This is an info toast notification'
        })
        break
      default:
        toast('Default toast notification')
    }
  }

  const testButtonClick = async (buttonType: string) => {
    try {
      const response = await fetch('/api/test-button-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buttonType })
      })
      
      const result = await response.json()
      toast.success('Button API Test', {
        description: result.message
      })
    } catch {
      toast.error('API Error', {
        description: 'Failed to call test API'
      })
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Button & Toast Test Page</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Toast Notifications Test</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <Button onClick={() => testToast('success')} variant="default">
              Success Toast
            </Button>
            <Button onClick={() => testToast('error')} variant="destructive">
              Error Toast
            </Button>
            <Button onClick={() => testToast('info')} variant="secondary">
              Info Toast
            </Button>
            <Button onClick={() => testToast('default')} variant="outline">
              Default Toast
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Button Click Test</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <Button onClick={() => testButtonClick('save')} variant="default">
              Test Save Button
            </Button>
            <Button onClick={() => testButtonClick('proposal')} variant="secondary">
              Test Proposal Button
            </Button>
            <Button onClick={() => testButtonClick('analyze')} variant="outline">
              Test Analyze Button
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Console Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Open browser console to see click events
            </p>
            <Button 
              onClick={() => {
                console.log('Button clicked!', new Date().toISOString())
                alert('Button clicked! Check console.')
              }}
              variant="outline"
            >
              Console Log Test
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
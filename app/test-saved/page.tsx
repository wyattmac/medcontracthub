/**
 * Test page to debug saved opportunities
 */

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mockSavedOpportunitiesStore } from '@/lib/mock/saved-opportunities-store'
import { useMockAuth } from '@/components/auth/mock-auth-provider'

export default function TestSavedPage() {
  const { user } = useMockAuth()
  const [savedOpps, setSavedOpps] = useState<any[]>([])
  const [rawData, setRawData] = useState<string>('')

  const loadData = () => {
    if (user?.id) {
      const opps = mockSavedOpportunitiesStore.getAll(user.id)
      setSavedOpps(opps)
      
      // Get raw localStorage data
      const raw = localStorage.getItem('mock_saved_opportunities')
      setRawData(raw || 'No data found')
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  const addTestOpportunity = () => {
    if (user?.id) {
      const testOpp = {
        id: `test-${Date.now()}`,
        title: `Test Opportunity ${new Date().toLocaleTimeString()}`,
        solicitation_number: 'TEST-2024-001',
        description: 'This is a test opportunity for debugging',
        response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        estimated_value_max: 100000
      }
      
      mockSavedOpportunitiesStore.save(user.id, testOpp.id, testOpp)
      loadData()
    }
  }

  const clearAll = () => {
    if (window.confirm('Clear all saved opportunities?')) {
      localStorage.removeItem('mock_saved_opportunities')
      loadData()
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Saved Opportunities Debug Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Current User ID: {user?.id || 'Not logged in'}</p>
            <p className="text-sm text-muted-foreground">Number of saved opportunities: {savedOpps.length}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">Reload Data</Button>
            <Button onClick={addTestOpportunity} variant="outline">Add Test Opportunity</Button>
            <Button onClick={clearAll} variant="destructive">Clear All</Button>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Saved Opportunities:</h3>
            {savedOpps.length === 0 ? (
              <p className="text-muted-foreground">No saved opportunities found</p>
            ) : (
              savedOpps.map((opp, index) => (
                <Card key={opp.id}>
                  <CardContent className="p-4">
                    <p className="font-medium">#{index + 1}</p>
                    <p className="text-sm">ID: {opp.opportunity_id}</p>
                    <p className="text-sm">Created: {new Date(opp.created_at).toLocaleString()}</p>
                    <p className="text-sm">Has opportunity data: {opp.opportunity ? 'Yes' : 'No'}</p>
                    {opp.opportunity && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <p>Title: {opp.opportunity.title || 'No title'}</p>
                        <p>Solicitation: {opp.opportunity.solicitation_number || 'No number'}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Raw localStorage Data:</h3>
            <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-64">
              {rawData}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
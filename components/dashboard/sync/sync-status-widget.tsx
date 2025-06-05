/**
 * Sync Status Widget - Display sync status and manual trigger
 */

'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  RefreshCw, 
  Database, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { formatDistanceToNow } from 'date-fns'

export function SyncStatusWidget() {
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch sync status
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const response = await fetch('/api/sync/status')
      if (!response.ok) {
        throw new Error('Failed to fetch sync status')
      }
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000 // Check every 5 minutes
  })

  const handleManualSync = async () => {
    setIsManualSyncing(true)
    
    try {
      const response = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }) // Smaller limit for manual sync
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Sync completed',
          description: `${result.stats.inserted} new, ${result.stats.updated} updated`,
          variant: 'default'
        })
        // Refresh sync status and opportunities list
        queryClient.invalidateQueries({ queryKey: ['sync-status'] })
        queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      } else {
        toast({
          title: 'Sync failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Manual sync error:', error)
      toast({
        title: 'Sync failed',
        description: 'Please try again',
        variant: 'destructive'
      })
    } finally {
      setIsManualSyncing(false)
    }
  }

  if (isLoading) {
    return <SyncStatusWidgetSkeleton />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'running': return 'text-blue-600 bg-blue-50'
      case 'failed': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return CheckCircle
      case 'running': return RefreshCw
      case 'failed': return AlertTriangle
      default: return Clock
    }
  }

  const lastSync = syncStatus?.lastSync
  const nextSync = syncStatus?.nextSync
  const isRunning = syncStatus?.status === 'running'
  const StatusIcon = getStatusIcon(syncStatus?.status || 'unknown')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Sync
          </div>
          <Badge className={getStatusColor(syncStatus?.status || 'unknown')}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {syncStatus?.status || 'Unknown'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sync Statistics */}
        {syncStatus?.lastSyncStats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-semibold text-green-600">
                {syncStatus.lastSyncStats.inserted || 0}
              </div>
              <div className="text-xs text-muted-foreground">New</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-semibold text-blue-600">
                {syncStatus.lastSyncStats.updated || 0}
              </div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
          </div>
        )}

        {/* Sync Timing */}
        <div className="space-y-2 text-sm">
          {lastSync && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last sync:</span>
              <span>{formatDistanceToNow(new Date(lastSync), { addSuffix: true })}</span>
            </div>
          )}
          
          {nextSync && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Next sync:</span>
              <span>{formatDistanceToNow(new Date(nextSync), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {syncStatus?.status === 'failed' && syncStatus?.lastError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Last sync failed: {syncStatus.lastError}
            </AlertDescription>
          </Alert>
        )}

        {/* Running Status */}
        {isRunning && (
          <Alert>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-xs">
              Sync in progress... New opportunities are being fetched from SAM.gov.
            </AlertDescription>
          </Alert>
        )}

        {/* Manual Sync Button */}
        <Button 
          onClick={handleManualSync}
          disabled={isManualSyncing || isRunning}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isManualSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Manual Sync
            </>
          )}
        </Button>

        {/* Quick Stats */}
        {syncStatus?.totalOpportunities && (
          <div className="text-center pt-2 border-t">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>{syncStatus.totalOpportunities.toLocaleString()} total opportunities</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SyncStatusWidgetSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="h-12 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-8 w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  )
}
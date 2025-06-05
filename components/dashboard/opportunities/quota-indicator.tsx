/**
 * Simple SAM.gov Quota Indicator
 * Shows remaining API calls and warnings
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Zap, AlertTriangle, Info } from 'lucide-react'

interface QuotaIndicatorProps {
  quotaStatus?: {
    remaining: number
    total: number
    warningThreshold?: number
  }
}

export function QuotaIndicator({ quotaStatus }: QuotaIndicatorProps) {
  if (!quotaStatus) return null

  const { remaining, total, warningThreshold = 200 } = quotaStatus
  const used = total - remaining
  const usagePercent = (used / total) * 100
  
  const isWarning = remaining <= warningThreshold
  const isCritical = remaining <= 50

  if (isCritical) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>API Quota Critical:</strong> Only {remaining} SAM.gov API calls remaining today. 
          Using cached data when possible.
        </AlertDescription>
      </Alert>
    )
  }

  if (isWarning) {
    return (
      <Alert className="mb-4 border-yellow-200 bg-yellow-50">
        <Info className="h-4 w-4 text-yellow-600" />
        <AlertDescription>
          <strong>API Quota Low:</strong> {remaining} SAM.gov API calls remaining today. 
          Results may be cached to preserve quota.
        </AlertDescription>
      </Alert>
    )
  }

  // Show compact indicator for normal usage
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
      <Zap className="h-3 w-3" />
      <span>API Quota: {remaining.toLocaleString()} remaining</span>
      <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${Math.max(0, 100 - usagePercent)}%` }}
        />
      </div>
    </div>
  )
}
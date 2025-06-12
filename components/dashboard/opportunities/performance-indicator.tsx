/**
 * Performance Indicator Component
 * Shows real-time performance metrics for development
 */

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity } from 'lucide-react'

export function PerformanceIndicator() {
  const [loadTime, setLoadTime] = useState<number | null>(null)
  
  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return
    
    const startTime = performance.now()
    
    // Measure initial load time
    const measureLoadTime = () => {
      const endTime = performance.now()
      setLoadTime(Math.round(endTime - startTime))
    }
    
    // Check if page is already loaded
    if (document.readyState === 'complete') {
      measureLoadTime()
    } else {
      window.addEventListener('load', measureLoadTime)
      return () => window.removeEventListener('load', measureLoadTime)
    }
  }, [])
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development' || !loadTime) return null
  
  const getPerformanceColor = (time: number) => {
    if (time < 1000) return 'text-green-600'
    if (time < 2000) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  return (
    <Badge variant="outline" className="fixed bottom-4 right-4 z-50">
      <Activity className={`h-3 w-3 mr-1 ${getPerformanceColor(loadTime)}`} />
      <span className={getPerformanceColor(loadTime)}>
        {(loadTime / 1000).toFixed(2)}s
      </span>
    </Badge>
  )
}
'use client'

import dynamic from 'next/dynamic'
import { AnalyticsDashboardSkeleton } from './analytics-skeleton'

// Lazy load heavy components with SSR disabled
export const AnalyticsDashboard = dynamic(
  () => import('@/components/dashboard/analytics/analytics-dashboard').then(mod => ({ default: mod.AnalyticsDashboard })),
  {
    loading: () => <AnalyticsDashboardSkeleton />,
    ssr: false // Disable SSR for chart components
  }
)

export const AnalyticsFilters = dynamic(
  () => import('@/components/dashboard/analytics/analytics-filters').then(mod => ({ default: mod.AnalyticsFilters })),
  {
    loading: () => <div className="h-20 bg-gray-100 animate-pulse rounded" />,
    ssr: false
  }
)
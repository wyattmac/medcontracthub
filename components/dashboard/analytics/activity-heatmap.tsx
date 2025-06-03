/**
 * Activity Heatmap Component
 * Shows user activity patterns over time (future enhancement)
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

interface IActivityHeatmapProps {
  data?: any
}

export function ActivityHeatmap({ data }: IActivityHeatmapProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity Heatmap
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Coming soon - Visual representation of your daily activity patterns
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-lg">
          <div className="text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Activity heatmap visualization</p>
            <p className="text-xs">Will show daily engagement patterns</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
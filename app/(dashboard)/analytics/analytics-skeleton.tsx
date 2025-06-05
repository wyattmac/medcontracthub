import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AnalyticsDashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mb-2" />
            <div className="h-3 w-32 bg-gray-200 animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
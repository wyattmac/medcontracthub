/**
 * NAICS Distribution Chart Component
 * Shows top industry sectors as a horizontal bar chart
 */

'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface INAICSDistributionData {
  code: string
  count: number
  name: string
}

interface INAICSDistributionChartProps {
  data: INAICSDistributionData[]
}

export function NAICSDistributionChart({ data }: INAICSDistributionChartProps) {
  // Process data for chart - limit to top 8 for readability
  const chartData = data
    .slice(0, 8)
    .map(item => ({
      name: truncateName(item.name, 25),
      fullName: item.name,
      code: item.code,
      count: item.count,
      percentage: Math.round((item.count / data.reduce((sum, d) => sum + d.count, 0)) * 100)
    }))
    .reverse() // Reverse for better visual hierarchy in horizontal chart

  const totalOpportunities = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-center">
        <div className="text-lg font-semibold">{data.length}</div>
        <div className="text-xs text-muted-foreground">Industry Sectors</div>
      </div>

      {/* Chart */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="horizontal"
            margin={{
              top: 5,
              right: 30,
              left: 5,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              type="number"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip content={<CustomTooltip totalOpportunities={totalOpportunities} />} />
            <Bar 
              dataKey="count" 
              fill="#8884d8"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 3 Legend */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Top Sectors
        </div>
        {data.slice(0, 3).map((item, index) => (
          <div key={item.code} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground text-xs font-medium rounded">
                {index + 1}
              </div>
              <span className="truncate">{truncateName(item.name, 30)}</span>
            </div>
            <div className="text-muted-foreground">
              {item.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label, totalOpportunities }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const percentage = Math.round((data.count / totalOpportunities) * 100)
    
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
        <p className="font-medium text-gray-900 mb-2">{data.fullName}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">NAICS Code:</span>
            <span className="font-medium">{data.code}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">Opportunities:</span>
            <span className="font-medium">{data.count}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">Percentage:</span>
            <span className="font-medium">{percentage}%</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name
  return name.substring(0, maxLength - 3) + '...'
}
/**
 * Status Distribution Chart Component
 * Shows opportunity status breakdown as a pie chart
 */

'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

interface IStatusDistributionChartProps {
  data: Record<string, number>
  total: number
}

// Color palette for different statuses
const STATUS_COLORS: Record<string, string> = {
  'active': '#22c55e',
  'posted': '#3b82f6', 
  'archived': '#6b7280',
  'awarded': '#f59e0b',
  'cancelled': '#ef4444',
  'upcoming': '#8b5cf6',
  'unknown': '#9ca3af'
}

const STATUS_LABELS: Record<string, string> = {
  'active': 'Active',
  'posted': 'Posted', 
  'archived': 'Archived',
  'awarded': 'Awarded',
  'cancelled': 'Cancelled',
  'upcoming': 'Upcoming',
  'unknown': 'Unknown'
}

export function StatusDistributionChart({ data, total }: IStatusDistributionChartProps) {
  // Process data for chart
  const chartData = Object.entries(data)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      percentage: Math.round((count / total) * 100),
      color: STATUS_COLORS[status] || STATUS_COLORS.unknown
    }))
    .sort((a, b) => b.value - a.value) // Sort by count descending

  // Calculate total for verification
  const chartTotal = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-center">
        <div className="text-lg font-semibold">{total.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">Total Opportunities</div>
      </div>

      {/* Chart */}
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Status Breakdown
        </div>
        <div className="grid grid-cols-1 gap-2">
          {chartData.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{item.value}</span>
                <span className="text-xs">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {chartData.length > 0 && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Key Insight
          </div>
          <div className="text-sm">
            <strong>{chartData[0].name}</strong> opportunities make up the largest segment 
            at <strong>{chartData[0].percentage}%</strong> of all opportunities.
          </div>
        </div>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-medium text-gray-900">{data.name}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">Count:</span>
            <span className="font-medium">{data.value.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">Percentage:</span>
            <span className="font-medium">{data.percentage}%</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
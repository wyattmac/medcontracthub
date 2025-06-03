/**
 * Performance Chart Component
 * Shows daily activity patterns using a combination chart
 */

'use client'

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'

interface IPerformanceData {
  date: string
  saved: number
  analyses: number
}

interface IPerformanceChartProps {
  data: IPerformanceData[]
  totalSaved: number
  totalAnalyses: number
}

export function PerformanceChart({ data, totalSaved, totalAnalyses }: IPerformanceChartProps) {
  // Process data for chart
  const chartData = data.map(item => ({
    date: item.date,
    formattedDate: formatDateForDisplay(item.date),
    saved: item.saved,
    analyses: item.analyses,
    total: item.saved + item.analyses
  }))

  // Calculate statistics
  const avgSavedPerDay = totalSaved / data.length
  const avgAnalysesPerDay = totalAnalyses / data.length
  const maxActivity = Math.max(...chartData.map(d => d.total))

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-blue-600">{totalSaved}</div>
          <div className="text-xs text-muted-foreground">Total Saved</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-green-600">{totalAnalyses}</div>
          <div className="text-xs text-muted-foreground">Total Analyses</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-purple-600">{Math.round((avgSavedPerDay + avgAnalysesPerDay) * 10) / 10}</div>
          <div className="text-xs text-muted-foreground">Avg Daily Activity</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              bottom: 20,
              left: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Bar 
              dataKey="saved" 
              fill="#3b82f6" 
              name="Saved Opportunities"
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="analyses" 
              fill="#10b981" 
              name="AI Analyses"
              radius={[2, 2, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
              name="Total Activity"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Saved:</span>
            </div>
            <span className="font-medium">{data.saved}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Analyses:</span>
            </div>
            <span className="font-medium">{data.analyses}</span>
          </div>
          <div className="pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-purple-600">Total Activity:</span>
              <span className="font-medium text-purple-600">{data.total}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function formatDateForDisplay(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return format(date, 'MMM d')
  } catch (error) {
    return dateString
  }
}
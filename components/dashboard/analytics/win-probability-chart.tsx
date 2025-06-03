/**
 * Win Probability Chart Component
 * Shows distribution of AI-calculated win probabilities
 */

'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface IWinProbabilityData {
  min: number
  max: number
  label: string
  count: number
}

interface IWinProbabilityChartProps {
  data: IWinProbabilityData[]
  avgWinProbability: number
}

export function WinProbabilityChart({ data, avgWinProbability }: IWinProbabilityChartProps) {
  // Process data for chart
  const chartData = data.map(item => ({
    ...item,
    percentage: item.count > 0 ? Math.round((item.count / data.reduce((sum, d) => sum + d.count, 0)) * 100) : 0
  }))

  const totalAnalyses = data.reduce((sum, item) => sum + item.count, 0)
  const highProbabilityCount = data.filter(item => item.min >= 61).reduce((sum, item) => sum + item.count, 0)
  const highProbabilityPercentage = totalAnalyses > 0 ? Math.round((highProbabilityCount / totalAnalyses) * 100) : 0

  // Determine color based on probability range
  const getBarColor = (min: number) => {
    if (min >= 81) return '#22c55e' // Green - very high
    if (min >= 61) return '#84cc16' // Light green - high  
    if (min >= 41) return '#f59e0b' // Orange - medium
    if (min >= 21) return '#f97316' // Red-orange - low
    return '#ef4444' // Red - very low
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-blue-600">
            {avgWinProbability.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">Average Win Rate</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-green-600">
            {highProbabilityPercentage}%
          </div>
          <div className="text-xs text-muted-foreground">High Probability (60%+)</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip totalAnalyses={totalAnalyses} />} />
            <Bar 
              dataKey="count" 
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(entry.min)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        {/* Probability Ranges Legend */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Probability Ranges
          </div>
          <div className="grid grid-cols-1 gap-1">
            {[
              { range: '81-100%', color: '#22c55e', label: 'Very High' },
              { range: '61-80%', color: '#84cc16', label: 'High' },
              { range: '41-60%', color: '#f59e0b', label: 'Medium' },
              { range: '21-40%', color: '#f97316', label: 'Low' },
              { range: '0-20%', color: '#ef4444', label: 'Very Low' }
            ].map((item) => (
              <div key={item.range} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.range}</span>
                  <span className="text-muted-foreground">({item.label})</span>
                </div>
                <span className="text-muted-foreground">
                  {chartData.find(d => d.label === item.range)?.count || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Insight */}
        {totalAnalyses > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              AI Analysis Insight
            </div>
            <div className="text-sm">
              Based on <strong>{totalAnalyses}</strong> AI analyses, your average win probability 
              is <strong>{avgWinProbability.toFixed(1)}%</strong>
              {avgWinProbability >= 60 && <span className="text-green-600 font-medium"> - excellent targeting!</span>}
              {avgWinProbability >= 40 && avgWinProbability < 60 && <span className="text-orange-600 font-medium"> - good potential.</span>}
              {avgWinProbability < 40 && <span className="text-red-600 font-medium"> - consider refining your search criteria.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label, totalAnalyses }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const percentage = totalAnalyses > 0 ? Math.round((data.count / totalAnalyses) * 100) : 0
    
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">Win Probability: {data.label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">Analyses:</span>
            <span className="font-medium">{data.count}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">Percentage:</span>
            <span className="font-medium">{percentage}%</span>
          </div>
          <div className="pt-1 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Range: {data.min}% - {data.max}%
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Cell component for coloring bars
function Cell({ fill }: { fill: string }) {
  return null // This is handled by Recharts internally
}
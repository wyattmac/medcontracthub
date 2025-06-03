/**
 * Opportunity Trend Chart Component
 * Shows timeline of opportunities and user activity using Recharts
 */

'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'

interface IOpportunityTrendData {
  date: string
  total_opportunities: number
  new_opportunities: number
  saved_count: number
}

interface IOpportunityTrendChartProps {
  data: IOpportunityTrendData[]
  period: string
}

export function OpportunityTrendChart({ data, period }: IOpportunityTrendChartProps) {
  // Process data for chart
  const chartData = data.map(item => ({
    date: item.date,
    formattedDate: formatDateForDisplay(item.date, period),
    newOpportunities: item.new_opportunities,
    savedOpportunities: item.saved_count,
    totalOpportunities: item.total_opportunities
  }))

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="formattedDate" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ stroke: '#8884d8', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="newOpportunities"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
            name="New Opportunities"
          />
          <Line
            type="monotone"
            dataKey="savedOpportunities"
            stroke="#dc2626"
            strokeWidth={2}
            dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#dc2626', strokeWidth: 2 }}
            name="Saved by You"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span className="text-sm text-gray-600">New Opportunities:</span>
            </div>
            <span className="font-medium">{data.newOpportunities}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              <span className="text-sm text-gray-600">Saved by You:</span>
            </div>
            <span className="font-medium">{data.savedOpportunities}</span>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">Total in System:</span>
              <span className="font-medium text-gray-700">{data.totalOpportunities}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function formatDateForDisplay(dateString: string, period: string): string {
  try {
    const date = parseISO(dateString)
    
    switch (period) {
      case '7d':
        return format(date, 'EEE, MMM d') // "Mon, Jan 1"
      case '30d':
        return format(date, 'MMM d') // "Jan 1"
      case '90d':
        return format(date, 'MMM d') // "Jan 1"
      case '1y':
        return format(date, 'MMM yyyy') // "Jan 2024"
      default:
        return format(date, 'MMM d')
    }
  } catch (error) {
    return dateString
  }
}
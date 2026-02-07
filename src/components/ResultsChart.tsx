'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { QueryResultRow } from '@/actions/db'

type ChartType = 'bar' | 'line' | 'pie'

interface ResultsChartProps {
  rows: QueryResultRow[]
  fields: string[]
}

const CHART_COLORS = [
  'hsl(217, 91%, 60%)',   // blue
  'hsl(142, 71%, 45%)',   // green
  'hsl(38, 92%, 50%)',    // amber
  'hsl(346, 77%, 50%)',   // rose
  'hsl(262, 83%, 58%)',   // violet
  'hsl(199, 89%, 48%)',   // cyan
  'hsl(24, 95%, 53%)',    // orange
  'hsl(173, 58%, 39%)',   // teal
]

/**
 * Detect which fields are numeric and which are categorical (labels).
 */
function analyzeFields(rows: QueryResultRow[], fields: string[]) {
  const numericFields: string[] = []
  const labelFields: string[] = []

  for (const field of fields) {
    const sample = rows.find((r) => r[field] !== null && r[field] !== undefined)
    if (sample && typeof sample[field] === 'number') {
      numericFields.push(field)
    } else {
      labelFields.push(field)
    }
  }

  return { numericFields, labelFields }
}

export function ResultsChart({ rows, fields }: ResultsChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar')

  const { numericFields, labelFields } = useMemo(
    () => analyzeFields(rows, fields),
    [rows, fields]
  )

  // Pick the best label and value fields automatically
  const labelField = labelFields[0] || fields[0]
  const valueFields = numericFields.length > 0 ? numericFields : []

  const [selectedValues, setSelectedValues] = useState<string[]>(() =>
    valueFields.slice(0, 3)
  )

  // Limit data points for readability
  const chartData = useMemo(() => rows.slice(0, 50), [rows])

  if (valueFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          No numeric columns found to chart.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Charts require at least one numeric column.
        </p>
      </div>
    )
  }

  const toggleValue = (field: string) => {
    setSelectedValues((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    )
  }

  const activeValues = selectedValues.filter((v) => valueFields.includes(v))
  if (activeValues.length === 0 && valueFields.length > 0) {
    setSelectedValues([valueFields[0]])
    return null
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Chart type selector */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setChartType('bar')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              chartType === 'bar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Bar
          </button>
          <button
            onClick={() => setChartType('line')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              chartType === 'line' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Line
          </button>
          <button
            onClick={() => setChartType('pie')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              chartType === 'pie' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            Pie
          </button>
        </div>

        {/* Value field toggles */}
        {chartType !== 'pie' && valueFields.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Fields:</span>
            {valueFields.map((field, i) => (
              <button
                key={field}
                onClick={() => toggleValue(field)}
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium border transition-colors',
                  activeValues.includes(field)
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                )}
                style={activeValues.includes(field) ? { borderColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
              >
                {field}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey={labelField}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {activeValues.map((field, i) => (
                <Bar
                  key={field}
                  dataKey={field}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey={labelField}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {activeValues.map((field, i) => (
                <Line
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData.map((row) => ({
                  name: String(row[labelField] ?? 'Unknown'),
                  value: Number(row[activeValues[0]] ?? 0),
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {rows.length > 50 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 50 of {rows.length} rows in chart.
        </p>
      )}
    </div>
  )
}

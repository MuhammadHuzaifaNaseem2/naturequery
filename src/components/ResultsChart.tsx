'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Activity,
  Download,
  Settings,
  Palette,
  X,
  Circle,
  Maximize2,
  ZoomIn,
  Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import { QueryResultRow } from '@/actions/db'
import { ChartRecommendation } from '@/app/dashboard/types'

type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter'

interface ResultsChartProps {
  rows: QueryResultRow[]
  fields: string[]
  compact?: boolean // widget mode — no controls, just the chart
  height?: number | string // explicit height for compact mode
  recommendation?: ChartRecommendation
}

// Professional color palettes
const COLOR_PALETTES = {
  default: [
    'hsl(217, 91%, 60%)',   // blue
    'hsl(142, 71%, 45%)',   // green
    'hsl(38, 92%, 50%)',    // amber
    'hsl(346, 77%, 50%)',   // rose
    'hsl(262, 83%, 58%)',   // violet
    'hsl(199, 89%, 48%)',   // cyan
    'hsl(24, 95%, 53%)',    // orange
    'hsl(173, 58%, 39%)',   // teal
  ],
  ocean: [
    'hsl(200, 100%, 50%)',
    'hsl(190, 90%, 45%)',
    'hsl(180, 80%, 40%)',
    'hsl(170, 85%, 35%)',
    'hsl(160, 90%, 30%)',
    'hsl(220, 80%, 55%)',
    'hsl(210, 95%, 50%)',
    'hsl(195, 100%, 45%)',
  ],
  sunset: [
    'hsl(20, 100%, 55%)',
    'hsl(35, 95%, 50%)',
    'hsl(50, 90%, 50%)',
    'hsl(10, 90%, 50%)',
    'hsl(340, 90%, 55%)',
    'hsl(25, 95%, 55%)',
    'hsl(45, 100%, 45%)',
    'hsl(0, 85%, 50%)',
  ],
  forest: [
    'hsl(140, 70%, 40%)',
    'hsl(100, 60%, 45%)',
    'hsl(80, 55%, 50%)',
    'hsl(160, 65%, 35%)',
    'hsl(120, 50%, 40%)',
    'hsl(90, 65%, 45%)',
    'hsl(150, 55%, 40%)',
    'hsl(110, 60%, 38%)',
  ],
  monochrome: [
    'hsl(217, 91%, 60%)',
    'hsl(217, 80%, 50%)',
    'hsl(217, 70%, 40%)',
    'hsl(217, 60%, 55%)',
    'hsl(217, 85%, 65%)',
    'hsl(217, 75%, 45%)',
    'hsl(217, 65%, 35%)',
    'hsl(217, 90%, 55%)',
  ],
}

type PaletteName = keyof typeof COLOR_PALETTES

/**
 * Detect which fields are numeric and which are categorical (labels).
 */
function analyzeFields(rows: QueryResultRow[], fields: string[]) {
  const numericFields: string[] = []
  const labelFields: string[] = []

  for (const field of fields) {
    const sample = rows.find((r) => r[field] !== null && r[field] !== undefined)
    if (sample) {
      const val = sample[field]
      const isNumeric =
        typeof val === 'number' ||
        typeof val === 'bigint' ||
        (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')
      if (isNumeric) {
        numericFields.push(field)
      } else {
        labelFields.push(field)
      }
    } else {
      labelFields.push(field)
    }
  }

  return { numericFields, labelFields }
}

export function ResultsChart({ rows, fields, compact = false, height, recommendation }: ResultsChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [palette, setPalette] = useState<PaletteName>('default')
  const [showSettings, setShowSettings] = useState(false)
  const [showBrush, setShowBrush] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  const CHART_COLORS = COLOR_PALETTES[palette]

  const { numericFields: valueFields, labelFields } = useMemo(
    () => analyzeFields(rows, fields),
    [rows, fields]
  )

  // Pick the best label and value fields automatically
  const defaultLabelField = labelFields[0] || fields[0]
  const defaultValueFields = valueFields.length > 0 ? valueFields : []

  const [selectedValues, setSelectedValues] = useState<string[]>(() =>
    defaultValueFields.slice(0, 3)
  )
  const [selectedLabelField, setSelectedLabelField] = useState<string>(defaultLabelField)


  // Limit data points for readability; coerce BigInt to number for recharts
  const chartData = useMemo(() => rows.slice(0, 100).map(row => {
    const normalized: QueryResultRow = {}
    for (const key of Object.keys(row)) {
      const val = row[key]
      normalized[key] = typeof val === 'bigint' ? Number(val) : val
    }
    return normalized
  }), [rows])

  // Export chart as PNG
  const exportChart = useCallback(async (format: 'png' | 'svg') => {
    if (!chartRef.current) return

    try {
      const svgElement = chartRef.current.querySelector('svg')
      if (!svgElement) return

      if (format === 'svg') {
        // Export as SVG
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const blob = new Blob([svgData], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'chart.svg'
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // Export as PNG using canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const svgData = new XMLSerializer().serializeToString(svgElement)
        const img = new Image()
        const scale = 2 // High resolution

        canvas.width = svgElement.clientWidth * scale
        canvas.height = svgElement.clientHeight * scale

        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)

        img.onload = () => {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)

          const pngUrl = canvas.toDataURL('image/png')
          const a = document.createElement('a')
          a.href = pngUrl
          a.download = 'chart.png'
          a.click()
        }
        img.src = url
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }, [])

  if (valueFields.length === 0) {
    if (compact) {
      const h = height ?? 196
      // In widget mode, show a clean stat card if there's only 1 row with 1 column
      if (rows.length === 1 && fields.length === 1) {
        const val = rows[0][fields[0]]
        return (
          <div className="flex flex-col items-center justify-center gap-2" style={{ height: h }}>
            <p className="text-5xl font-bold text-foreground">{String(typeof val === 'bigint' ? Number(val) : val ?? '—')}</p>
            <p className="text-xs text-muted-foreground capitalize">{fields[0].replace(/_/g, ' ')}</p>
          </div>
        )
      }
      // Multi-row text — show a simple table
      return (
        <div className="overflow-auto text-xs" style={{ height: h }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                {fields.map(f => <th key={f} className="text-left py-1.5 px-2 text-muted-foreground font-medium capitalize">{f.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  {fields.map(f => <td key={f} className="py-1.5 px-2 truncate max-w-[140px]">{String(typeof row[f] === 'bigint' ? Number(row[f]) : row[f] ?? '—')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const containerClass = isFullscreen
    ? 'fixed inset-4 z-50 bg-card rounded-xl shadow-2xl p-6 animate-scaleIn'
    : 'space-y-4'

  return (
    <div className={containerClass}>
      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleFullscreen}
        />
      )}

      {/* Controls — hidden in compact/widget mode */}
      <div className={clsx('flex items-center justify-between flex-wrap gap-3 relative z-50', compact && 'hidden')}>
        <div className="flex items-center gap-3">
          {/* Chart type selector */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            <button
              onClick={() => { setChartType('bar') }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              chartType === 'bar'
                ? 'bg-card text-foreground shadow-sm scale-105'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Bar
          </button>
          <button
            onClick={() => setChartType('line')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              chartType === 'line'
                ? 'bg-card text-foreground shadow-sm scale-105'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Line
          </button>
          <button
            onClick={() => setChartType('area')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              chartType === 'area'
                ? 'bg-card text-foreground shadow-sm scale-105'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            Area
          </button>
          <button
            onClick={() => setChartType('pie')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              chartType === 'pie'
                ? 'bg-card text-foreground shadow-sm scale-105'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            Pie
          </button>
          <button
            onClick={() => setChartType('scatter')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              chartType === 'scatter'
                ? 'bg-card text-foreground shadow-sm scale-105'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            <Circle className="w-3.5 h-3.5" />
            Scatter
          </button>
        </div>

        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              showSettings ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            title="Chart Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="relative group">
            <button
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Export Chart"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-lg py-1 hidden group-hover:block z-10">
              <button
                onClick={() => exportChart('png')}
                className="w-full px-3 py-2 text-xs text-left hover:bg-secondary flex items-center gap-2"
              >
                Export as PNG
              </button>
              <button
                onClick={() => exportChart('svg')}
                className="w-full px-3 py-2 text-xs text-left hover:bg-secondary flex items-center gap-2"
              >
                Export as SVG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-secondary/30 border border-border rounded-lg p-4 space-y-4 animate-slideUp">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Chart Settings</h4>
            <button
              onClick={() => setShowSettings(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Color Palette */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
              <Palette className="w-3 h-3" />
              Color Palette
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(COLOR_PALETTES) as PaletteName[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPalette(p)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-xs capitalize transition-all',
                    palette === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* X-Axis Field (Label) */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              X-Axis (Label Field)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {labelFields.map((field) => (
                <button
                  key={field}
                  onClick={() => setSelectedLabelField(field)}
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium border transition-colors',
                    selectedLabelField === field
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {field}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom Control */}
          {chartType !== 'pie' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBrush(!showBrush)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors',
                  showBrush
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                <ZoomIn className="w-3 h-3" />
                Enable Zoom/Brush
              </button>
            </div>
          )}
        </div>
      )}

      {/* Value field toggles — hidden in compact mode */}
      {!compact && chartType !== 'pie' && valueFields.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Y-Axis Fields:</span>
          {valueFields.map((field, i) => (
            <button
              key={field}
              onClick={() => toggleValue(field)}
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium border transition-all duration-200',
                activeValues.includes(field)
                  ? 'border-primary/50 bg-primary/10 text-primary scale-105'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:scale-[1.02]'
              )}
              style={activeValues.includes(field) ? { borderColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
            >
              {field}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div
        ref={chartRef}
        className={clsx('w-full transition-all duration-300', !compact && !height && (isFullscreen ? 'h-[calc(100%-140px)]' : 'h-80'))}
        style={compact || height ? { height: height ?? 196 } : undefined}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <defs>
                {activeValues.map((field, i) => (
                  <linearGradient key={field} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey={selectedLabelField}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              {showBrush && <Brush dataKey={selectedLabelField} height={30} stroke="hsl(var(--primary))" />}
              {activeValues.map((field, i) => (
                <Bar
                  key={field}
                  dataKey={field}
                  fill={`url(#gradient-${i})`}
                  radius={[6, 6, 0, 0]}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey={selectedLabelField}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              {showBrush && <Brush dataKey={selectedLabelField} height={30} stroke="hsl(var(--primary))" />}
              {activeValues.map((field, i) => (
                <Line
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2, stroke: 'white' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <defs>
                {activeValues.map((field, i) => (
                  <linearGradient key={field} id={`area-gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey={selectedLabelField}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              {showBrush && <Brush dataKey={selectedLabelField} height={30} stroke="hsl(var(--primary))" />}
              {activeValues.map((field, i) => (
                <Area
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#area-gradient-${i})`}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          ) : chartType === 'scatter' ? (
            <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                type="number"
                dataKey={activeValues[0]}
                name={activeValues[0]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                type="number"
                dataKey={activeValues[1] || activeValues[0]}
                name={activeValues[1] || activeValues[0]}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                cursor={{ strokeDasharray: '3 3' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Scatter
                name={`${activeValues[0]} vs ${activeValues[1] || activeValues[0]}`}
                data={chartData}
                fill={CHART_COLORS[0]}
                animationDuration={800}
              />
            </ScatterChart>
          ) : (
            <PieChart>
              <defs>
                {chartData.slice(0, 10).map((_, i) => (
                  <linearGradient key={i} id={`pie-gradient-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={1} />
                    <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={chartData.slice(0, 10).map((row) => ({
                  name: String(row[selectedLabelField] ?? 'Unknown'),
                  value: Number(row[activeValues[0]] ?? 0),
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={isFullscreen ? 180 : 120}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {chartData.slice(0, 10).map((_, i) => (
                  <Cell
                    key={i}
                    fill={`url(#pie-gradient-${i})`}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {rows.length > 100 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 100 of {rows.length} rows in chart.
        </p>
      )}

      {/* Fullscreen close button */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

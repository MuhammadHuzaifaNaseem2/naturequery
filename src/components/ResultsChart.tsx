'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  X,
  Circle,
  Maximize2,
  ZoomIn,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { QueryResultRow } from '@/types/database'
import type { ChartRecommendation } from '@/app/dashboard/types'

type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter'

interface ResultsChartProps {
  rows: QueryResultRow[]
  fields: string[]
  compact?: boolean // widget mode — no controls, just the chart
  height?: number | string // explicit height for compact mode
  recommendation?: ChartRecommendation
}

// Color palettes. The first is the brand: violet ink, marigold, then quieter hues that stay
// distinct from each other. Literal colors, because exported PNG/SVG files can't read CSS variables.
const COLOR_PALETTES = {
  default: [
    'hsl(251, 64%, 52%)', // violet
    'hsl(40, 92%, 55%)', // marigold
    'hsl(252, 30%, 32%)', // ink violet
    'hsl(168, 42%, 40%)', // sage teal
    'hsl(252, 70%, 74%)', // light violet
    'hsl(14, 62%, 54%)', // clay
    'hsl(205, 40%, 48%)', // slate blue
    'hsl(34, 45%, 42%)', // bronze
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

const PALETTE_LABELS: Record<PaletteName, string> = {
  default: 'NatureQuery',
  ocean: 'Ocean',
  sunset: 'Sunset',
  forest: 'Forest',
  monochrome: 'Monochrome',
}

// Legend text stays neutral; the swatch next to it carries the series color.
const legendProps = {
  wrapperStyle: { fontSize: '12px', paddingTop: '8px' },
  formatter: (value: string) => (
    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>
  ),
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: '12px',
  boxShadow: '0 12px 32px -18px rgba(0,0,0,0.35)',
}

/** Text that holds a number, such as the "3500.00" PostgreSQL returns for NUMERIC. */
function isNumericText(value: string): boolean {
  return value.trim() !== '' && !isNaN(Number(value))
}

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
        (typeof val === 'string' && isNumericText(val))
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

export function ResultsChart({
  rows,
  fields,
  compact = false,
  height,
  recommendation,
}: ResultsChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [palette, setPalette] = useState<PaletteName>('default')
  const [showSettings, setShowSettings] = useState(false)
  const [showBrush, setShowBrush] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  // Escape leaves full screen.
  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFullscreen])

  const CHART_COLORS = COLOR_PALETTES[palette]

  const { numericFields: valueFields, labelFields } = useMemo(
    () => analyzeFields(rows, fields),
    [rows, fields]
  )

  // Pick the best label and value fields automatically
  const defaultLabelField = labelFields[0] || fields[0]
  // Identifier columns (id, customer_id) are numbers but rarely what anyone wants to chart.
  const measureFields = valueFields.filter((f) => !/(^id$|_id$|^id_)/i.test(f))
  const defaultValueFields = measureFields.length > 0 ? measureFields : valueFields

  const [selectedValues, setSelectedValues] = useState<string[]>(() =>
    defaultValueFields.slice(0, 3)
  )
  const [selectedLabelField, setSelectedLabelField] = useState<string>(defaultLabelField)
  const [pickedByUser, setPickedByUser] = useState(false)

  useEffect(() => {
    if (!recommendation || pickedByUser) return
    setChartType(recommendation.type)
    if (recommendation.xAxis && fields.includes(recommendation.xAxis)) {
      setSelectedLabelField(recommendation.xAxis)
    }
    const suggestedValues = (recommendation.yAxis ?? []).filter((f) => valueFields.includes(f))
    if (suggestedValues.length > 0) setSelectedValues(suggestedValues.slice(0, 3))
    // Only react to a new suggestion, not to every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendation])

  const pickChartType = (type: ChartType) => {
    setPickedByUser(true)
    setChartType(type)
  }

  const typeButton = (type: ChartType, Icon: typeof BarChart3, label: string) => (
    <button
      onClick={() => pickChartType(type)}
      aria-pressed={chartType === type}
      title={
        recommendation?.type === type
          ? `Suggested for this data: ${recommendation.title}`
          : undefined
      }
      className={clsx(
        'relative flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
        chartType === type
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
      {recommendation?.type === type && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
          <span className="sr-only">(suggested)</span>
        </>
      )}
    </button>
  )

  // Limit data points for readability. Numbers can arrive as BigInt, or as text:
  // PostgreSQL returns NUMERIC values and SUM results as strings. Recharts draws
  // bars, lines and slices only for real numbers, so convert the numeric columns.
  const chartData = useMemo(
    () =>
      rows.slice(0, 100).map((row) => {
        const normalized: QueryResultRow = {}
        for (const key of Object.keys(row)) {
          const val = row[key]
          normalized[key] =
            typeof val === 'bigint'
              ? Number(val)
              : typeof val === 'string' && valueFields.includes(key) && isNumericText(val)
                ? Number(val)
                : val
        }
        return normalized
      }),
    [rows, valueFields]
  )

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
            <p className="font-mono text-4xl font-medium tabular-nums text-foreground">
              {String(typeof val === 'bigint' ? Number(val) : (val ?? '—'))}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {fields[0].replace(/_/g, ' ')}
            </p>
          </div>
        )
      }
      // Multi-row text — show a simple table
      return (
        <div className="overflow-auto text-xs" style={{ height: h }}>
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                {fields.map((f) => (
                  <th
                    key={f}
                    className="text-left py-1.5 px-2 font-mono text-[11px] text-muted-foreground font-medium"
                  >
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-border/60 hover:bg-secondary/50">
                  {fields.map((f) => (
                    <td key={f} className="py-1.5 px-2 truncate max-w-[140px]">
                      {String(typeof row[f] === 'bigint' ? Number(row[f]) : (row[f] ?? '—'))}
                    </td>
                  ))}
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
        <p className="text-sm text-muted-foreground">No numeric columns found to chart.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Charts require at least one numeric column.
        </p>
      </div>
    )
  }

  const toggleValue = (field: string) => {
    setSelectedValues((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
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
    ? 'fixed inset-x-4 bottom-4 z-50 bg-card border border-border rounded-lg shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] p-6 animate-fadeIn'
    : 'space-y-4'

  const chart = (
    <div
      className={containerClass}
      // Apps with their own title bar (NatureQuery Desktop) set --app-titlebar-height.
      style={isFullscreen ? { top: 'calc(var(--app-titlebar-height, 0px) + 1rem)' } : undefined}
    >
      {/* Controls — hidden in compact/widget mode */}
      <div
        className={clsx(
          'flex items-center justify-between flex-wrap gap-3 relative z-50',
          compact && 'hidden'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Chart type selector */}
          <div
            className="flex items-center rounded-md border border-border bg-card p-0.5"
            role="group"
            aria-label="Chart type"
          >
            {typeButton('bar', BarChart3, 'Bar')}
            {typeButton('line', TrendingUp, 'Line')}
            {typeButton('area', Activity, 'Area')}
            {typeButton('pie', PieChartIcon, 'Pie')}
            {typeButton('scatter', Circle, 'Scatter')}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              'p-2 rounded-md transition-colors',
              showSettings
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            title="Chart settings"
            aria-label="Chart settings"
            aria-expanded={showSettings}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={isFullscreen ? 'Close full screen (Esc)' : 'Full screen'}
            aria-label={isFullscreen ? 'Close full screen' : 'Full screen'}
          >
            {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <div className="relative group">
            <button
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Export chart"
              aria-label="Export chart"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-popover border border-border rounded-md shadow-[0_16px_40px_-20px_hsl(var(--foreground)/0.45)] py-1 hidden group-hover:block group-focus-within:block z-10">
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
        <div className="border border-border rounded-md p-4 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Chart settings
            </h4>
            <button
              onClick={() => setShowSettings(false)}
              aria-label="Close chart settings"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Color Palette */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Colors</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(COLOR_PALETTES) as PaletteName[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPalette(p)}
                  aria-pressed={palette === p}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors',
                    palette === p
                      ? 'border-foreground/40 bg-secondary text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex" aria-hidden>
                    {COLOR_PALETTES[p].slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="h-2.5 w-2.5 rounded-full -ml-0.5 first:ml-0 ring-1 ring-card"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  {PALETTE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* X-Axis Field (Label) */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Labels along the bottom</p>
            <div className="flex flex-wrap gap-1.5">
              {labelFields.map((field) => (
                <button
                  key={field}
                  onClick={() => setSelectedLabelField(field)}
                  aria-pressed={selectedLabelField === field}
                  className={clsx(
                    'px-2 py-1 rounded-md font-mono text-[11px] border transition-colors',
                    selectedLabelField === field
                      ? 'border-foreground/40 bg-secondary text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
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
                aria-pressed={showBrush}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors',
                  showBrush
                    ? 'border-foreground/40 bg-secondary text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <ZoomIn className="w-3 h-3" aria-hidden />
                Zoom slider
              </button>
            </div>
          )}
        </div>
      )}

      {/* Value field toggles — hidden in compact mode */}
      {!compact && chartType !== 'pie' && valueFields.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Values:</span>
          {valueFields.map((field, i) => (
            <button
              key={field}
              onClick={() => toggleValue(field)}
              aria-pressed={activeValues.includes(field)}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[11px] border transition-colors',
                activeValues.includes(field)
                  ? 'border-foreground/30 bg-secondary text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: activeValues.includes(field)
                    ? CHART_COLORS[i % CHART_COLORS.length]
                    : 'transparent',
                  boxShadow: `inset 0 0 0 1px ${CHART_COLORS[i % CHART_COLORS.length]}`,
                }}
                aria-hidden
              />
              {field}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div
        ref={chartRef}
        className={clsx(
          'w-full [&_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-legend-item-text]:text-xs',
          !compact && !height && (isFullscreen ? 'h-[calc(100%-140px)]' : 'h-80')
        )}
        style={compact || height ? { height: height ?? 196 } : undefined}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
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
                contentStyle={tooltipStyle}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
              />
              <Legend {...legendProps} />
              {showBrush && (
                <Brush dataKey={selectedLabelField} height={30} stroke="hsl(var(--primary))" />
              )}
              {activeValues.map((field, i) => (
                <Bar
                  key={field}
                  dataKey={field}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={56}
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...legendProps} />
              {showBrush && (
                <Brush dataKey={selectedLabelField} height={30} stroke="hsl(var(--primary))" />
              )}
              {activeValues.map((field, i) => (
                <Line
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: CHART_COLORS[i % CHART_COLORS.length],
                    strokeWidth: 2,
                    stroke: 'hsl(var(--card))',
                  }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <defs>
                {activeValues.map((field, i) => (
                  <linearGradient key={field} id={`area-gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...legendProps} />
              {showBrush && (
                <Brush dataKey={selectedLabelField} height={30} stroke="hsl(var(--primary))" />
              )}
              {activeValues.map((field, i) => (
                <Area
                  key={field}
                  type="monotone"
                  dataKey={field}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#area-gradient-${i})`}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          ) : chartType === 'scatter' ? (
            <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
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
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
              <Legend {...legendProps} />
              <Scatter
                name={`${activeValues[0]} vs ${activeValues[1] || activeValues[0]}`}
                data={chartData}
                fill={CHART_COLORS[0]}
                animationDuration={800}
              />
            </ScatterChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData.slice(0, 10).map((row) => ({
                  name: String(row[selectedLabelField] ?? 'Unknown'),
                  value: Number(row[activeValues[0]] ?? 0),
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={isFullscreen ? 180 : 120}
                paddingAngle={1}
                dataKey="value"
                label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {chartData.slice(0, 10).map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend {...legendProps} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {rows.length > 100 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 100 of {rows.length} rows in chart.
        </p>
      )}
    </div>
  )

  if (!isFullscreen) return chart
  // Full screen sits above the whole page, with the backdrop behind the chart.
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={toggleFullscreen} />
      {chart}
    </>,
    document.body
  )
}

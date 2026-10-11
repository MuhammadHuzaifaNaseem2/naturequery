'use client'

import { useState } from 'react'
import { X, GripVertical, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { ResultsChart } from '@/components/ResultsChart'
import { QueryResultRow } from '@/actions/db'

export interface DashboardWidget {
  id: string
  name: string
  question: string
  sql: string
  connectionId?: string | null
  chartType: 'bar' | 'line' | 'area' | 'pie'
  data: QueryResultRow[]
  fields: string[]
  createdAt: Date
  lastRefreshed: Date
  refreshInterval?: number
  position: number
  /** Why the last run failed, shown in place of the chart. */
  error?: string
}

interface DashboardWidgetsProps {
  widgets: DashboardWidget[]
  onAddWidget: (question: string, sql: string, data: QueryResultRow[], fields: string[]) => void
  onRemoveWidget: (id: string) => void
  onRefreshWidget: (id: string) => void
  onReorderWidgets: (widgets: DashboardWidget[]) => void
  isRefreshing?: string | null
}

const iconButton =
  'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

export function DashboardWidgets({
  widgets,
  onRemoveWidget,
  onRefreshWidget,
  isRefreshing,
}: DashboardWidgetsProps) {
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null)

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position)

  if (widgets.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl pt-6 sm:pt-12">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Dashboard
        </p>
        <h2 className="mt-4 max-w-2xl text-balance font-serif text-[clamp(1.9rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.02em]">
          Pin the answers you check every week.
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Ask a question in the Editor, then use the pin above the answer. It appears here as a
          chart you can refresh whenever you need the latest numbers.
        </p>
        <p className="mt-6 font-mono text-xs text-muted-foreground">Bar · Line · Area · Pie</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.01em]">Dashboard</h2>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {widgets.length} {widgets.length === 1 ? 'widget' : 'widgets'}
        </p>
      </div>

      {/* Expanded overlay */}
      {expandedWidget && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setExpandedWidget(null)} />
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sortedWidgets.map((widget) => {
          const isExpanded = expandedWidget === widget.id
          return (
            <div
              key={widget.id}
              className={clsx(
                'flex flex-col rounded-lg border border-border bg-card',
                isExpanded ? 'fixed inset-8 z-50 shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)]' : 'h-72'
              )}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">{widget.name}</h3>
                    <p className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {widget.fields.length > 0 && !widget.error && (
                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                      )}
                      {widget.error
                        ? 'Not loaded'
                        : `Refreshed ${formatTimeAgo(widget.lastRefreshed)}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => onRefreshWidget(widget.id)}
                    disabled={isRefreshing === widget.id}
                    className={iconButton}
                    title="Refresh"
                    aria-label={`Refresh ${widget.name}`}
                  >
                    <RefreshCw
                      className={clsx('h-3.5 w-3.5', isRefreshing === widget.id && 'animate-spin')}
                    />
                  </button>
                  <button
                    onClick={() => setExpandedWidget(isExpanded ? null : widget.id)}
                    className={iconButton}
                    title={isExpanded ? 'Shrink' : 'Expand'}
                    aria-label={isExpanded ? `Shrink ${widget.name}` : `Expand ${widget.name}`}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onRemoveWidget(widget.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Remove"
                    aria-label={`Remove ${widget.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Chart area */}
              <div className="min-h-0 flex-1 p-3">
                {widget.error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
                    <p className="text-sm text-foreground">This chart could not load.</p>
                    <p className="line-clamp-3 max-w-sm text-xs text-muted-foreground">
                      {widget.error}
                    </p>
                  </div>
                ) : widget.fields.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div className="flex h-24 w-full items-end gap-1.5 px-6" aria-hidden>
                      {[55, 80, 40, 90, 65, 50, 75, 60].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t skeleton-shine"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Loading chart data…</p>
                  </div>
                ) : (
                  <ResultsChart
                    rows={widget.data}
                    fields={widget.fields}
                    compact
                    height={isExpanded ? 'calc(100vh - 160px)' : 196}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

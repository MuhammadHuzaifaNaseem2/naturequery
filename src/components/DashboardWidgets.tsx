'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    BarChart3,
    TrendingUp,
    Activity,
    PieChart as PieChartIcon,
    X,
    GripVertical,
    Maximize2,
    RefreshCw,
    Clock,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ResultsChart } from '@/components/ResultsChart'
import { QueryResultRow } from '@/actions/db'

export interface DashboardWidget {
    id: string
    name: string
    question: string
    sql: string
    chartType: 'bar' | 'line' | 'area' | 'pie'
    data: QueryResultRow[]
    fields: string[]
    createdAt: Date
    lastRefreshed: Date
    refreshInterval?: number
    position: number
}

interface DashboardWidgetsProps {
    widgets: DashboardWidget[]
    onAddWidget: (question: string, sql: string, data: QueryResultRow[], fields: string[]) => void
    onRemoveWidget: (id: string) => void
    onRefreshWidget: (id: string) => void
    onReorderWidgets: (widgets: DashboardWidget[]) => void
    isRefreshing?: string | null
}

export function DashboardWidgets({
    widgets,
    onAddWidget,
    onRemoveWidget,
    onRefreshWidget,
    onReorderWidgets,
    isRefreshing,
}: DashboardWidgetsProps) {
    const [expandedWidget, setExpandedWidget] = useState<string | null>(null)

    const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position)

    if (widgets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                    <BarChart3 className="w-8 h-8 text-primary/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Dashboard Widgets</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                    Pin your query results to create a custom dashboard. Run a query and click "Pin to Dashboard" to get started.
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Bar</span>
                    <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Line</span>
                    <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Area</span>
                    <span className="flex items-center gap-1"><PieChartIcon className="w-3.5 h-3.5" /> Pie</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold">Dashboard Widgets</h2>
                <p className="text-xs text-muted-foreground">
                    {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Expanded overlay */}
            {expandedWidget && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setExpandedWidget(null)}
                />
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedWidgets.map((widget) => {
                    const isExpanded = expandedWidget === widget.id
                    return (
                        <div
                            key={widget.id}
                            className={clsx(
                                'rounded-xl border border-border bg-card shadow-sm flex flex-col transition-all duration-300',
                                isExpanded
                                    ? 'fixed inset-8 z-50 shadow-2xl'
                                    : 'h-72'
                            )}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                    <div className="min-w-0">
                                        <h3 className="font-medium text-sm truncate">{widget.name}</h3>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatTimeAgo(widget.lastRefreshed)}</span>
                                            {widget.fields.length > 0 && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                        onClick={() => onRefreshWidget(widget.id)}
                                        disabled={isRefreshing === widget.id}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                        title="Refresh"
                                    >
                                        <RefreshCw className={clsx('w-3.5 h-3.5', isRefreshing === widget.id && 'animate-spin')} />
                                    </button>
                                    <button
                                        onClick={() => setExpandedWidget(isExpanded ? null : widget.id)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                        title="Expand"
                                    >
                                        <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onRemoveWidget(widget.id)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        title="Remove"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Chart area */}
                            <div className="flex-1 min-h-0 p-3">
                                {widget.fields.length === 0 ? (
                                    <div className="flex flex-col gap-2 h-full justify-center items-center animate-pulse">
                                        <div className="flex items-end gap-1.5 h-24 w-full px-6">
                                            {[55, 80, 40, 90, 65, 50, 75, 60].map((h, i) => (
                                                <div
                                                    key={i}
                                                    className="flex-1 bg-muted/50 rounded-t"
                                                    style={{ height: `${h}%` }}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground/50">Loading chart data…</p>
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

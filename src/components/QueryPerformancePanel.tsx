'use client'

import { useState, useEffect } from 'react'
import {
  Gauge,
  Loader2,
  AlertTriangle,
  Info,
  Zap,
  Database as DatabaseIcon,
  TrendingUp,
  CheckCircle2,
  Activity,
} from 'lucide-react'
import { clsx } from 'clsx'
import { analyzeQueryPerformance, type PerformanceTip, type QueryPerformanceResult } from '@/actions/ai'
import type { DatabaseSchema } from '@/actions/db'

interface QueryPerformancePanelProps {
  sql: string
  schema: DatabaseSchema
  executionTimeMs?: number
  rowCount?: number
}

const TIP_CONFIG: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  index: { icon: DatabaseIcon, color: 'text-primary', bg: 'bg-primary/10' },
  optimization: { icon: Zap, color: 'text-accent', bg: 'bg-accent/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-muted-foreground', bg: 'bg-secondary' },
}

const COMPLEXITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  simple: { label: 'Simple', color: 'text-success', bg: 'bg-success/10' },
  moderate: { label: 'Moderate', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  complex: { label: 'Complex', color: 'text-destructive', bg: 'bg-destructive/10' },
}

export function QueryPerformancePanel({
  sql,
  schema,
  executionTimeMs,
  rowCount,
}: QueryPerformancePanelProps) {
  const [result, setResult] = useState<QueryPerformanceResult['data'] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  const handleAnalyze = async () => {
    if (isLoading) return
    setIsLoading(true)
    const res = await analyzeQueryPerformance(sql, schema, executionTimeMs, rowCount)
    setIsLoading(false)
    setHasAnalyzed(true)
    if (res.success && res.data) {
      setResult(res.data)
    }
  }

  // Auto-analyze on mount
  useEffect(() => {
    if (!hasAnalyzed && sql) {
      handleAnalyze()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Gauge className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <Loader2 className="w-5 h-5 text-primary animate-spin absolute -top-1 -right-1" />
        </div>
        <p className="text-sm text-muted-foreground">Analyzing query performance...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Gauge className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No performance data available</p>
        <button onClick={handleAnalyze} className="btn-secondary text-xs">
          <Activity className="w-3.5 h-3.5" />
          Analyze Performance
        </button>
      </div>
    )
  }

  const complexityConfig = COMPLEXITY_CONFIG[result.complexity] || COMPLEXITY_CONFIG.simple

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Execution</p>
          <p className="text-lg font-bold text-foreground">
            {executionTimeMs !== undefined ? `${executionTimeMs}ms` : '—'}
          </p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Complexity</p>
          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', complexityConfig.bg, complexityConfig.color)}>
            {complexityConfig.label}
          </span>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Est. Cost</p>
          <p className="text-lg font-bold text-foreground">{result.estimatedCost}</p>
        </div>
      </div>

      {/* Tips */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Optimization Tips
        </h4>
        <div className="space-y-2">
          {result.tips.map((tip, i) => {
            const config = TIP_CONFIG[tip.type] || TIP_CONFIG.info
            const Icon = config.icon
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-border transition-colors"
              >
                <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
                  <Icon className={clsx('w-3.5 h-3.5', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tip.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {result.tips.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success/5 border border-success/20">
          <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
          <p className="text-sm text-success">Query looks well-optimized! No issues detected.</p>
        </div>
      )}
    </div>
  )
}

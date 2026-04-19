'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Database,
  BookMarked,
  Zap,
  ChevronDown,
  ChevronUp,
  Bot,
  RefreshCw,
  Sparkles,
  Activity,
  BarChart3,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import type { NightlyInsightRecord, LiveInsightMetrics } from '@/actions/audit'

interface Props {
  insights: NightlyInsightRecord[]
  liveMetrics?: LiveInsightMetrics
}

function useGenerateInsight() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insights/trigger-test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      toast.success('Insight generated! Refreshing...')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate insight')
    } finally {
      setLoading(false)
    }
  }

  return { generate, loading }
}

export function InsightsClient({ insights, liveMetrics }: Props) {
  const { generate, loading } = useGenerateInsight()
  const latest = insights[0] ?? null
  const stats = liveMetrics ?? latest?.metrics

  return (
    <div className="space-y-6">
      {/* ── Top Bar: Title + CTA ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Intelligence Overview
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {latest
              ? 'AI-powered analysis of your database activity'
              : 'Generate your first AI-powered insight to get started'}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generating…' : latest ? 'Generate New Insight' : 'Generate First Insight'}
        </button>
      </div>

      {/* ── Live Metrics Grid ── */}
      {stats && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Current Activity
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="Queries (7d)"
              value={stats.queries7d}
              trend={
                stats.wowDirection !== 'stable'
                  ? { direction: stats.wowDirection, delta: stats.wowDelta }
                  : undefined
              }
              accentColor="from-blue-500/20 to-cyan-500/20"
              iconColor="text-blue-500"
            />
            <MetricCard
              icon={<Calendar className="w-4 h-4" />}
              label="Queries (30d)"
              value={stats.queries30d}
              accentColor="from-violet-500/20 to-purple-500/20"
              iconColor="text-violet-500"
            />
            <MetricCard
              icon={<Database className="w-4 h-4" />}
              label="Active Connections"
              value={stats.connectionCount}
              accentColor="from-amber-500/20 to-orange-500/20"
              iconColor="text-amber-500"
            />
            <MetricCard
              icon={<BookMarked className="w-4 h-4" />}
              label="Saved Queries"
              value={stats.savedQueryCount}
              accentColor="from-emerald-500/20 to-teal-500/20"
              iconColor="text-emerald-500"
            />
          </div>
        </div>
      )}

      {/* ── Top Connections ── */}
      {stats && stats.topConnections.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Most Active Connections
            </h3>
          </div>
          <TopConnectionsBars connections={stats.topConnections} />
        </div>
      )}

      {/* ── Latest AI Digest ── */}
      {latest ? (
        <LatestDigestCard insight={latest} />
      ) : (
        <EmptyDigestCard />
      )}

      {/* ── Insight History ── */}
      {insights.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Past Insights
            </h3>
          </div>
          <div className="space-y-3">
            {insights.slice(1).map((insight) => (
              <InsightHistoryCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer note ── */}
      <p className="text-[11px] text-muted-foreground/50 text-center pt-2">
        Stats show rolling 7-day and 30-day windows · Insights are generated nightly at 2 AM UTC
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card — unified stat card with gradient accent
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  trend,
  accentColor,
  iconColor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  trend?: { direction: 'up' | 'down'; delta: number }
  accentColor: string
  iconColor: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-card p-4`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${accentColor} opacity-30`} />
      <div className="relative">
        <div className={`flex items-center gap-1.5 mb-2 ${iconColor}`}>
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <span
              className={`text-xs font-semibold ${
                trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {trend.direction === 'up' ? '+' : ''}
              {trend.delta}% WoW
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Latest Digest Card
// ─────────────────────────────────────────────────────────────────────────────

function LatestDigestCard({ insight }: { insight: NightlyInsightRecord }) {
  const { metrics } = insight

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Latest AI Digest</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                NEW
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(insight.createdAt)}</p>
          </div>
        </div>
        <TrendBadge direction={metrics.wowDirection} delta={metrics.wowDelta} />
      </div>

      {/* Narrative */}
      <div className="px-6 py-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.narrative}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty Digest (when no insights generated yet)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyDigestCard() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-8">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mb-4">
          <Bot className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold mb-2">No AI Digest Yet</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Click &ldquo;Generate First Insight&rdquo; above to create your first AI-powered analysis.
          After that, insights are delivered automatically every night at 2 AM UTC.
        </p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm text-left">
          {[
            { icon: <Activity className="w-3.5 h-3.5" />, text: 'AI narrative of your activity' },
            { icon: <TrendingUp className="w-3.5 h-3.5" />, text: 'Week-over-week trends' },
            { icon: <Database className="w-3.5 h-3.5" />, text: 'Top active connections' },
            { icon: <Clock className="w-3.5 h-3.5" />, text: 'Auto-delivered nightly' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2.5 border border-border/50"
            >
              <span className="text-primary shrink-0">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History Card (collapsible)
// ─────────────────────────────────────────────────────────────────────────────

function InsightHistoryCard({ insight }: { insight: NightlyInsightRecord }) {
  const [expanded, setExpanded] = useState(false)
  const { metrics } = insight

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <TrendBadge direction={metrics.wowDirection} delta={metrics.wowDelta} small />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium truncate">{formatDate(insight.createdAt)}</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">
              {insight.narrative.slice(0, 120)}{insight.narrative.length > 120 ? '…' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{metrics.queries7d}</span> queries
            </span>
            <span>
              <span className="font-semibold text-foreground">{metrics.connectionCount}</span>{' '}
              connections
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border animate-fadeIn">
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-4 my-4">
            {insight.narrative}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="Queries (7d)"
              value={metrics.queries7d}
              accentColor="from-blue-500/20 to-cyan-500/20"
              iconColor="text-blue-500"
            />
            <MetricCard
              icon={<Calendar className="w-4 h-4" />}
              label="Queries (30d)"
              value={metrics.queries30d}
              accentColor="from-violet-500/20 to-purple-500/20"
              iconColor="text-violet-500"
            />
            <MetricCard
              icon={<Database className="w-4 h-4" />}
              label="Connections"
              value={metrics.connectionCount}
              accentColor="from-amber-500/20 to-orange-500/20"
              iconColor="text-amber-500"
            />
            <MetricCard
              icon={<BookMarked className="w-4 h-4" />}
              label="Saved"
              value={metrics.savedQueryCount}
              accentColor="from-emerald-500/20 to-teal-500/20"
              iconColor="text-emerald-500"
            />
          </div>

          {metrics.topConnections.length > 0 && (
            <div className="rounded-lg bg-secondary/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Top Connections
              </p>
              <TopConnectionsBars connections={metrics.topConnections} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TrendBadge({
  direction,
  delta,
  small = false,
}: {
  direction: 'up' | 'down' | 'stable'
  delta: number
  small?: boolean
}) {
  const cfg = {
    up: { bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: `↑ ${delta}%` },
    down: {
      bg: 'bg-red-500/10 text-red-600 dark:text-red-400',
      label: `↓ ${Math.abs(delta)}%`,
    },
    stable: {
      bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      label: '→ Stable',
    },
  }[direction]

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${cfg.bg} ${
        small ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      }`}
    >
      {cfg.label}
    </span>
  )
}

function TopConnectionsBars({
  connections,
}: {
  connections: { name: string; count: number }[]
}) {
  const max = connections[0]?.count ?? 1
  return (
    <div className="space-y-2.5">
      {connections.map((c) => (
        <div key={c.name} className="flex items-center gap-3 text-sm">
          <span className="w-32 truncate text-xs text-muted-foreground shrink-0 font-medium">
            {c.name}
          </span>
          <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((c.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right shrink-0 tabular-nums">
            {c.count} {c.count === 1 ? 'query' : 'queries'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Util
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

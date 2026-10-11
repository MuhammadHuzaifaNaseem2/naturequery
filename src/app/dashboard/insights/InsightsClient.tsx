'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import type { NightlyInsightRecord, LiveInsightMetrics } from '@/actions/audit'

interface Props {
  insights: NightlyInsightRecord[]
  liveMetrics?: LiveInsightMetrics
}

const label =
  'font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground'

function useGenerateInsight() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/insights/trigger-test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      // The refreshed page shows the new summary, so no toast.
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not write a summary')
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
    <div className="space-y-12">
      {/* Title and action */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={label}>Insights</p>
          <h1 className="mt-3 text-balance font-serif text-[clamp(2rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.02em]">
            Your week in NatureQuery.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            A short summary of how you used NatureQuery, written every night at 2 AM UTC. You can
            also ask for one now.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary h-10 flex-shrink-0 px-4"
        >
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          {loading ? 'Writing…' : latest ? 'Write a new summary' : 'Write the first summary'}
        </button>
      </div>

      {/* Figures */}
      {stats && (
        <section aria-labelledby="insight-figures">
          <h2 id="insight-figures" className={label}>
            Last 7 and 30 days
          </h2>
          <dl className="mt-3 grid grid-cols-2 divide-border overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4 lg:divide-x [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(-n+2)]:border-border lg:[&>div:nth-child(-n+2)]:border-b-0 [&>div:nth-child(odd)]:border-r [&>div:nth-child(odd)]:border-border lg:[&>div:nth-child(odd)]:border-r-0">
            <Figure
              label="Questions, 7 days"
              value={stats.queries7d}
              trend={
                stats.wowDirection !== 'stable'
                  ? { direction: stats.wowDirection, delta: stats.wowDelta }
                  : undefined
              }
            />
            <Figure label="Questions, 30 days" value={stats.queries30d} />
            <Figure label="Connections in use" value={stats.connectionCount} />
            <Figure label="Saved queries" value={stats.savedQueryCount} />
          </dl>
        </section>
      )}

      {/* Busiest connections */}
      {stats && stats.topConnections.length > 0 && (
        <section aria-labelledby="insight-connections">
          <h2 id="insight-connections" className={label}>
            Busiest connections
          </h2>
          <div className="mt-3 rounded-lg border border-border bg-card p-5">
            <TopConnectionsBars connections={stats.topConnections} />
          </div>
        </section>
      )}

      {/* The summary */}
      {latest ? <LatestDigest insight={latest} /> : <EmptyDigest />}

      {/* Earlier summaries */}
      {insights.length > 1 && (
        <section aria-labelledby="insight-history">
          <h2 id="insight-history" className={label}>
            Earlier summaries
          </h2>
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {insights.slice(1).map((insight) => (
              <InsightHistoryRow key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      <p className="font-mono text-[11px] text-muted-foreground">
        Figures cover rolling 7-day and 30-day windows. Summaries are written nightly at 2 AM UTC.
      </p>
    </div>
  )
}

function Figure({
  label: name,
  value,
  trend,
}: {
  label: string
  value: number
  trend?: { direction: 'up' | 'down'; delta: number }
}) {
  return (
    <div className="p-4 sm:p-5">
      <dt className={label}>{name}</dt>
      <dd className="mt-2 font-mono text-2xl tabular-nums">{value.toLocaleString()}</dd>
      {trend && (
        <dd
          className={clsx(
            'mt-1 font-mono text-[11px] tabular-nums',
            trend.direction === 'up' ? 'text-success' : 'text-destructive'
          )}
        >
          {trend.direction === 'up' ? '+' : ''}
          {trend.delta}% on last week
        </dd>
      )}
    </div>
  )
}

function LatestDigest({ insight }: { insight: NightlyInsightRecord }) {
  const { metrics } = insight
  return (
    <section aria-labelledby="insight-latest">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="insight-latest" className={clsx(label, 'flex items-center gap-2')}>
          <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
          Latest summary · {formatDate(insight.createdAt)}
        </h2>
        <TrendText direction={metrics.wowDirection} delta={metrics.wowDelta} />
      </div>
      <div className="mt-3 rounded-lg border border-border bg-card px-6 py-6 sm:px-8">
        <p className="max-w-3xl font-serif text-[1.2rem] leading-[1.6] text-foreground">
          {insight.narrative}
        </p>
      </div>
    </section>
  )
}

function EmptyDigest() {
  return (
    <section className="border-t border-border pt-8">
      <p className="font-serif text-2xl leading-snug">No summary yet.</p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Use the button above to write the first one. After that, a new summary arrives every night
        at 2 AM UTC. Each one covers:
      </p>
      <ul className="mt-4 grid max-w-xl gap-x-8 gap-y-2 text-sm text-foreground/85 sm:grid-cols-2">
        {[
          'How many questions you asked this week',
          'How that compares with last week',
          'Which connections you used most',
          'One suggestion for the week ahead',
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.55em] h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function InsightHistoryRow({ insight }: { insight: NightlyInsightRecord }) {
  const [expanded, setExpanded] = useState(false)
  const { metrics } = insight

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatDate(insight.createdAt)}</p>
          <p className="mt-0.5 truncate font-serif text-[15px] italic text-muted-foreground sm:max-w-xl">
            {insight.narrative.slice(0, 140)}
            {insight.narrative.length > 140 ? '…' : ''}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground sm:inline">
            {metrics.queries7d} questions
          </span>
          <TrendText direction={metrics.wowDirection} delta={metrics.wowDelta} />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 animate-fadeIn">
          <p className="my-4 max-w-3xl font-serif text-[17px] leading-[1.6]">{insight.narrative}</p>
          <dl className="grid grid-cols-2 gap-4 font-mono text-xs sm:grid-cols-4">
            {[
              ['Questions, 7 days', metrics.queries7d],
              ['Questions, 30 days', metrics.queries30d],
              ['Connections', metrics.connectionCount],
              ['Saved', metrics.savedQueryCount],
            ].map(([name, value]) => (
              <div key={name}>
                <dt className={label}>{name}</dt>
                <dd className="mt-1 text-base tabular-nums">{Number(value).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {metrics.topConnections.length > 0 && (
            <div className="mt-5">
              <p className={clsx(label, 'mb-2')}>Busiest connections</p>
              <TopConnectionsBars connections={metrics.topConnections} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrendText({ direction, delta }: { direction: 'up' | 'down' | 'stable'; delta: number }) {
  const text =
    direction === 'up'
      ? `↑ ${delta}% on last week`
      : direction === 'down'
        ? `↓ ${Math.abs(delta)}% on last week`
        : 'Steady on last week'
  return (
    <span
      className={clsx(
        'font-mono text-[11px] tabular-nums',
        direction === 'up'
          ? 'text-success'
          : direction === 'down'
            ? 'text-destructive'
            : 'text-muted-foreground'
      )}
    >
      {text}
    </span>
  )
}

function TopConnectionsBars({ connections }: { connections: { name: string; count: number }[] }) {
  const max = connections[0]?.count ?? 1
  return (
    <div className="space-y-2.5">
      {connections.map((c) => (
        <div key={c.name} className="flex items-center gap-3 text-sm">
          <span className="w-36 flex-shrink-0 truncate text-sm">{c.name}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.round((c.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-20 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
            {c.count} {c.count === 1 ? 'question' : 'questions'}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

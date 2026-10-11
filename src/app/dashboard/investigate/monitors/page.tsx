import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Plus } from 'lucide-react'
import { AppPageHeader } from '@/components/AppPageHeader'
import { getReconciliationMonitors } from '@/actions/reconciliation-monitors'
import type { MonitorRunStatus } from '@/lib/reconciliation-monitor'
import { MonitorActions } from './MonitorActions'

const STATUS_LABEL: Record<MonitorRunStatus, string> = {
  never: 'Not run yet',
  matched: 'Matched',
  within_threshold: 'Differences below threshold',
  alert: 'Difference found',
  failed: 'Failed',
}

const STATUS_STYLE: Record<MonitorRunStatus, string> = {
  within_threshold: 'bg-warning/10 text-warning border-warning/20',
  never: 'bg-secondary text-muted-foreground border-border',
  matched: 'bg-success/10 text-success border-success/20',
  alert: 'bg-warning/10 text-warning border-warning/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
}

export default async function ReconciliationMonitorsPage() {
  const response = await getReconciliationMonitors()
  const monitors = response.data ?? []

  return (
    <main className="min-h-screen bg-background">
      <AppPageHeader
        crumbs={[{ label: 'Investigate', href: '/dashboard/investigate' }, { label: 'Monitors' }]}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-[clamp(2rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.02em]">
              Monitors
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl">
              NatureQuery reruns both read-only reports and opens an investigation when money
              differs.
            </p>
          </div>
          <Link href="/dashboard" className="btn-gradient text-sm">
            <Plus className="w-4 h-4" /> Create from query comparison
          </Link>
        </div>

        {!response.success ? (
          <div className="card p-8 text-center text-destructive">{response.error}</div>
        ) : monitors.length === 0 ? (
          <div className="card p-12 text-center">
            <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold">No monitors yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Compare two query results, open Investigate, then click Monitor.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {monitors.map(({ id, definition }) => (
              <section key={id} className="card p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold">{definition.name}</h2>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLE[definition.lastStatus]}`}
                      >
                        {STATUS_LABEL[definition.lastStatus]}
                      </span>
                      {!definition.enabled && (
                        <span className="rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {definition.source.name} → {definition.comparison.name}
                    </p>
                  </div>
                  <MonitorActions id={id} enabled={definition.enabled} />
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                  <MonitorMetric
                    label="Schedule"
                    value={definition.frequency.toLowerCase()}
                    icon={<Clock3 className="w-4 h-4" />}
                  />
                  <MonitorMetric
                    label="Alert threshold"
                    value={`${definition.currency} ${definition.threshold.toFixed(2)}`}
                    icon={<AlertTriangle className="w-4 h-4" />}
                  />
                  <MonitorMetric
                    label="Last difference"
                    value={
                      definition.lastDifference === undefined
                        ? '—'
                        : `${definition.currency} ${definition.lastDifference.toFixed(2)}`
                    }
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <MonitorMetric
                    label="Next automatic run"
                    value={
                      definition.enabled
                        ? new Date(definition.nextRunAt).toLocaleString()
                        : 'Paused'
                    }
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  />
                </div>

                {definition.lastError && (
                  <p className="mt-3 text-xs text-destructive">{definition.lastError}</p>
                )}
                {definition.lastInvestigationId && (
                  <Link
                    href={`/dashboard/investigate?id=${encodeURIComponent(definition.lastInvestigationId)}`}
                    className="inline-flex mt-3 text-xs font-semibold text-primary hover:underline"
                  >
                    Open latest generated investigation
                  </Link>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function MonitorMetric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-semibold capitalize truncate" title={value}>
        {value}
      </p>
    </div>
  )
}

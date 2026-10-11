import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getNightlyInsights,
  getLiveInsightMetrics,
  type NightlyInsightRecord,
  type LiveInsightMetrics,
} from '@/actions/audit'
import { InsightsClient } from './InsightsClient'
import { AppPageHeader } from '@/components/AppPageHeader'

export const metadata = { title: 'Insights' }

export default async function InsightsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      {/* Page shell renders immediately; the data-heavy section below streams in */}
      <AppPageHeader crumbs={[{ label: 'Insights' }]}>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          Beta
        </span>
      </AppPageHeader>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Suspense fallback={<InsightsSkeleton />}>
          <InsightsData />
        </Suspense>
      </div>
    </div>
  )
}

// Separate async server component so its awaits don't block the shell above.
async function InsightsData() {
  const [insightsResult, liveResult] = await Promise.all([
    getNightlyInsights(20),
    getLiveInsightMetrics(),
  ])
  const insights: NightlyInsightRecord[] = insightsResult.data ?? []
  const liveMetrics: LiveInsightMetrics | undefined = liveResult.data
  return <InsightsClient insights={insights} liveMetrics={liveMetrics} />
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6" aria-hidden>
          <div className="h-3 rounded w-1/4 mb-4 skeleton-shine" />
          <div className="h-3 rounded w-full mb-2 skeleton-shine" />
          <div className="h-3 rounded w-5/6 skeleton-shine" />
        </div>
      ))}
    </div>
  )
}

import Link from 'next/link'
import { CheckCircle2, Clock3, FolderSearch, Scale } from 'lucide-react'
import { AppPageHeader } from '@/components/AppPageHeader'
import { getSavedInvestigations } from '@/actions/investigations'
import type { InvestigationCaseStatus } from '@/lib/investigation-record'

const STATUS_STYLE: Record<InvestigationCaseStatus, string> = {
  OPEN: 'border-warning/20 bg-warning/10 text-warning',
  IN_REVIEW: 'border-primary/20 bg-primary/10 text-primary',
  RESOLVED: 'border-success/20 bg-success/10 text-success',
}

const STATUS_LABEL: Record<InvestigationCaseStatus, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export default async function InvestigationHistoryPage() {
  const response = await getSavedInvestigations()
  const investigations = response.data ?? []

  return (
    <main className="min-h-screen bg-background">
      <AppPageHeader
        crumbs={[{ label: 'Investigate', href: '/dashboard/investigate' }, { label: 'Saved' }]}
      >
        <Link href="/dashboard/investigate" className="btn-secondary px-3 py-1.5 text-sm">
          New investigation
        </Link>
      </AppPageHeader>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-[clamp(2rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.02em]">
            Saved investigations
          </h1>
          <p className="text-muted-foreground mt-3">
            Reopen evidence, review confirmed causes, and preserve every saved version.
          </p>
        </div>

        {!response.success ? (
          <div className="card p-8 text-center text-destructive">{response.error}</div>
        ) : investigations.length === 0 ? (
          <div className="card p-12 text-center">
            <FolderSearch className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="font-semibold">No saved investigations yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Compare two reports, confirm the causes, and save the case.
            </p>
            <Link href="/dashboard" className="btn-gradient text-sm">
              <Scale className="w-4 h-4" /> Compare query results
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {investigations.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/investigate?id=${encodeURIComponent(item.id)}`}
                className="card p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{item.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.metric} · {item.period}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLE[item.status]}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Difference
                    </p>
                    <p className="font-bold mt-1">
                      {item.needsReview ? 'Needs review' : money(item.difference, item.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Unexplained
                    </p>
                    <p
                      className={
                        item.status === 'RESOLVED'
                          ? 'font-bold mt-1 text-success'
                          : 'font-bold mt-1 text-destructive'
                      }
                    >
                      {item.needsReview
                        ? 'Needs review'
                        : money(item.unresolvedDifference, item.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {item.status === 'RESOLVED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Clock3 className="w-3.5 h-3.5" />
                    )}
                    {item.needsReview
                      ? 'Correct the saved report data'
                      : `${item.resolvedCount} of ${item.issueCount} causes confirmed`}
                  </span>
                  <span>{new Date(item.savedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

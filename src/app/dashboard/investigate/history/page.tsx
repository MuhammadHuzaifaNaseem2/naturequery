import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock3, FolderSearch, Scale } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { getSavedInvestigations } from '@/actions/investigations'
import type { InvestigationCaseStatus } from '@/lib/investigation-record'

const STATUS_STYLE: Record<InvestigationCaseStatus, string> = {
  OPEN: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
  IN_REVIEW: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
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
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="md" showText={false} />
            <div>
              <p className="font-bold leading-tight">Saved investigations</p>
              <p className="text-xs text-muted-foreground">Tamper-evident discrepancy history</p>
            </div>
          </div>
          <Link href="/dashboard/investigate" className="btn-secondary text-sm">
            <ArrowLeft className="w-4 h-4" /> New investigation
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Investigation history</h1>
          <p className="text-muted-foreground mt-2">
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
                    <p className="font-bold mt-1">{money(item.difference, item.currency)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Unexplained
                    </p>
                    <p
                      className={
                        item.unresolvedDifference === 0
                          ? 'font-bold mt-1 text-success'
                          : 'font-bold mt-1 text-destructive'
                      }
                    >
                      {money(item.unresolvedDifference, item.currency)}
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
                    {item.resolvedCount} of {item.issueCount} causes confirmed
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

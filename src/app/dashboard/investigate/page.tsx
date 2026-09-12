import Link from 'next/link'
import { Activity, ArrowLeft, FolderClock } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { ReconciliationWorkspace } from '@/components/ReconciliationWorkspace'

export default async function InvestigatePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="md" showText={false} />
            <div>
              <p className="font-bold leading-tight">NatureQuery Investigate</p>
              <p className="text-xs text-muted-foreground">Report discrepancy workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/investigate/monitors" className="btn-secondary text-sm">
              <Activity className="w-4 h-4" /> Monitors
            </Link>
            <Link href="/dashboard/investigate/history" className="btn-secondary text-sm">
              <FolderClock className="w-4 h-4" /> Saved investigations
            </Link>
            <Link href="/dashboard" className="btn-secondary text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to query workspace
            </Link>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <ReconciliationWorkspace investigationId={id} />
      </div>
    </main>
  )
}

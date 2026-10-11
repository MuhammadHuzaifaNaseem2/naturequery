import Link from 'next/link'
import { Activity, FolderClock } from 'lucide-react'
import { AppPageHeader } from '@/components/AppPageHeader'
import { ReconciliationWorkspace } from '@/components/ReconciliationWorkspace'

export default async function InvestigatePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return (
    <main className="min-h-screen bg-background">
      <AppPageHeader crumbs={[{ label: 'Investigate' }]} wide>
        <Link href="/dashboard/investigate/monitors" className="btn-ghost px-3 py-1.5 text-sm">
          <Activity className="w-4 h-4" aria-hidden /> Monitors
        </Link>
        <Link href="/dashboard/investigate/history" className="btn-ghost px-3 py-1.5 text-sm">
          <FolderClock className="w-4 h-4" aria-hidden /> Saved
        </Link>
      </AppPageHeader>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <ReconciliationWorkspace investigationId={id} />
      </div>
    </main>
  )
}

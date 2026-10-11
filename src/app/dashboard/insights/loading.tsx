import { AppPageHeader } from '@/components/AppPageHeader'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader crumbs={[{ label: 'Insights' }]} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4" aria-hidden>
        <div className="h-3 w-24 rounded skeleton-shine" />
        <div className="h-10 w-2/3 rounded skeleton-shine" />
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6">
            <div className="h-3 rounded w-1/4 mb-4 skeleton-shine" />
            <div className="h-3 rounded w-full mb-2 skeleton-shine" />
            <div className="h-3 rounded w-5/6 skeleton-shine" />
          </div>
        ))}
      </div>
    </div>
  )
}

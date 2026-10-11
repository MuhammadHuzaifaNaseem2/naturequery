import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicDashboardWidgets } from '@/actions/share-dashboard'
import { AppLogo } from '@/components/AppLogo'
import { PublicDashboardWidgets } from './PublicDashboardWidgets'

interface PublicDashboardProps {
  params: Promise<{
    token: string
  }>
}

export default async function PublicDashboard({ params }: PublicDashboardProps) {
  const { token } = await params

  if (!token) {
    notFound()
  }

  const result = await getPublicDashboardWidgets(token)

  const header = (
    <header className="border-b border-mk-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="NatureQuery home">
          <AppLogo size="sm" textClassName="text-[15px] font-semibold tracking-[-0.01em]" />
        </Link>
        <Link href="/register" className="mk-btn mk-btn-sm mk-btn-primary">
          Build your own
        </Link>
      </div>
    </header>
  )

  if (!result.success || !result.widgets) {
    return (
      <div className="mk min-h-screen">
        {header}
        <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="mk-label">Shared dashboard</p>
          <h1 className="mt-4 font-nq-serif text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
            This dashboard isn&apos;t available.
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-mk-ink-2">
            {result.error || 'The link is wrong, or its owner has made the dashboard private.'}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="mk min-h-screen">
      {header}
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="mk-label">Shared dashboard</p>
        <h1 className="mt-4 text-balance font-nq-serif text-[clamp(2rem,4.4vw,3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-mk-ink">
          {result.ownerName}&apos;s dashboard
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-mk-ink-2">
          The questions {result.ownerName} keeps an eye on in NatureQuery. Their data and SQL stay
          private.
        </p>

        <div className="mt-10">
          {result.widgets.length === 0 ? (
            <p className="border-t border-mk-rule pt-6 text-mk-ink-3">This dashboard is empty.</p>
          ) : (
            <PublicDashboardWidgets widgets={result.widgets} />
          )}
        </div>
      </main>
    </div>
  )
}

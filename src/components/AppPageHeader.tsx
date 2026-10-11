import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'

interface Crumb {
  label: string
  href?: string
}

interface AppPageHeaderProps {
  /** Where this page sits under the dashboard, e.g. Investigate / Monitors. */
  crumbs: Crumb[]
  /** Page actions shown on the right. */
  children?: ReactNode
  wide?: boolean
}

/** The bar at the top of pages that open from the dashboard: a way back, and where you are. */
export function AppPageHeader({ crumbs, children, wide = false }: AppPageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div
        className={clsx(
          'mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6',
          wide ? 'max-w-7xl' : 'max-w-5xl'
        )}
      >
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1
            return (
              <Fragment key={crumb.label}>
                <span className="text-muted-foreground/50" aria-hidden>
                  /
                </span>
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={clsx(
                      'truncate font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
                      last ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </Fragment>
            )
          })}
        </nav>
        {children && <div className="flex flex-shrink-0 items-center gap-2">{children}</div>}
      </div>
    </header>
  )
}

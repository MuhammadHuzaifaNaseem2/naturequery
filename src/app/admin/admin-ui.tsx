import type { ReactNode } from 'react'
import { clsx } from 'clsx'

/** The title block at the top of each admin page, with its actions on the right. */
export function AdminTitle({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-[2rem] font-normal leading-tight tracking-[-0.02em]">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** A row of headline figures separated by hairlines. */
export function Figures({
  items,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode }[]
}) {
  return (
    <dl
      className={clsx(
        'grid gap-px overflow-hidden rounded-lg border border-border bg-border',
        items.length === 4
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-3'
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-card p-5">
          <dt className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-2.5 font-mono text-[1.75rem] font-medium leading-none tabular-nums">
            {item.value}
          </dd>
          {item.note && <p className="mt-2.5 text-xs text-muted-foreground">{item.note}</p>}
        </div>
      ))}
    </dl>
  )
}

/** A bordered section with a mono label, for one subject on a page. */
export function Panel({
  label,
  aside,
  children,
  className,
}: {
  label: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('min-w-0 rounded-lg border border-border bg-card', className)}>
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </h2>
        {aside && (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{aside}</span>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

const CHIP_STYLES: Record<string, string> = {
  FREE: 'border-border text-muted-foreground',
  PRO: 'border-primary/30 bg-primary/10 text-primary',
  ENTERPRISE: 'border-signal/50 bg-signal-soft text-signal-ink',
  ADMIN: 'border-destructive/30 bg-destructive/10 text-destructive',
  ANALYST: 'border-primary/30 bg-primary/10 text-primary',
  VIEWER: 'border-border text-muted-foreground',
}

/** A plan or role, in the database's own words. */
export function Chip({ value }: { value: string }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]',
        CHIP_STYLES[value] ?? CHIP_STYLES.FREE
      )}
    >
      {value}
    </span>
  )
}

export function timeAgo(date: string | Date): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function formatDay(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

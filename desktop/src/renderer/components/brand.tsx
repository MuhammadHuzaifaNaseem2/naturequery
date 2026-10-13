import { clsx } from 'clsx'
import { DB_TYPE_INFO, type DbType } from '@shared/db-types'

const DB_COLORS: Record<DbType, { bg: string; fg: string }> = {
  postgresql: { bg: '#336791', fg: '#ffffff' },
  mysql: { bg: '#00758f', fg: '#ffffff' },
  mariadb: { bg: '#c0765a', fg: '#ffffff' },
  sqlserver: { bg: '#cc2927', fg: '#ffffff' },
  oracle: { bg: '#e2231a', fg: '#ffffff' },
  sqlite: { bg: '#0f80cc', fg: '#ffffff' },
  mongodb: { bg: '#3f9142', fg: '#ffffff' },
  clickhouse: { bg: '#fdd64c', fg: '#1b1b1b' },
  snowflake: { bg: '#29b5e8', fg: '#ffffff' },
  bigquery: { bg: '#4285f4', fg: '#ffffff' },
  redshift: { bg: '#8c4fff', fg: '#ffffff' },
  cockroachdb: { bg: '#6933ff', fg: '#ffffff' },
  neon: { bg: '#00e599', fg: '#062a1d' },
  supabase: { bg: '#1c1c1c', fg: '#3ecf8e' },
  planetscale: { bg: '#2b2f36', fg: '#ffffff' },
  turso: { bg: '#4ff8d2', fg: '#06302a' },
  dynamodb: { bg: '#4053d6', fg: '#ffffff' },
  firestore: { bg: '#ffa000', fg: '#2a1a00' },
  cassandra: { bg: '#1287b1', fg: '#ffffff' },
}

export function DbIcon({
  type,
  size = 'md',
  className,
}: {
  type: DbType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const colors = DB_COLORS[type]
  const dimension = {
    sm: 'h-5 w-5 text-[8.5px] rounded',
    md: 'h-7 w-7 text-[10px] rounded-md',
    lg: 'h-10 w-10 text-[13px] rounded-lg',
  }[size]
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center font-bold tracking-tight',
        dimension,
        className
      )}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {DB_TYPE_INFO[type].badge}
    </span>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="nq-logo" x2="1" y2="1">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#nq-logo)" />
      <g stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".85">
        <path d="m16 14 16 20M32 14 16 34" />
      </g>
      <g fill="white">
        <circle cx="24" cy="24" r="3" />
        <circle cx="16" cy="14" r="2.5" />
        <circle cx="32" cy="14" r="2.5" />
        <circle cx="16" cy="34" r="2.5" />
        <circle cx="32" cy="34" r="2.5" />
      </g>
    </svg>
  )
}

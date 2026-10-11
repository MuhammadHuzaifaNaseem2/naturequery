'use client'

import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Activity,
  Loader2,
  RefreshCw,
  LogIn,
  LogOut,
  Trash2,
  UserPlus,
  Users,
  Link2,
  Settings2,
  Shield,
} from 'lucide-react'
import {
  getAdminStats,
  getQueryVolume,
  getRecentActivity,
  getTopActiveUsers,
  type AdminStats,
  type QueryVolumePoint,
  type ActivityItem,
  type TopUser,
} from '@/actions/admin'
import { AdminTitle, Chip, Figures, Panel, timeAgo } from './admin-ui'

// ─── Questions per day ───────────────────────────────────────────────────

function VolumeChart({ data }: { data: QueryVolumePoint[] }) {
  if (data.length < 2) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Not enough days yet.</p>
  }

  const width = 600
  const height = 160
  const top = 10
  const max = Math.max(...data.map((d) => d.count), 1)
  const x = (i: number) => (i / (data.length - 1)) * width
  const y = (v: number) => top + (1 - v / max) * (height - top)
  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`)
    .join(' ')
  const last = data[data.length - 1]
  const day = (date: string) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${date.slice(0, 10)}T00:00:00Z`)
    )

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-40 w-full overflow-visible"
          role="img"
          aria-label={`Questions per day, ${day(data[0].date)} to ${day(last.date)}. Most in one day: ${max}.`}
        >
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1="0"
              x2={width}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={`${line} L ${width} ${height} L 0 ${height} Z`}
            fill="hsl(var(--primary) / 0.08)"
          />
          <path
            d={line}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.75"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* The latest day, as a dot that keeps its shape however wide the chart is */}
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
          style={{ left: '100%', top: `${(y(last.count) / height) * 100}%` }}
          aria-hidden
        />
        <span className="absolute left-0 top-0 -translate-y-full pb-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {max}
        </span>
      </div>
      <figcaption className="mt-2 flex justify-between font-mono text-[10.5px] tabular-nums text-muted-foreground">
        <span>{day(data[0].date)}</span>
        <span>{day(data[Math.floor(data.length / 2)].date)}</span>
        <span>
          {day(last.date)} · {last.count}
        </span>
      </figcaption>
    </figure>
  )
}

// ─── Plans ───────────────────────────────────────────────────────────────

const PLAN_ROWS: { plan: string; label: string; color: string }[] = [
  { plan: 'FREE', label: 'Free', color: 'bg-muted-foreground/40' },
  { plan: 'PRO', label: 'Pro', color: 'bg-primary' },
  { plan: 'ENTERPRISE', label: 'Enterprise', color: 'bg-signal' },
]

function PlanSplit({ distribution }: { distribution: { plan: string; count: number }[] }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0)
  const rows = PLAN_ROWS.map((row) => {
    const count = distribution.find((d) => d.plan === row.plan)?.count ?? 0
    return { ...row, count, share: total > 0 ? (count / total) * 100 : 0 }
  })

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        {rows.map((row) =>
          row.count > 0 ? (
            <div key={row.plan} className={row.color} style={{ width: `${row.share}%` }} />
          ) : null
        )}
      </div>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.plan} className="border-b border-border/70 last:border-0">
              <td className="py-2">
                <span className={clsx('mr-2 inline-block h-2 w-2 rounded-full', row.color)} />
                {row.label}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">{row.count}</td>
              <td className="w-16 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {Math.round(row.share)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Activity ────────────────────────────────────────────────────────────

const ACTIONS: Record<string, { icon: typeof Activity; text: string; destructive?: boolean }> = {
  LOGIN: { icon: LogIn, text: 'signed in' },
  LOGOUT: { icon: LogOut, text: 'signed out' },
  CREATE_TEAM: { icon: Users, text: 'created a team' },
  DELETE_TEAM: { icon: Trash2, text: 'deleted a team', destructive: true },
  INVITE_MEMBER: { icon: UserPlus, text: 'invited a teammate' },
  REMOVE_MEMBER: { icon: Trash2, text: 'removed a teammate', destructive: true },
  CREATE_CONNECTION: { icon: Link2, text: 'added a connection' },
  ADMIN_DELETE_CONNECTION: {
    icon: Trash2,
    text: 'deleted a connection as admin',
    destructive: true,
  },
  CHANGE_USER_ROLE: { icon: Shield, text: 'changed a role' },
  CHANGE_SETTINGS: { icon: Settings2, text: 'changed settings' },
  QUERY_EXECUTED: { icon: Activity, text: 'ran a question' },
  CONNECTION_CREATED: { icon: Link2, text: 'added a connection' },
  CONNECTION_DELETED: { icon: Trash2, text: 'deleted a connection', destructive: true },
  COMMERCE_CONNECTION_SAVED: { icon: Link2, text: 'saved a store connection' },
  WOOCOMMERCE_ORDERS_IMPORTED: { icon: Link2, text: 'imported WooCommerce orders' },
  PASSWORD_RESET: { icon: Shield, text: 'reset their password' },
  CREATE_API_KEY: { icon: Shield, text: 'created an API key' },
  REVOKE_API_KEY: { icon: Trash2, text: 'revoked an API key', destructive: true },
  DESKTOP_SESSION_REVOKED: { icon: LogOut, text: 'signed out a desktop app' },
  NIGHTLY_INSIGHT_GENERATED: { icon: Activity, text: 'received a nightly summary' },
}

function describe(action: string) {
  return ACTIONS[action] ?? { icon: Activity, text: action.replace(/_/g, ' ').toLowerCase() }
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [volume, setVolume] = useState<QueryVolumePoint[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [statsRes, volumeRes, activityRes, topRes] = await Promise.all([
      getAdminStats(),
      getQueryVolume(30),
      getRecentActivity(12),
      getTopActiveUsers(5),
    ])
    if (statsRes.success && statsRes.data) setStats(statsRes.data)
    if (volumeRes.success && volumeRes.data) setVolume(volumeRes.data)
    if (activityRes.success && activityRes.data) setActivity(activityRes.data)
    if (topRes.success && topRes.data) setTopUsers(topRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalQueries = volume.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-6">
      <AdminTitle
        title="Overview"
        description="Who uses NatureQuery and how much, this month and all time."
      >
        <button onClick={loadData} disabled={loading} className="btn-secondary h-9 text-xs">
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          Refresh
        </button>
      </AdminTitle>

      {loading && !stats ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading the figures…
        </div>
      ) : (
        <>
          <Figures
            items={[
              {
                label: 'People',
                value: (stats?.totalUsers ?? 0).toLocaleString(),
                note: `${stats?.newUsersThisWeek ?? 0} joined this week, ${stats?.newUsersLastWeek ?? 0} last week · ${stats?.twoFactorCount ?? 0} use two-factor`,
              },
              {
                label: 'Questions this month',
                value: (stats?.queriesThisMonth ?? 0).toLocaleString(),
                note: `${(stats?.totalQueries ?? 0).toLocaleString()} all time`,
              },
              {
                label: 'Connections',
                value: (stats?.totalConnections ?? 0).toLocaleString(),
                note: `${stats?.activeConnections ?? 0} active (${stats?.connectionHealthPercent ?? 100}%)`,
              },
              {
                label: 'Monthly revenue',
                value: `$${(stats?.estimatedMRR ?? 0).toLocaleString()}`,
                note: 'Estimate: paid plans × list price',
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <Panel
              label="Questions per day, last 30 days"
              aside={`${totalQueries.toLocaleString()} total`}
              className="lg:col-span-3"
            >
              <div className="pt-4">
                <VolumeChart data={volume} />
              </div>
            </Panel>
            <Panel label="Plans" className="lg:col-span-2">
              <PlanSplit distribution={stats?.planDistribution ?? []} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <Panel label="Recent activity" className="lg:col-span-3">
              {activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="divide-y divide-border/70">
                  {activity.map((item) => {
                    const { icon: Icon, text, destructive } = describe(item.action)
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <Icon
                          className={clsx(
                            'h-3.5 w-3.5 flex-shrink-0',
                            destructive ? 'text-destructive' : 'text-muted-foreground'
                          )}
                          aria-hidden
                        />
                        <p className="min-w-0 flex-1 truncate text-sm">
                          <span className="font-medium">
                            {item.userName || item.userEmail || 'System'}
                          </span>{' '}
                          <span className="text-muted-foreground">{text}</span>
                        </p>
                        <time
                          dateTime={item.createdAt}
                          className="flex-shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                        >
                          {timeAgo(item.createdAt)}
                        </time>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Panel>

            <Panel label="Most questions this month" className="lg:col-span-2">
              {topUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No questions yet.</p>
              ) : (
                <ol className="divide-y divide-border/70">
                  {topUsers.map((user, index) => (
                    <li
                      key={user.userId}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="w-5 font-mono text-xs tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                        {user.name && (
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                      <Chip value={user.plan} />
                      <span className="w-12 text-right font-mono text-sm tabular-nums">
                        {user.queryCount.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, Activity, Database, DollarSign, TrendingUp, TrendingDown,
  Shield, Trophy, Medal, Crown, Loader2, RefreshCw,
  LogIn, LogOut, Trash2, UserPlus, Link2, Settings2,
} from 'lucide-react'
import {
  getAdminStats, getQueryVolume, getRecentActivity, getTopActiveUsers,
  type AdminStats, type QueryVolumePoint, type ActivityItem, type TopUser
} from '@/actions/admin'
import { useAdminClasses, useAdminTheme } from './AdminThemeProvider'

// ─── Hooks ───────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = prevTarget.current
    prevTarget.current = target
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4) // easeOutQuart
      setValue(Math.round(start + (target - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return value
}

// ─── Badge Components ────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const t = useAdminClasses()
  const cls = t.badge[plan as keyof typeof t.badge] || t.badge.FREE
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border uppercase tracking-wider ${cls}`}>
      {plan}
    </span>
  )
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-[11px] text-neutral-500">--</span>
  const pct = previous === 0 ? 100 : ((current - previous) / previous) * 100
  const isUp = pct >= 0
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

// ─── SVG Sparkline ───────────────────────────────────────────────────────

function Sparkline({ data, color = '#8b5cf6', height = 60 }: { data: QueryVolumePoint[]; color?: string; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const width = 400
  const padding = 4

  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - d.count / max) * (height - padding * 2),
  }))

  // Build smooth path using catmull-rom to bezier
  let pathD = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  const fillD = pathD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
  const id = `sparkline-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${id})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* End dot */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
    </svg>
  )
}

// ─── Health Ring ─────────────────────────────────────────────────────────

function HealthRing({ percent, isDark = true }: { percent: number; isDark?: boolean }) {
  const size = 64
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  const color = percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444'
  const trackColor = isDark ? 'rgb(38 38 38)' : 'rgb(226 232 240)'
  const textColor = isDark ? '#ffffff' : '#0f172a'

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="health-ring" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={textColor} style={{ fontSize: 12, fontWeight: 700 }} transform={`rotate(90 ${size / 2} ${size / 2})`}>
        {percent}%
      </text>
    </svg>
  )
}

// ─── Plan Donut Chart ────────────────────────────────────────────────────

function PlanDonut({ distribution, total, isDark = true }: { distribution: { plan: string; count: number }[]; total: number; isDark?: boolean }) {
  const size = 160
  const stroke = 20
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const COLORS: Record<string, string> = {
    FREE: '#6b7280',
    PRO: '#3b82f6',
    ENTERPRISE: '#8b5cf6',
  }

  let offset = 0
  const segments = distribution.map(d => {
    const pct = total > 0 ? d.count / total : 0
    const seg = { plan: d.plan, count: d.count, pct, offset, color: COLORS[d.plan] || '#6b7280' }
    offset += pct * circumference
    return seg
  })

  const trackColor = isDark ? 'rgb(38 38 38)' : 'rgb(226 232 240)'
  const centerText = isDark ? '#ffffff' : '#0f172a'
  const centerSub = isDark ? '#6b7280' : '#94a3b8'
  const legendText = isDark ? '#9ca3af' : '#64748b'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
          {segments.map((seg, i) => (
            <circle
              key={seg.plan}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${seg.pct * circumference} ${circumference}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="round"
              className="donut-segment"
              style={{ '--donut-circumference': `${circumference}px`, animationDelay: `${i * 0.15}s` } as React.CSSProperties}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold stat-number" style={{ color: centerText }}>{total}</span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: centerSub }}>Users</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        {segments.map(seg => (
          <div key={seg.plan} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-xs" style={{ color: legendText }}>
              {seg.plan} <span className="font-semibold" style={{ color: centerText }}>{seg.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Action Icons ────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, { icon: typeof Activity; color: string }> = {
  LOGIN: { icon: LogIn, color: 'text-emerald-400' },
  LOGOUT: { icon: LogOut, color: 'text-neutral-500' },
  CREATE_TEAM: { icon: Users, color: 'text-blue-400' },
  DELETE_TEAM: { icon: Trash2, color: 'text-red-400' },
  INVITE_MEMBER: { icon: UserPlus, color: 'text-blue-400' },
  REMOVE_MEMBER: { icon: Trash2, color: 'text-red-400' },
  CREATE_CONNECTION: { icon: Link2, color: 'text-purple-400' },
  ADMIN_DELETE_CONNECTION: { icon: Trash2, color: 'text-red-400' },
  CHANGE_USER_ROLE: { icon: Shield, color: 'text-amber-400' },
  CHANGE_SETTINGS: { icon: Settings2, color: 'text-neutral-400' },
}

function getActionDisplay(action: string) {
  const entry = ACTION_ICON[action] || { icon: Activity, color: 'text-neutral-400' }
  const label = action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
  return { ...entry, label }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Rank Icon ───────────────────────────────────────────────────────────

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-4 h-4 text-amber-400" />
  if (rank === 2) return <Medal className="w-4 h-4 text-neutral-300" />
  if (rank === 3) return <Trophy className="w-4 h-4 text-amber-700" />
  return <span className="text-xs text-neutral-500 font-mono w-4 text-center">{rank}</span>
}

// ─── Main Page ───────────────────────────────────────────────────────────

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

  useEffect(() => { loadData() }, [loadData])

  const animatedUsers = useCountUp(stats?.totalUsers ?? 0)
  const animatedQueries = useCountUp(stats?.queriesThisMonth ?? 0)
  const animatedMRR = useCountUp(stats?.estimatedMRR ?? 0)
  const animatedConnections = useCountUp(stats?.activeConnections ?? 0)

  const t = useAdminClasses()
  const { isDark } = useAdminTheme()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className={`text-sm ${t.textMuted}`}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const totalQueries = volume.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-6">
      {/* Page header row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${t.text}`}>Admin Panel</h2>
          <p className={`text-sm mt-0.5 ${t.textMuted}`}>Platform management & usage overview</p>
        </div>
        <button
          onClick={loadData}
          className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-colors h-fit ${t.btnSecondary}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="space-y-6">


      {/* ─── Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <TrendIndicator current={stats?.newUsersThisWeek ?? 0} previous={stats?.newUsersLastWeek ?? 0} />
          </div>
          <div className={`text-3xl font-bold stat-number mb-1 ${t.text}`}>{animatedUsers}</div>
          <p className={`text-xs ${t.textMuted}`}>Total Users</p>
          <div className={`mt-3 flex items-center gap-3 text-[11px] ${t.textMuted}`}>
            <span><span className="text-emerald-500 font-semibold">+{stats?.newUsersThisWeek ?? 0}</span> this week</span>
            <span className={t.textTiny}>·</span>
            <span><Shield className="w-3 h-3 inline text-purple-500" /> {stats?.twoFactorCount ?? 0} with 2FA</span>
          </div>
        </div>

        {/* Queries This Month */}
        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <span className={`text-[11px] ${t.textMuted}`}>{stats?.totalQueries ?? 0} all time</span>
          </div>
          <div className={`text-3xl font-bold stat-number mb-1 ${t.text}`}>{animatedQueries}</div>
          <p className={`text-xs ${t.textMuted}`}>Queries This Month</p>
          <div className="mt-3 h-8">
            <Sparkline data={volume.slice(-14)} color="#10b981" height={32} />
          </div>
        </div>

        {/* Connections Health */}
        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                <Database className="w-5 h-5 text-purple-500" />
              </div>
              <div className={`text-3xl font-bold stat-number mb-1 ${t.text}`}>{animatedConnections}</div>
              <p className={`text-xs ${t.textMuted}`}>Active / {stats?.totalConnections ?? 0} total</p>
            </div>
            <HealthRing percent={stats?.connectionHealthPercent ?? 100} isDark={isDark} />
          </div>
        </div>

        {/* Estimated MRR */}
        <div className={`rounded-2xl border ${t.card} p-5 hover-lift`}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-500" />
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>MRR</span>
          </div>
          <div className={`text-3xl font-bold stat-number mb-1 ${t.text}`}>${animatedMRR.toLocaleString()}</div>
          <p className={`text-xs ${t.textMuted}`}>Estimated Monthly Revenue</p>
          <div className={`mt-3 flex gap-0.5 h-2 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-slate-100'}`}>
            {stats?.planDistribution.map(pd => {
              const total = stats.totalUsers || 1
              const pct = (pd.count / total) * 100
              const color = pd.plan === 'ENTERPRISE' ? 'bg-purple-500' : pd.plan === 'PRO' ? 'bg-blue-500' : isDark ? 'bg-neutral-600' : 'bg-slate-300'
              return <div key={pd.plan} className={`${color} transition-all duration-1000`} style={{ width: `${pct}%` }} title={`${pd.plan}: ${pd.count}`} />
            })}
          </div>
        </div>
      </div>

      {/* ─── Middle Section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Query Volume Chart */}
        <div className={`lg:col-span-3 rounded-2xl border ${t.card} p-6`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-sm font-semibold ${t.text}`}>Query Volume</h3>
              <p className={`text-xs mt-0.5 ${t.textMuted}`}>Last 30 days</p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              {totalQueries.toLocaleString()} queries
            </div>
          </div>
          <div className="h-[140px]">
            <Sparkline data={volume} color="#8b5cf6" height={140} />
          </div>
          <div className={`flex justify-between mt-2 text-[10px] font-mono ${t.textTiny}`}>
            <span>{volume[0]?.date.slice(5) || ''}</span>
            <span>{volume[Math.floor(volume.length / 2)]?.date.slice(5) || ''}</span>
            <span>{volume[volume.length - 1]?.date.slice(5) || ''}</span>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className={`lg:col-span-2 rounded-2xl border ${t.card} p-6`}>
          <h3 className={`text-sm font-semibold ${t.text}`}>Plan Distribution</h3>
          <p className={`text-xs mt-0.5 mb-6 ${t.textMuted}`}>Users by subscription tier</p>
          <PlanDonut distribution={stats?.planDistribution || []} total={stats?.totalUsers ?? 0} isDark={isDark} />
        </div>
      </div>

      {/* ─── Bottom Section ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Activity Timeline */}
        <div className={`lg:col-span-3 rounded-2xl border ${t.card} p-6`}>
          <h3 className={`text-sm font-semibold mb-5 ${t.text}`}>Recent Activity</h3>
          {activity.length === 0 ? (
            <p className={`text-sm text-center py-8 ${t.textTiny}`}>No activity yet</p>
          ) : (
            <div className="space-y-0">
              {activity.map((item, i) => {
                const { icon: Icon, color, label } = getActionDisplay(item.action)
                return (
                  <div key={item.id} className="flex gap-4 pb-4 last:pb-0 group">
                    <div className={`relative flex-shrink-0 ${i < activity.length - 1 ? 'timeline-dot' : ''}`}>
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${isDark ? 'bg-neutral-800 border-neutral-700/50 group-hover:border-neutral-600' : 'bg-slate-100 border-slate-200 group-hover:border-slate-300'}`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${t.text}`}>{item.userName || 'System'}</span>
                        <span className={`text-xs ${t.textMuted}`}>{label}</span>
                      </div>
                      {item.userEmail && <p className={`text-[11px] truncate ${t.textTiny}`}>{item.userEmail}</p>}
                    </div>
                    <span className={`text-[11px] flex-shrink-0 pt-1 ${t.textTiny}`}>{timeAgo(item.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Active Users */}
        <div className={`lg:col-span-2 rounded-2xl border ${t.card} p-6`}>
          <h3 className={`text-sm font-semibold ${t.text}`}>Top Active Users</h3>
          <p className={`text-[11px] mt-0.5 mb-5 ${t.textMuted}`}>By queries this month</p>
          {topUsers.length === 0 ? (
            <p className={`text-sm text-center py-8 ${t.textTiny}`}>No activity yet</p>
          ) : (
            <div className="space-y-1">
              {topUsers.map((user, i) => (
                <div key={user.userId} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${isDark ? 'hover:bg-neutral-800/50' : 'hover:bg-slate-50'}`}>
                  <RankIcon rank={i + 1} />
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${t.text}`}>{user.name || 'Unknown'}</p>
                    <p className={`text-[11px] truncate ${t.textMuted}`}>{user.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold stat-number ${t.text}`}>{user.queryCount}</span>
                    <PlanBadge plan={user.plan} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}


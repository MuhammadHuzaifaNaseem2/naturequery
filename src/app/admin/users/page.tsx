'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  Search, Shield, ShieldCheck, ShieldOff, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, ChevronDown, Loader2, Users, Database,
  Activity, RefreshCw,
} from 'lucide-react'
import {
  getAdminUsers, updateUserRole,
  type AdminUserInfo, type AdminUserFilters,
} from '@/actions/admin'
import { useAdminClasses, useAdminTheme } from '../AdminThemeProvider'

// ─── Badges ──────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const t = useAdminClasses()
  const cls = t.badge[plan as keyof typeof t.badge] || t.badge.FREE
  return <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border uppercase tracking-wider ${cls}`}>{plan}</span>
}

function RoleBadge({ role }: { role: string }) {
  const t = useAdminClasses()
  const cls = t.badge[role as keyof typeof t.badge] || t.badge.VIEWER
  return <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border uppercase tracking-wider ${cls}`}>{role}</span>
}

// ─── Toast ───────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg shadow-xl text-white text-sm font-medium z-50 animate-slideUp ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
      {message}
    </div>
  )
}

// ─── Time Ago ────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserInfo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const filters: AdminUserFilters = { page, pageSize: 20 }
    if (searchTerm) filters.search = searchTerm
    if (roleFilter) filters.role = roleFilter
    if (planFilter) filters.plan = planFilter

    const res = await getAdminUsers(filters)
    if (res.success && res.data) {
      setUsers(res.data.users)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } else {
      showToast(res.error || 'Failed to load users', 'error')
    }
    setLoading(false)
  }, [page, searchTerm, roleFilter, planFilter, showToast])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  async function handleRoleChange(userId: string, newRole: string) {
    setSavingRole(true)
    const res = await updateUserRole(userId, newRole as 'ADMIN' | 'ANALYST' | 'VIEWER')
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      showToast(`Role updated to ${newRole}`, 'success')
    } else {
      showToast(res.error || 'Failed to update role', 'error')
    }
    setChangingRoleId(null)
    setSavingRole(false)
  }

  const t = useAdminClasses()
  const { isDark } = useAdminTheme()

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${t.text}`}>All Users</h2>
          <p className={`text-sm mt-0.5 ${t.textMuted}`}>{total} registered accounts</p>
        </div>
        <button onClick={loadUsers} className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl border transition-colors ${t.btnSecondary}`}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className={`rounded-xl border ${t.card} p-4 flex flex-wrap gap-3 items-center`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${t.textSubtle}`} />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search name or email..."
            className={`w-full border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 transition-all ${t.input}`} />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} className={`border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${t.select}`}>
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="ANALYST">Analyst</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }} className={`border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50 ${t.select}`}>
          <option value="">All Plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className={`rounded-xl border ${t.card} overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <Users className={`w-10 h-10 mx-auto mb-3 ${t.textTiny}`} />
            <p className={`text-sm ${t.textMuted}`}>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${t.tableHead}`}>
                  {['User', 'Role', 'Plan', 'Security', 'Queries', 'Connections', 'Joined'].map((h, i) => (
                    <th key={h} className={`p-4 text-[10px] font-semibold uppercase tracking-wider ${i >= 4 && i <= 5 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${t.tableRow.split(' ')[1]}`}>
                {users.map(user => (
                  <Fragment key={user.id}>
                    <tr onClick={() => setExpandedId(expandedId === user.id ? null : user.id)} className={`transition-colors cursor-pointer group ${t.tableRow.split(' ')[0]}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm">
                            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${t.text}`}>{user.name || 'No name'}</p>
                            <p className={`text-[11px] truncate ${t.textMuted}`}>{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        {changingRoleId === user.id ? (
                          <div className="flex items-center gap-1.5">
                            <select defaultValue={user.role} onChange={e => handleRoleChange(user.id, e.target.value)} disabled={savingRole}
                              className={`border rounded-lg px-2 py-1 text-xs focus:outline-none ${t.select}`} autoFocus onBlur={() => !savingRole && setChangingRoleId(null)}>
                              <option value="ADMIN">ADMIN</option>
                              <option value="ANALYST">ANALYST</option>
                              <option value="VIEWER">VIEWER</option>
                            </select>
                            {savingRole && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
                          </div>
                        ) : (
                          <button onClick={() => setChangingRoleId(user.id)} className="hover:opacity-75 transition-opacity" title="Click to change role">
                            <RoleBadge role={user.role} />
                          </button>
                        )}
                      </td>
                      <td className="p-4"><PlanBadge plan={user.plan} /></td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <span title={user.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}>
                            {user.twoFactorEnabled ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <ShieldOff className={`w-4 h-4 ${t.textTiny}`} />}
                          </span>
                          <span title={user.onboardingCompleted ? 'Onboarded' : 'Not onboarded'}>
                            {user.onboardingCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className={`w-4 h-4 ${t.textTiny}`} />}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right"><span className={`text-sm font-bold stat-number ${t.text}`}>{user.queryCount}</span></td>
                      <td className="p-4 text-right"><span className={`text-sm ${t.textMuted}`}>{user.connectionCount}</span></td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${t.textMuted}`}>{timeAgo(user.createdAt)}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${t.textTiny} ${expandedId === user.id ? 'rotate-180' : ''}`} />
                        </div>
                      </td>
                    </tr>
                    {expandedId === user.id && (
                      <tr key={`${user.id}-detail`}>
                        <td colSpan={7} className={`border-b ${t.tableExpanded}`}>
                          <div className="p-5 animate-slideDown">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {[
                                { label: 'User ID', value: user.id, mono: true },
                                { label: 'Plan Status', value: user.planStatus },
                                { label: 'Monthly Queries', value: String(user.queryCount) },
                                { label: 'Connections', value: String(user.connectionCount) },
                                { label: '2FA', value: user.twoFactorEnabled ? 'Enabled' : 'Disabled' },
                                { label: 'Onboarding', value: user.onboardingCompleted ? 'Completed' : 'Pending' },
                                { label: 'Joined', value: new Date(user.createdAt).toLocaleDateString() },
                                { label: 'Email', value: user.email },
                              ].map(({ label, value, mono }) => (
                                <div key={label}>
                                  <p className={`text-[10px] uppercase tracking-wider mb-1 ${t.textSubtle}`}>{label}</p>
                                  <p className={`text-xs truncate ${mono ? 'font-mono' : ''} ${t.textMuted}`}>{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-neutral-800' : 'border-slate-200'}`}>
            <p className={`text-xs ${t.textMuted}`}>Page {page} of {totalPages} · {total} users</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={`p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed ${t.pagination}`}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed ${t.pagination}`}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

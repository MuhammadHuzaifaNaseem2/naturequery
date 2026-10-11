'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Search, ChevronLeft, ChevronRight, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import {
  getAdminUsers,
  updateUserRole,
  type AdminUserInfo,
  type AdminUserFilters,
} from '@/actions/admin'
import { AdminTitle, Chip, formatDay, timeAgo } from '../admin-ui'

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
      toast.error(res.error || 'Could not load people. Try Refresh.')
    }
    setLoading(false)
  }, [page, searchTerm, roleFilter, planFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Search after typing stops
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // The role chip in the row shows the change, so success needs no toast.
  async function handleRoleChange(userId: string, newRole: string) {
    setSavingRole(true)
    const res = await updateUserRole(userId, newRole as 'ADMIN' | 'ANALYST' | 'VIEWER')
    if (res.success) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
    } else {
      toast.error(res.error || 'Could not change the role.')
    }
    setChangingRoleId(null)
    setSavingRole(false)
  }

  return (
    <div className="space-y-5">
      <AdminTitle
        title="People"
        description={`${total.toLocaleString()} ${total === 1 ? 'account' : 'accounts'}`}
      >
        <button onClick={loadUsers} disabled={loading} className="btn-secondary h-9 text-xs">
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          Refresh
        </button>
      </AdminTitle>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="admin-people-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search by name or email"
            className="input pl-9"
          />
        </div>
        <select
          id="admin-people-role"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Role"
          className="input w-auto"
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="ANALYST">Analyst</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <select
          id="admin-people-plan"
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Plan"
          className="input w-auto"
        >
          <option value="">All plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading && users.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading people…
          </div>
        ) : users.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            No one matches these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>Two-factor</th>
                  <th className="!text-right">Questions</th>
                  <th className="!text-right">Connections</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const expanded = expandedId === user.id
                  return (
                    <Fragment key={user.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : user.id)}
                        className="cursor-pointer"
                        aria-expanded={expanded}
                      >
                        <td>
                          <p className="max-w-[260px] truncate font-medium">
                            {user.name || 'No name'}
                          </p>
                          <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {changingRoleId === user.id ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                defaultValue={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                disabled={savingRole}
                                aria-label={`Role for ${user.email}`}
                                className="input h-8 w-auto py-1 text-xs"
                                autoFocus
                                onBlur={() => !savingRole && setChangingRoleId(null)}
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="ANALYST">ANALYST</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                              {savingRole && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => setChangingRoleId(user.id)}
                              className="rounded focus-ring"
                              title="Change role"
                              aria-label={`Change role for ${user.email}, now ${user.role}`}
                            >
                              <Chip value={user.role} />
                            </button>
                          )}
                        </td>
                        <td>
                          <Chip value={user.plan} />
                        </td>
                        <td className="text-muted-foreground">
                          {user.twoFactorEnabled ? 'On' : 'Off'}
                        </td>
                        <td className="text-right font-mono">{user.queryCount.toLocaleString()}</td>
                        <td className="text-right font-mono text-muted-foreground">
                          {user.connectionCount}
                        </td>
                        <td>
                          <span className="flex items-center gap-2 whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {timeAgo(user.createdAt)}
                            <ChevronDown
                              className={clsx(
                                'h-3.5 w-3.5 transition-transform',
                                expanded && 'rotate-180'
                              )}
                              aria-hidden
                            />
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="hover:!bg-transparent">
                          <td colSpan={7} className="bg-secondary/40">
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 py-2 md:grid-cols-4">
                              {[
                                { label: 'User ID', value: user.id, mono: true },
                                { label: 'Plan status', value: user.planStatus },
                                { label: 'Questions this month', value: String(user.queryCount) },
                                { label: 'Connections', value: String(user.connectionCount) },
                                {
                                  label: 'Two-factor',
                                  value: user.twoFactorEnabled ? 'On' : 'Off',
                                },
                                {
                                  label: 'Onboarding',
                                  value: user.onboardingCompleted ? 'Finished' : 'Not finished',
                                },
                                { label: 'Joined', value: formatDay(user.createdAt) },
                                { label: 'Email', value: user.email },
                              ].map(({ label, value, mono }) => (
                                <div key={label} className="min-w-0">
                                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                                    {label}
                                  </dt>
                                  <dd
                                    className={clsx('mt-0.5 truncate text-xs', mono && 'font-mono')}
                                  >
                                    {value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} people
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost h-8 w-8 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost h-8 w-8 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

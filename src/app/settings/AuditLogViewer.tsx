'use client'

import { useState, useEffect } from 'react'
import { ScrollText, ChevronLeft, ChevronRight, Loader2, Filter, Download } from 'lucide-react'
import { getAuditLogs, getAuditLogActions, exportAuditLogsCSV } from '@/actions/audit'

interface AuditLogEntry {
  id: string
  action: string
  resource: string | null
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: Date
  user: { id: string; name: string | null; email: string; image: string | null } | null
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-500/10 text-green-600',
  LOGOUT: 'bg-gray-500/10 text-gray-500',
  CREATE_TEAM: 'bg-blue-500/10 text-blue-600',
  DELETE_TEAM: 'bg-red-500/10 text-red-600',
  INVITE_MEMBER: 'bg-purple-500/10 text-purple-600',
  REMOVE_MEMBER: 'bg-orange-500/10 text-orange-600',
  CREATE_API_KEY: 'bg-amber-500/10 text-amber-600',
  REVOKE_API_KEY: 'bg-red-500/10 text-red-600',
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>('')
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    loadActions()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [page, actionFilter])

  async function loadActions() {
    const result = await getAuditLogActions()
    if (result.success && result.data) {
      setAvailableActions(result.data)
    }
  }

  async function loadLogs() {
    setLoading(true)
    const result = await getAuditLogs({
      page,
      pageSize: 25,
      ...(actionFilter ? { action: actionFilter } : {}),
    })
    if (result.success && result.data) {
      setLogs(result.data.logs as AuditLogEntry[])
      setTotalPages(result.data.totalPages)
      setTotal(result.data.total)
    }
    setLoading(false)
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatAction(action: string) {
    return action.replace(/_/g, ' ').toLowerCase()
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const result = await exportAuditLogsCSV({ action: actionFilter })
      if (result.success && result.data) {
        const { base64, filename } = result.data
        const binaryString = atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter and Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All actions</option>
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting || logs.length === 0}
            className="btn-secondary text-sm py-1.5"
            title="Export to CSV"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {total} event{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8">
          <ScrollText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No audit logs</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${ACTION_COLORS[log.action] || 'bg-secondary text-muted-foreground'
                  }`}
              >
                {formatAction(log.action)}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm">
                  {log.user?.name || log.user?.email || 'System'}
                </span>
                {log.resource && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {log.resource}
                    {log.resourceId && ` #${log.resourceId.slice(0, 8)}`}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm py-1.5 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-sm py-1.5 disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

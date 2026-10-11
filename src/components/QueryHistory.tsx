'use client'

import { useState, useCallback } from 'react'
import { Trash2, AlertCircle, ExternalLink, Search, Download } from 'lucide-react'
import Link from 'next/link'
import type { QueryHistoryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'

interface QueryHistoryProps {
  history: QueryHistoryItem[]
  onSelectQuery: (item: QueryHistoryItem) => void
  onClearHistory: () => void
  onDeleteEntry?: (id: string) => void
  compact?: boolean
}

export function QueryHistory({
  history,
  onSelectQuery,
  onClearHistory,
  onDeleteEntry,
  compact,
}: QueryHistoryProps) {
  const { t, locale } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; question: string } | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  const handleExportCSV = () => {
    if (history.length === 0) return
    const headers = [
      'Date',
      'Time',
      'Question',
      'SQL',
      'Status',
      'Rows',
      'Execution Time (ms)',
      'Connection',
    ]
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const csvContent = [
      headers.join(','),
      ...filteredHistory.map((h) => {
        const d = new Date(h.createdAt)
        const localDate = new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: tz,
        }).format(d)
        const localTime = new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: tz,
        }).format(d)
        return [
          `"${localDate}"`,
          `"${localTime}"`,
          `"${h.question.replace(/"/g, '""')}"`,
          `"${h.sql.replace(/"/g, '""')}"`,
          `"${h.status}"`,
          `"${h.rowCount ?? ''}"`,
          `"${h.executionTimeMs ?? ''}"`,
          `"${h.connectionName ?? ''}"`,
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'query_history.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatTime = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).format(d)
    },
    [locale]
  )

  const formatDate = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr)
      const now = new Date()

      // Compare using local date strings to handle timezone properly
      const itemDate = d.toLocaleDateString()
      const todayDate = now.toLocaleDateString()
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toLocaleDateString()

      if (itemDate === todayDate) {
        return t('common.today')
      } else if (itemDate === yesterdayDate) {
        return t('common.yesterday')
      }
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).format(d)
    },
    [locale, t]
  )

  // Filter history
  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sql.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Group history by date
  const groupedHistory = filteredHistory.reduce(
    (groups, item) => {
      const dateKey = formatDate(item.createdAt)
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(item)
      return groups
    },
    {} as Record<string, QueryHistoryItem[]>
  )

  if (history.length === 0 && !searchTerm && statusFilter === 'all') {
    return (
      <div className="px-4 py-8">
        <p className="font-serif text-lg leading-snug text-foreground">
          {t('dashboard.history.noHistory')}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {t('dashboard.history.yourRecent')}
        </p>
      </div>
    )
  }

  const dialogCard =
    'w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)] animate-fadeIn'

  return (
    <div className="flex h-full flex-col">
      {/* Delete one entry */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div role="alertdialog" aria-labelledby="delete-history-title" className={dialogCard}>
            <div className="p-5">
              <h3 id="delete-history-title" className="text-sm font-semibold">
                Delete this question from history?
              </h3>
              <p className="mt-2 line-clamp-2 font-serif text-[15px] italic leading-snug text-foreground/85">
                {deleteConfirm.question}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">This can’t be undone.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteEntry?.(deleteConfirm.id)
                  setDeleteConfirm(null)
                }}
                className="btn-destructive px-3 py-1.5"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear everything */}
      {clearConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div role="alertdialog" aria-labelledby="clear-history-title" className={dialogCard}>
            <div className="p-5">
              <h3 id="clear-history-title" className="text-sm font-semibold">
                Clear all history?
              </h3>
              <p className="mt-1.5 text-xs text-muted-foreground">
                This permanently deletes all {history.length} entries.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setClearConfirm(false)} className="btn-secondary px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearHistory()
                  setClearConfirm(false)
                }}
                className="btn-destructive px-3 py-1.5"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <label className="flex h-8 items-center gap-2 rounded-md border border-transparent bg-secondary/70 px-2.5 focus-within:border-input focus-within:bg-card">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="text"
            placeholder={t('dashboard.sidebar.searchPlaceholder')}
            aria-label={t('dashboard.sidebar.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="Filter by result"
            className="cursor-pointer border-none bg-transparent p-0 text-xs text-muted-foreground outline-none hover:text-foreground focus:ring-0"
          >
            <option value="all" className="bg-card text-foreground">
              {t('dashboard.sidebar.allStatus')}
            </option>
            <option value="success" className="bg-card text-foreground">
              {t('dashboard.history.success')}
            </option>
            <option value="error" className="bg-card text-foreground">
              {t('dashboard.history.failed')}
            </option>
          </select>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              title="Export as CSV"
            >
              <Download className="h-3 w-3" aria-hidden />
              {t('dashboard.sidebar.exportHistory')}
            </button>
            <button
              onClick={() => setClearConfirm(true)}
              className="transition-colors hover:text-destructive"
            >
              {t('dashboard.history.clear')}
            </button>
          </div>
        </div>
      </div>

      {/* The questions, newest first */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">
            {t('dashboard.sidebar.historyNoResults')}
          </p>
        ) : (
          Object.entries(groupedHistory).map(([dateKey, items]) => (
            <div key={dateKey}>
              <p className="sticky top-0 z-[1] border-b border-border bg-background px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {dateKey}
              </p>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative cursor-pointer border-b border-border/70 px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  onClick={() => onSelectQuery(item)}
                >
                  <p className="line-clamp-2 pr-5 font-serif text-[15px] leading-snug text-foreground">
                    {item.question || item.sql}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {item.status === 'error' ? (
                      <AlertCircle className="h-3 w-3 text-destructive" aria-label="Failed" />
                    ) : null}
                    <span>{formatTime(item.createdAt)}</span>
                    {item.rowCount != null && (
                      <span>
                        {item.rowCount} {t('common.rows')}
                      </span>
                    )}
                    {item.executionTimeMs != null && <span>{item.executionTimeMs} ms</span>}
                  </p>
                  {item.status === 'error' && item.errorMessage && (
                    <p className="mt-1 truncate text-xs text-destructive">{item.errorMessage}</p>
                  )}
                  {onDeleteEntry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm({ id: item.id, question: item.question })
                      }}
                      className="absolute right-2 top-2.5 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      title="Delete"
                      aria-label="Delete from history"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}

        {/* View All link */}
        {!compact && history.length >= 10 && (
          <Link
            href="/dashboard/history"
            className="flex items-center justify-center gap-1 p-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('dashboard.history.viewAllHistory')}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}

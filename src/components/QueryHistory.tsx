'use client'

import { useState, useCallback } from 'react'
import { Trash2, AlertCircle, CheckCircle2, Clock, ExternalLink, Search, Filter, Download, AlertTriangle, X } from 'lucide-react'
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

export function QueryHistory({ history, onSelectQuery, onClearHistory, onDeleteEntry, compact }: QueryHistoryProps) {
  const { t, locale } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; question: string } | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  const handleExportCSV = () => {
    if (history.length === 0) return
    const headers = ['Date', 'Time', 'Question', 'SQL', 'Status', 'Rows', 'Execution Time (ms)', 'Connection']
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const csvContent = [
      headers.join(','),
      ...filteredHistory.map(h => {
        const d = new Date(h.createdAt)
        const localDate = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(d)
        const localTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz }).format(d)
        return [
          `"${localDate}"`,
          `"${localTime}"`,
          `"${h.question.replace(/"/g, '""')}"`,
          `"${h.sql.replace(/"/g, '""')}"`,
          `"${h.status}"`,
          `"${h.rowCount ?? ''}"`,
          `"${h.executionTimeMs ?? ''}"`,
          `"${h.connectionName ?? ''}"`
        ].join(',')
      })
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

  const formatTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(d)
  }, [locale])

  const formatDate = useCallback((dateStr: string) => {
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
  }, [locale, t])

  // Filter history
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sql.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Group history by date
  const groupedHistory = filteredHistory.reduce((groups, item) => {
    const dateKey = formatDate(item.createdAt)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(item)
    return groups
  }, {} as Record<string, QueryHistoryItem[]>)

  if (history.length === 0 && !searchTerm && statusFilter === 'all') {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>{t('dashboard.history.noHistory')}</p>
        <p className="text-xs mt-1">{t('dashboard.history.yourRecent')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden animate-fadeIn">
            {/* Header with icon */}
            <div className="flex items-center gap-3 p-5 pb-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Delete History Entry</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone</p>
              </div>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="p-1 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {/* Body */}
            <div className="px-5 pb-4">
              <div className="p-3 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground">Query:</p>
                <p className="text-sm font-medium mt-0.5 line-clamp-2">{deleteConfirm.question}</p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/20">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteEntry?.(deleteConfirm.id)
                  setDeleteConfirm(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      {clearConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden animate-fadeIn">
            <div className="flex items-center gap-3 p-5 pb-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Clear All History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This will permanently delete all {history.length} entries</p>
              </div>
              <button
                onClick={() => setClearConfirm(false)}
                className="p-1 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-secondary/20">
              <button
                onClick={() => setClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearHistory()
                  setClearConfirm(false)
                }}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {t('dashboard.sidebar.history')}
          <span className="text-xs text-muted-foreground">({history.length})</span>
        </button>
        <button
          onClick={() => setClearConfirm(true)}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          title={t('dashboard.history.clear')}
        >
          {t('dashboard.history.clear')}
        </button>
      </div>

      {/* History list */}
      {isExpanded && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Controls Bar */}
          <div className="p-3 border-b border-border/50 flex flex-col gap-3 bg-secondary/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('dashboard.sidebar.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs bg-transparent text-muted-foreground border-none focus:ring-0 p-0 cursor-pointer hover:text-foreground outline-none"
                >
                  <option value="all" className="bg-card text-foreground">{t('dashboard.sidebar.allStatus')}</option>
                  <option value="success" className="bg-card text-foreground">{t('dashboard.history.success')}</option>
                  <option value="error" className="bg-card text-foreground">{t('dashboard.history.failed')}</option>
                </select>
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                {t('dashboard.sidebar.exportHistory')}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredHistory.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                {t('dashboard.sidebar.historyNoResults')}
              </div>
            ) : Object.entries(groupedHistory).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                {dateKey}
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="w-full p-3 text-left hover:bg-secondary/50 border-b border-border/50 transition-colors group cursor-pointer"
                  onClick={() => onSelectQuery(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {/* Status indicator */}
                      {item.status === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      )}
                      <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                        {item.question}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(item.createdAt)}
                      </span>
                      {onDeleteEntry && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm({ id: item.id, question: item.question })
                          }}
                          className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-5">
                    <code className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                      {item.sql.substring(0, 50)}{item.sql.length > 50 ? '...' : ''}
                    </code>
                    {item.rowCount != null && (
                      <span className="text-xs text-muted-foreground">
                        {item.rowCount} {t('common.rows')}
                      </span>
                    )}
                    {item.executionTimeMs != null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {item.executionTimeMs}ms
                      </span>
                    )}
                  </div>
                  {item.connectionName && (
                    <div className="mt-1 ml-5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                        {item.connectionName}
                      </span>
                    </div>
                  )}
                  {item.status === 'error' && item.errorMessage && (
                    <p className="text-xs text-destructive mt-1 ml-5 truncate">{item.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* View All link */}
          {!compact && history.length >= 10 && (
            <Link
              href="/dashboard/history"
              className="flex items-center justify-center gap-1 p-3 text-xs text-primary hover:bg-primary/5 transition-colors"
            >
              {t('dashboard.history.viewAllHistory')}
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          </div>
        </div>
      )}
    </div>
  )
}


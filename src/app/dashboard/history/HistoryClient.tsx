'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Search,
  Trash2,
  Play,
  Bookmark,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import Link from 'next/link'
import type { QueryHistoryItem } from '@/actions/queries'
import {
  getQueryHistory,
  deleteHistoryEntry,
  clearQueryHistory,
  saveQuery,
} from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'

export function HistoryClient() {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [items, setItems] = useState<QueryHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Save modal
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')

  // Expanded SQL
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Clear modal
  const [showClearModal, setShowClearModal] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch data
  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    const result = await getQueryHistory({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      page,
      pageSize: 20,
    })
    if (result.success && result.data) {
      setItems(result.data.items)
      setTotal(result.data.total)
      setTotalPages(result.data.totalPages)
    }
    setIsLoading(false)
  }, [debouncedSearch, statusFilter, page])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const handleDelete = async (id: string) => {
    const result = await deleteHistoryEntry(id)
    if (result.success) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setTotal((prev) => prev - 1)
      toast.success(t('dashboard.history.entrySaved'))
    }
  }

  const handleClearAll = () => {
    setShowClearModal(true)
  }

  const confirmClearAll = async () => {
    setShowClearModal(false)
    const result = await clearQueryHistory()
    if (result.success) {
      setItems([])
      setTotal(0)
      setTotalPages(1)
      toast.success(t('dashboard.history.historyClearedSuccess'))
    }
  }

  const handleSave = async (item: QueryHistoryItem) => {
    if (!saveName.trim()) return
    const result = await saveQuery({
      name: saveName,
      question: item.question,
      sql: item.sql,
      connectionId: item.connectionId,
      connectionName: item.connectionName,
    })
    if (result.success) {
      toast.success(t('dashboard.history.querySaved'), { description: saveName })
      setSavingId(null)
      setSaveName('')
    }
  }

  const handleRerun = (item: QueryHistoryItem) => {
    const params = new URLSearchParams({
      q: item.question,
      sql: item.sql,
    })
    router.push(`/dashboard?${params.toString()}`)
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold">{t('dashboard.history.title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {total === 1 ? t('dashboard.history.totalQuery', { count: total }) : t('dashboard.history.totalQueries', { count: total })}
                </p>
              </div>
            </div>
            {total > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                {t('dashboard.history.clearAll')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dashboard.history.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            {['', 'success', 'error'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {status === '' ? t('common.filter') : status === 'success' ? t('dashboard.history.success') : t('dashboard.history.error')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t('dashboard.history.noResults')}</p>
            {(debouncedSearch || statusFilter) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('') }}
                className="mt-2 text-sm text-primary hover:underline"
              >
                {t('dashboard.history.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.status')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.question')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.connection')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.rows')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.time')}</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.date')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.history.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/30 transition-colors group">
                      <td className="px-4 py-3">
                        {item.status === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm font-medium truncate">{item.question}</p>
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="text-xs text-muted-foreground hover:text-primary mt-0.5"
                        >
                          {expandedId === item.id ? t('dashboard.history.hideSql') : t('dashboard.history.showSql')}
                        </button>
                        {expandedId === item.id && (
                          <pre className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground overflow-x-auto max-w-sm">
                            {item.sql}
                          </pre>
                        )}
                        {item.status === 'error' && item.errorMessage && (
                          <p className="text-xs text-destructive mt-0.5 truncate max-w-xs">{item.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.connectionName ? (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                            {item.connectionName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.rowCount ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.executionTimeMs != null ? `${item.executionTimeMs}ms` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleRerun(item)}
                            className="p-1.5 hover:bg-primary/10 rounded transition-colors"
                            title="Re-run query"
                          >
                            <Play className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button
                            onClick={() => { setSavingId(item.id); setSaveName(item.question.slice(0, 40)) }}
                            className="p-1.5 hover:bg-primary/10 rounded transition-colors"
                            title="Save query"
                          >
                            <Bookmark className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>

                        {/* Inline save modal */}
                        {savingId === item.id && (
                          <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-border">
                            <input
                              type="text"
                              value={saveName}
                              onChange={(e) => setSaveName(e.target.value)}
                              placeholder={t('dashboard.history.queryName')}
                              className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(item)
                                if (e.key === 'Escape') setSavingId(null)
                              }}
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => handleSave(item)}
                                className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                              >
                                {t('common.save')}
                              </button>
                              <button
                                onClick={() => setSavingId(null)}
                                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.history.pageOf', { page, total: totalPages })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear All Confirm Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-card border border-border shadow-2xl rounded-2xl p-6 w-full max-w-md animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold">{t('dashboard.history.clearAll')}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Are you sure you want to clear your entire query history? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={confirmClearAll}
                className="btn-primary flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowClearModal(false)}
                className="btn-secondary flex-1"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

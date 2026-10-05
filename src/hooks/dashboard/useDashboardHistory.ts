import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import {
  addHistoryEntry,
  saveQuery as saveQueryAction,
  deleteSavedQuery as deleteSavedQueryAction,
  toggleFavorite as toggleFavoriteAction,
  clearQueryHistory as clearQueryHistoryAction,
  deleteHistoryEntry,
  getQueryHistory,
} from '@/actions/queries'
import { generateShareLink } from '@/actions/sharing'
import { SavedConnection } from '@/app/dashboard/types'

const COUNTS_CACHE_KEY = 'rf_sidebar_counts'

function readCachedCounts(): { history: number; saved: number } {
  if (typeof window === 'undefined') return { history: 0, saved: 0 }
  try {
    const raw = localStorage.getItem(COUNTS_CACHE_KEY)
    if (!raw) return { history: 0, saved: 0 }
    const parsed = JSON.parse(raw)
    return {
      history: typeof parsed.history === 'number' ? parsed.history : 0,
      saved: typeof parsed.saved === 'number' ? parsed.saved : 0,
    }
  } catch {
    return { history: 0, saved: 0 }
  }
}

export function useDashboardHistory(
  activeConnectionId: string | null,
  activeConnection: SavedConnection | undefined
) {
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  // Hydrate totals from localStorage cache so the badges render instantly on
  // repeat dashboard loads, then get replaced with fresh server data.
  const [queryHistoryTotal, setQueryHistoryTotal] = useState(() => readCachedCounts().history)
  const [savedQueries, setSavedQueries] = useState<SavedQueryItem[]>([])
  const [cachedSavedCount, setCachedSavedCount] = useState(() => readCachedCounts().saved)
  const historyRef = useRef({ items: [] as QueryHistoryItem[], total: queryHistoryTotal })
  const historyMutationRef = useRef(0)
  const historyLoadRef = useRef(0)
  const pendingHistoryWritesRef = useRef(0)
  const deferredHistoryRefreshRef = useRef(false)

  const commitHistory = useCallback((items: QueryHistoryItem[], total: number) => {
    historyRef.current = { items, total }
    setQueryHistory(items)
    setQueryHistoryTotal(total)
  }, [])

  const refreshHistory: (isCurrent?: () => boolean) => Promise<boolean> = useCallback(
    async (isCurrent) => {
      if (isCurrent && !isCurrent()) return false
      if (pendingHistoryWritesRef.current > 0) {
        deferredHistoryRefreshRef.current = true
        return false
      }

      const mutation = historyMutationRef.current
      const request = ++historyLoadRef.current
      try {
        const result = await getQueryHistory({ pageSize: 50 })
        if (isCurrent && !isCurrent()) return false
        if (request !== historyLoadRef.current) return false
        if (mutation !== historyMutationRef.current || pendingHistoryWritesRef.current > 0) {
          // A write overlapped this read. Re-fetch after it settles instead of
          // trusting a total and page computed at different points in time.
          if (pendingHistoryWritesRef.current > 0) deferredHistoryRefreshRef.current = true
          else void refreshHistory(isCurrent)
          return false
        }
        if (!result.success || !result.data) return false
        commitHistory(result.data.items, result.data.total)
        return true
      } catch {
        return false
      }
    },
    [commitHistory]
  )

  const beginHistoryWrite = useCallback(() => {
    // Concurrent writes may commit in a different order than their responses.
    if (pendingHistoryWritesRef.current > 0) deferredHistoryRefreshRef.current = true
    historyMutationRef.current += 1
    pendingHistoryWritesRef.current += 1
  }, [])

  const finishHistoryWrite = useCallback(() => {
    pendingHistoryWritesRef.current -= 1
    historyMutationRef.current += 1
    if (pendingHistoryWritesRef.current === 0 && deferredHistoryRefreshRef.current) {
      deferredHistoryRefreshRef.current = false
      void refreshHistory()
    }
  }, [refreshHistory])

  // Persist counts whenever they change so the next load is flicker-free
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        COUNTS_CACHE_KEY,
        JSON.stringify({ history: queryHistoryTotal, saved: savedQueries.length })
      )
    } catch {}
    // Once real saved data arrives, stop using the stale cached count
    setCachedSavedCount(savedQueries.length)
  }, [queryHistoryTotal, savedQueries.length])

  // Update the list and its authoritative total together after persistence.
  // The list may contain only the first page, so its length is not the total.
  const handleRecordHistoryEntry = useCallback(
    async (input: Parameters<typeof addHistoryEntry>[0]): Promise<boolean> => {
      beginHistoryWrite()
      try {
        const result = await addHistoryEntry(input)
        if (!result.success || !result.data) return false

        const entry = result.data
        const { items, total } = historyRef.current
        if (!items.some((item) => item.id === entry.id)) {
          commitHistory([entry, ...items], total + 1)
        }
        return true
      } catch {
        // History persistence is non-blocking; a network failure must not turn
        // a successful database query into an unhandled rejection.
        return false
      } finally {
        finishHistoryWrite()
      }
    },
    [beginHistoryWrite, commitHistory, finishHistoryWrite]
  )

  // Handle saving a query
  const handleSaveQuery = useCallback(
    async (name: string, question: string, sql: string): Promise<boolean> => {
      const connectionName = activeConnection?.name || null
      // Demo connection exists only in localStorage — don't try to persist the FK to the DB
      const isDemo = activeConnection?.isDemo === true
      const result = await saveQueryAction({
        name,
        question,
        sql,
        connectionId: isDemo ? null : activeConnectionId,
        connectionName,
      })
      if (result.success && result.data) {
        setSavedQueries((prev) => [result.data!, ...prev])
        toast.success('Query saved')
        return true
      }
      toast.error('Failed to save query', { description: result.error })
      return false
    },
    [activeConnectionId, activeConnection]
  )

  // Handle deleting a saved query
  const handleDeleteSavedQuery = useCallback(async (id: string) => {
    const result = await deleteSavedQueryAction(id)
    if (result.success) {
      setSavedQueries((prev) => prev.filter((q) => q.id !== id))
      toast.success('Saved query deleted')
    }
  }, [])

  // Handle toggling favorite on a saved query
  const handleToggleFavorite = useCallback(async (id: string) => {
    const result = await toggleFavoriteAction(id)
    if (result.success && result.data) {
      setSavedQueries((prev) =>
        prev.map((q) => (q.id === id ? { ...q, isFavorite: result.data!.isFavorite } : q))
      )
      toast.success(result.data.isFavorite ? 'Added to favorites' : 'Removed from favorites')
    }
  }, [])

  // Handle sharing a saved query
  const handleShareQuery = useCallback(async (id: string) => {
    const result = await generateShareLink(id)
    if (result.success && result.shareToken) {
      const url = `${window.location.origin}/shared/${result.shareToken}`
      await navigator.clipboard.writeText(url)
      setSavedQueries((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, shareToken: result.shareToken!, isPublic: true } : q
        )
      )
      toast.success('Share link copied to clipboard')
    } else {
      toast.error('Failed to generate share link', { description: result.error })
    }
  }, [])

  // Handle clearing all history
  const handleClearHistory = useCallback(async () => {
    beginHistoryWrite()
    try {
      const result = await clearQueryHistoryAction()
      if (result.success) {
        commitHistory([], 0)
        toast.success('History cleared')
      }
    } finally {
      finishHistoryWrite()
    }
  }, [beginHistoryWrite, commitHistory, finishHistoryWrite])

  // Handle deleting a single history entry
  const handleDeleteHistoryEntry = useCallback(
    async (id: string) => {
      // Optimistic update — remove from list AND decrement the true server total immediately
      const removed = historyRef.current.items.find((item) => item.id === id)
      beginHistoryWrite()
      commitHistory(
        historyRef.current.items.filter((item) => item.id !== id),
        Math.max(0, historyRef.current.total - 1)
      )

      try {
        const result = await deleteHistoryEntry(id).catch(() => ({
          success: false,
          error: 'Could not delete entry',
        }))
        if (result.success) {
          toast.success('History entry deleted')
        } else {
          // Restore the optimistic count even if the background refresh fails.
          const { items, total } = historyRef.current
          const restoredItems =
            removed && !items.some((item) => item.id === id) ? [removed, ...items] : items
          commitHistory(restoredItems, total + 1)
          toast.error('Failed to delete entry', { description: result.error })
        }
      } finally {
        deferredHistoryRefreshRef.current = true
        finishHistoryWrite()
      }
    },
    [beginHistoryWrite, commitHistory, finishHistoryWrite]
  )

  return {
    queryHistory,
    queryHistoryTotal,
    savedQueries,
    setSavedQueries,
    cachedSavedCount,
    refreshHistory,
    handleRecordHistoryEntry,
    handleSaveQuery,
    handleDeleteSavedQuery,
    handleToggleFavorite,
    handleShareQuery,
    handleClearHistory,
    handleDeleteHistoryEntry,
  }
}

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import {
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
    const result = await clearQueryHistoryAction()
    if (result.success) {
      setQueryHistory([])
      setQueryHistoryTotal(0)
      toast.success('History cleared')
    }
  }, [])

  // Handle deleting a single history entry
  const handleDeleteHistoryEntry = useCallback(async (id: string) => {
    // Optimistic update — remove from list AND decrement the true server total immediately
    setQueryHistory((prev) => prev.filter((h) => h.id !== id))
    setQueryHistoryTotal((prev) => Math.max(0, prev - 1))

    const result = await deleteHistoryEntry(id)
    if (result.success) {
      toast.success('History entry deleted')
      // Background sync: pull updated list + authoritative total from server
      getQueryHistory({ pageSize: 50 })
        .then((res) => {
          if (res.success && res.data) {
            setQueryHistory(res.data.items)
            setQueryHistoryTotal(res.data.total)
          }
        })
        .catch(() => {
          // Background sync failed — optimistic state is still approximately correct
        })
    } else {
      // Revert: re-fetch to restore correct state
      getQueryHistory({ pageSize: 50 })
        .then((res) => {
          if (res.success && res.data) {
            setQueryHistory(res.data.items)
            setQueryHistoryTotal(res.data.total)
          }
        })
        .catch(() => {})
      toast.error('Failed to delete entry', { description: result.error })
    }
  }, [])

  return {
    queryHistory,
    setQueryHistory,
    queryHistoryTotal,
    setQueryHistoryTotal,
    savedQueries,
    setSavedQueries,
    cachedSavedCount,
    handleSaveQuery,
    handleDeleteSavedQuery,
    handleToggleFavorite,
    handleShareQuery,
    handleClearHistory,
    handleDeleteHistoryEntry,
  }
}

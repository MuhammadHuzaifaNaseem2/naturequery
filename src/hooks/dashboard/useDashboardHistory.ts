import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import {
  saveQuery as saveQueryAction,
  deleteSavedQuery as deleteSavedQueryAction,
  toggleFavorite as toggleFavoriteAction,
  clearQueryHistory as clearQueryHistoryAction,
  deleteHistoryEntry,
  getQueryHistory
} from '@/actions/queries'
import { generateShareLink } from '@/actions/sharing'
import { SavedConnection } from '@/app/dashboard/types'

export function useDashboardHistory(activeConnectionId: string | null, activeConnection: SavedConnection | undefined) {
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  // True total from the server — may be > queryHistory.length when DB has > pageSize entries
  const [queryHistoryTotal, setQueryHistoryTotal] = useState(0)
  const [savedQueries, setSavedQueries] = useState<SavedQueryItem[]>([])

  // Handle saving a query
  const handleSaveQuery = useCallback(async (name: string, question: string, sql: string) => {
    const connectionName = activeConnection?.name || null
    const result = await saveQueryAction({
      name,
      question,
      sql,
      connectionId: activeConnectionId,
      connectionName,
    })
    if (result.success && result.data) {
      setSavedQueries((prev) => [result.data!, ...prev])
      toast.success('Query saved')
    }
  }, [activeConnectionId, activeConnection])

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
        prev.map((q) => (q.id === id ? { ...q, shareToken: result.shareToken!, isPublic: true } : q))
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
      getQueryHistory({ pageSize: 50 }).then((res) => {
        if (res.success && res.data) {
          setQueryHistory(res.data.items)
          setQueryHistoryTotal(res.data.total)
        }
      }).catch(() => {
        // Background sync failed — optimistic state is still approximately correct
      })
    } else {
      // Revert: re-fetch to restore correct state
      getQueryHistory({ pageSize: 50 }).then((res) => {
        if (res.success && res.data) {
          setQueryHistory(res.data.items)
          setQueryHistoryTotal(res.data.total)
        }
      }).catch(() => {})
      toast.error('Failed to delete entry', { description: result.error })
    }
  }, [])

  return {
    queryHistory, setQueryHistory,
    queryHistoryTotal, setQueryHistoryTotal,
    savedQueries, setSavedQueries,
    handleSaveQuery,
    handleDeleteSavedQuery,
    handleToggleFavorite,
    handleShareQuery,
    handleClearHistory,
    handleDeleteHistoryEntry
  }
}

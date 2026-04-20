'use client'

import { useState } from 'react'
import { Bookmark, Trash2, Play, Star, Globe, Link2 } from 'lucide-react'
import type { SavedQueryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface SavedQueriesProps {
  queries: SavedQueryItem[]
  activeConnectionId: string | null
  onSelectQuery: (query: SavedQueryItem) => void
  onDeleteQuery: (id: string) => void
  onToggleFavorite?: (id: string) => void
  onShareQuery?: (id: string) => void
}

export function SavedQueries({
  queries,
  activeConnectionId,
  onSelectQuery,
  onDeleteQuery,
  onToggleFavorite,
  onShareQuery,
}: SavedQueriesProps) {
  const { t } = useTranslation()
  const [pendingDelete, setPendingDelete] = useState<SavedQueryItem | null>(null)
  // Favorites first, then active connection, then by date
  const sorted = [...queries].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1
    if (!a.isFavorite && b.isFavorite) return 1
    if (a.connectionId === activeConnectionId && b.connectionId !== activeConnectionId) return -1
    if (b.connectionId === activeConnectionId && a.connectionId !== activeConnectionId) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Bookmark className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">{t('dashboard.savedQueries.noQueries')}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('dashboard.savedQueries.clickBookmark')}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto p-3 space-y-2">
      {sorted.map((query) => (
        <div
          key={query.id}
          className="group p-3 rounded-lg border border-border hover:border-primary/20 bg-card hover:bg-secondary/30 transition-all cursor-pointer"
          onClick={() => onSelectQuery(query)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-medium truncate">{query.name}</h4>
                {query.isPublic && (
                  <span title="Public">
                    <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{query.question}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(query.id)
                  }}
                  className="p-1 hover:bg-yellow-500/10 rounded transition-colors"
                  title={
                    query.isFavorite
                      ? t('dashboard.savedQueries.removeFromFavorites')
                      : t('dashboard.savedQueries.addToFavorites')
                  }
                >
                  <Star
                    className={`w-3 h-3 ${query.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                  />
                </button>
              )}
              {onShareQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onShareQuery(query.id)
                  }}
                  className="p-1 hover:bg-blue-500/10 rounded transition-colors"
                  title={
                    query.shareToken
                      ? t('dashboard.savedQueries.copyShareLink')
                      : t('dashboard.savedQueries.shareQuery')
                  }
                >
                  <Link2
                    className={`w-3 h-3 ${query.shareToken ? 'text-blue-500' : 'text-muted-foreground'}`}
                  />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectQuery(query)
                }}
                className="p-1 hover:bg-primary/10 rounded transition-colors"
                title={t('dashboard.savedQueries.loadQuery')}
              >
                <Play className="w-3 h-3 text-primary" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPendingDelete(query)
                }}
                className="p-1 hover:bg-destructive/10 rounded transition-colors"
                title={t('common.delete')}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          </div>

          <code className="block text-[10px] text-muted-foreground/70 mt-1.5 truncate font-mono">
            {query.sql}
          </code>

          {/* Tags */}
          {query.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {query.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Connection name */}
          {query.connectionName && (
            <span className="block text-[10px] text-muted-foreground/60 mt-1">
              {query.connectionName}
            </span>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete saved query?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (pendingDelete) onDeleteQuery(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

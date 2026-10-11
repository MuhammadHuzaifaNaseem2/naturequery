'use client'

import { useState } from 'react'
import { Trash2, Play, Star, Globe, Link2 } from 'lucide-react'
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
      <div className="px-4 py-8">
        <p className="font-serif text-lg leading-snug text-foreground">
          {t('dashboard.savedQueries.noQueries')}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {t('dashboard.savedQueries.clickBookmark')}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto">
      {sorted.map((query) => (
        <div
          key={query.id}
          className="group relative px-3 py-2.5 border-b border-border/70 hover:bg-secondary/50 transition-colors cursor-pointer"
          onClick={() => onSelectQuery(query)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {query.isFavorite && (
                  <Star
                    className="w-3 h-3 fill-signal text-signal shrink-0"
                    aria-label="Favorite"
                  />
                )}
                <h4 className="text-sm font-medium truncate">{query.name}</h4>
                {query.isPublic && (
                  <span title="Public">
                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" aria-label="Public" />
                  </span>
                )}
              </div>
              {query.question && (
                <p className="font-serif text-[14px] italic leading-snug text-muted-foreground line-clamp-2 mt-0.5">
                  {query.question}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(query.id)
                  }}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                  title={
                    query.isFavorite
                      ? t('dashboard.savedQueries.removeFromFavorites')
                      : t('dashboard.savedQueries.addToFavorites')
                  }
                >
                  <Star
                    className={`w-3 h-3 ${query.isFavorite ? 'fill-signal text-signal' : 'text-muted-foreground'}`}
                  />
                </button>
              )}
              {onShareQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onShareQuery(query.id)
                  }}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                  title={
                    query.shareToken
                      ? t('dashboard.savedQueries.copyShareLink')
                      : t('dashboard.savedQueries.shareQuery')
                  }
                >
                  <Link2
                    className={`w-3 h-3 ${query.shareToken ? 'text-foreground' : 'text-muted-foreground'}`}
                  />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectQuery(query)
                }}
                className="p-1 hover:bg-secondary rounded transition-colors"
                title={t('dashboard.savedQueries.loadQuery')}
              >
                <Play className="w-3 h-3 text-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPendingDelete(query)
                }}
                className="p-1 hover:bg-destructive/10 rounded transition-colors text-muted-foreground hover:text-destructive"
                title={t('common.delete')}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Tags */}
          {query.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {query.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[10px] px-1 border border-border text-muted-foreground rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Connection name */}
          {query.connectionName && (
            <span className="block font-mono text-[10.5px] text-muted-foreground mt-1">
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

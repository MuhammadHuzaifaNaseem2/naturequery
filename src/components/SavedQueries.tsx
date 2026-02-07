'use client'

import { Bookmark, Trash2, Play } from 'lucide-react'

export interface SavedQuery {
  id: string
  name: string
  question: string
  sql: string
  connectionId: string
  savedAt: Date
}

interface SavedQueriesProps {
  queries: SavedQuery[]
  activeConnectionId: string | null
  onSelectQuery: (query: SavedQuery) => void
  onDeleteQuery: (id: string) => void
}

export function SavedQueries({
  queries,
  activeConnectionId,
  onSelectQuery,
  onDeleteQuery,
}: SavedQueriesProps) {
  // Show queries for the active connection first, then others
  const sorted = [...queries].sort((a, b) => {
    if (a.connectionId === activeConnectionId && b.connectionId !== activeConnectionId) return -1
    if (b.connectionId === activeConnectionId && a.connectionId !== activeConnectionId) return 1
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  })

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Bookmark className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">No saved queries yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Click the bookmark icon on a generated query to save it.
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
              <h4 className="text-sm font-medium truncate">{query.name}</h4>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{query.question}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectQuery(query)
                }}
                className="p-1 hover:bg-primary/10 rounded transition-colors"
                title="Load query"
              >
                <Play className="w-3 h-3 text-primary" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteQuery(query.id)
                }}
                className="p-1 hover:bg-destructive/10 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          </div>
          <code className="block text-[10px] text-muted-foreground/70 mt-1.5 truncate font-mono">
            {query.sql}
          </code>
        </div>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'

export interface HistoryItem {
  id: string
  question: string
  sql: string
  timestamp: Date
  rowCount?: number
}

interface QueryHistoryProps {
  history: HistoryItem[]
  onSelectQuery: (item: HistoryItem) => void
  onClearHistory: () => void
}

export function QueryHistory({ history, onSelectQuery, onClearHistory }: QueryHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const formatTime = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  }

  const formatDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(d)
  }

  // Group history by date
  const groupedHistory = history.reduce((groups, item) => {
    const dateKey = formatDate(item.timestamp)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(item)
    return groups
  }, {} as Record<string, HistoryItem[]>)

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No query history yet</p>
        <p className="text-xs mt-1">Your recent queries will appear here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
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
          History
          <span className="text-xs text-muted-foreground">({history.length})</span>
        </button>
        <button
          onClick={onClearHistory}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          title="Clear history"
        >
          Clear
        </button>
      </div>

      {/* History list */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedHistory).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                {dateKey}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectQuery(item)}
                  className="w-full p-3 text-left hover:bg-secondary/50 border-b border-border/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {item.question}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                      {item.sql.substring(0, 50)}...
                    </code>
                    {item.rowCount !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {item.rowCount} rows
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

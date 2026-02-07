'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { SchemaBrowser } from '@/components/SchemaBrowser'
import { QueryHistory, HistoryItem } from '@/components/QueryHistory'
import { SavedQueries, SavedQuery } from '@/components/SavedQueries'
import { SavedConnection } from './types'

type Tab = 'schema' | 'history' | 'saved'

interface RightSidebarProps {
  activeConnection: SavedConnection
  showSchema: boolean
  showHistory: boolean
  onShowSchema: () => void
  onShowHistory: () => void
  queryHistory: HistoryItem[]
  onSelectHistoryItem: (item: HistoryItem) => void
  onClearHistory: () => void
  nlQuery: string
  onNlQueryChange: (query: string) => void
  savedQueries: SavedQuery[]
  onSelectSavedQuery: (query: SavedQuery) => void
  onDeleteSavedQuery: (id: string) => void
  activeConnectionId: string | null
}

export function RightSidebar({
  activeConnection,
  showSchema,
  showHistory,
  onShowSchema,
  onShowHistory,
  queryHistory,
  onSelectHistoryItem,
  onClearHistory,
  nlQuery,
  onNlQueryChange,
  savedQueries,
  onSelectSavedQuery,
  onDeleteSavedQuery,
  activeConnectionId,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>(showSchema ? 'schema' : showHistory ? 'history' : 'schema')

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'schema') onShowSchema()
    else if (tab === 'history') onShowHistory()
  }

  return (
    <aside className="w-72 border-l border-border bg-card flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['schema', 'history', 'saved'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={clsx(
              'flex-1 px-3 py-2.5 text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
            {tab === 'saved' && savedQueries.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                {savedQueries.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'schema' && (
          <SchemaBrowser
            schema={activeConnection.schema || null}
            onColumnClick={(tableName, columnName) => {
              const currentQuery = nlQuery.trim()
              const addition = currentQuery ? ` ${tableName}.${columnName}` : `Show me ${columnName} from ${tableName}`
              onNlQueryChange(currentQuery + addition)
            }}
          />
        )}
        {activeTab === 'history' && (
          <QueryHistory
            history={queryHistory}
            onSelectQuery={onSelectHistoryItem}
            onClearHistory={onClearHistory}
          />
        )}
        {activeTab === 'saved' && (
          <SavedQueries
            queries={savedQueries}
            activeConnectionId={activeConnectionId}
            onSelectQuery={onSelectSavedQuery}
            onDeleteQuery={onDeleteSavedQuery}
          />
        )}
      </div>
    </aside>
  )
}

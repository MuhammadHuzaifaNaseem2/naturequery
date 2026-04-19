'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { SchemaBrowser } from '@/components/SchemaBrowser'
import { QueryHistory } from '@/components/QueryHistory'
import { SavedQueries } from '@/components/SavedQueries'
import { SchemaBrowserSkeleton, QueryHistorySkeleton, SavedQueriesSkeleton } from '@/components/Skeleton'
import { SavedConnection } from './types'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'

type Tab = 'schema' | 'history' | 'saved'

interface RightSidebarProps {
  activeConnection: SavedConnection
  showSchema: boolean
  showHistory: boolean
  onShowSchema: () => void
  onShowHistory: () => void
  queryHistory: QueryHistoryItem[]
  queryHistoryTotal?: number
  onSelectHistoryItem: (item: QueryHistoryItem) => void
  onClearHistory: () => void
  onDeleteHistoryEntry?: (id: string) => void
  nlQuery: string
  onNlQueryChange: (query: string) => void
  savedQueries: SavedQueryItem[]
  onSelectSavedQuery: (query: SavedQueryItem) => void
  onDeleteSavedQuery: (id: string) => void
  onToggleFavorite?: (id: string) => void
  onShareQuery?: (id: string) => void
  activeConnectionId: string | null
  isLoading?: boolean
  onRefreshSchema?: () => void
  isRefreshingSchema?: boolean
}

export function RightSidebar({
  activeConnection,
  showSchema,
  showHistory,
  onShowSchema,
  onShowHistory,
  queryHistory,
  queryHistoryTotal,
  onSelectHistoryItem,
  onClearHistory,
  onDeleteHistoryEntry,
  nlQuery,
  onNlQueryChange,
  savedQueries,
  onSelectSavedQuery,
  onDeleteSavedQuery,
  onToggleFavorite,
  onShareQuery,
  activeConnectionId,
  isLoading,
  onRefreshSchema,
  isRefreshingSchema,
}: RightSidebarProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>(showSchema ? 'schema' : showHistory ? 'history' : 'schema')

  // Sync internal tab state when parent toggles showHistory / showSchema
  useEffect(() => {
    if (showHistory) setActiveTab('history')
    else if (showSchema) setActiveTab('schema')
  }, [showHistory, showSchema])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'schema') onShowSchema()
    else if (tab === 'history') onShowHistory()
  }

  const tabs = ['schema', 'history', 'saved'] as const
  const activeIndex = tabs.indexOf(activeTab)

  return (
    <aside className="w-64 h-full border-l border-border bg-card flex flex-col">
      {/* Tabs with sliding indicator */}
      <div className="relative flex border-b border-border">
        {/* Sliding indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-primary transition-all duration-300 ease-out"
          style={{ left: `${activeIndex * (100 / 3)}%`, width: `${100 / 3}%` }}
        />
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={clsx(
              'flex-1 px-3 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`dashboard.sidebar.${tab}`)}
            {tab === 'history' && (queryHistoryTotal ?? queryHistory.length) > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                {queryHistoryTotal ?? queryHistory.length}
              </span>
            )}
            {tab === 'saved' && savedQueries.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                {savedQueries.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content with tab transition */}
      <div className="flex-1 overflow-hidden" key={activeTab}>
        <div className="h-full animate-fadeIn">
          {isLoading ? (
            activeTab === 'schema' ? <SchemaBrowserSkeleton /> :
            activeTab === 'history' ? <QueryHistorySkeleton /> :
            <SavedQueriesSkeleton />
          ) : (
            <>
              {activeTab === 'schema' && (
                <SchemaBrowser
                  schema={activeConnection.schema || null}
                  onRefreshSchema={onRefreshSchema}
                  isRefreshing={isRefreshingSchema}
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
                  onDeleteEntry={onDeleteHistoryEntry}
                />
              )}
              {activeTab === 'saved' && (
                <SavedQueries
                  queries={savedQueries}
                  activeConnectionId={activeConnectionId}
                  onSelectQuery={onSelectSavedQuery}
                  onDeleteQuery={onDeleteSavedQuery}
                  onToggleFavorite={onToggleFavorite}
                  onShareQuery={onShareQuery}
                />
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

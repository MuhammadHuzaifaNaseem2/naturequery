'use client'

import { Clock, Hash, Command } from 'lucide-react'
import { SavedConnection, QueryResults } from './types'
import type { QueryHistoryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'

interface StatusBarProps {
  activeConnection: SavedConnection | undefined
  queryResults: QueryResults | null
  queryHistory: QueryHistoryItem[]
  queryHistoryTotal?: number
}

export function StatusBar({ activeConnection, queryResults, queryHistory, queryHistoryTotal }: StatusBarProps) {
  const { t } = useTranslation()
  return (
    <div className="h-7 min-h-[28px] border-t border-border bg-card/80 backdrop-blur-sm px-4 flex items-center justify-between text-xs text-muted-foreground select-none">
      {/* Left: Connection indicator */}
      <div className="flex items-center gap-1.5">
        {activeConnection ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="font-medium text-foreground/80">{activeConnection.name}</span>
            <span className="text-muted-foreground/60">({activeConnection.dbType})</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            <span>{t('dashboard.statusBar.noConnection')}</span>
          </>
        )}
      </div>

      {/* Center: Last query stats */}
      <div className="hidden md:flex items-center gap-3">
        {queryResults && (
          <>
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {queryResults.rowCount} {t('common.rows')}
            </span>
            {queryResults.executionTime != null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {queryResults.executionTime}ms
              </span>
            )}
          </>
        )}
      </div>

      {/* Right: Query count + shortcut hint */}
      <div className="flex items-center gap-3">
        <span>{t('dashboard.statusBar.queriesCount', { count: queryHistoryTotal ?? queryHistory.length })}</span>
        <span className="hidden sm:flex items-center gap-1 text-muted-foreground/60">
          <Command className="w-3 h-3" />
          <span>K</span>
        </span>
      </div>
    </div>
  )
}

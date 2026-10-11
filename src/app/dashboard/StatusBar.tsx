'use client'

import { SavedConnection, QueryResults } from './types'
import type { QueryHistoryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'

interface StatusBarProps {
  activeConnection: SavedConnection | undefined
  queryResults: QueryResults | null
  queryHistory: QueryHistoryItem[]
  queryHistoryTotal?: number
}

export function StatusBar({
  activeConnection,
  queryResults,
  queryHistory,
  queryHistoryTotal,
}: StatusBarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex h-7 min-h-[28px] items-center justify-between gap-4 border-t border-border bg-background px-4 font-mono text-[11px] text-muted-foreground select-none">
      {/* Left: the database this workspace is talking to */}
      <div className="flex min-w-0 items-center gap-1.5">
        {activeConnection ? (
          <>
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" aria-hidden />
            <span className="truncate text-foreground/80">{activeConnection.name}</span>
            <span className="hidden text-muted-foreground/70 sm:inline">
              {activeConnection.dbType}
            </span>
          </>
        ) : (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
            <span>{t('dashboard.statusBar.noConnection')}</span>
          </>
        )}
      </div>

      {/* Center: the last result */}
      <div className="hidden items-center gap-3 tabular-nums md:flex">
        {queryResults && (
          <>
            <span>
              {queryResults.rowCount} {t('common.rows')}
            </span>
            {queryResults.executionTime != null && <span>{queryResults.executionTime} ms</span>}
          </>
        )}
      </div>

      {/* Right: how much has been asked, and the search shortcut */}
      <div className="flex items-center gap-3 tabular-nums">
        <span>
          {t('dashboard.statusBar.queriesCount', {
            count: queryHistoryTotal ?? queryHistory.length,
          })}
        </span>
        <span className="hidden text-muted-foreground/70 sm:inline">Ctrl K</span>
      </div>
    </div>
  )
}

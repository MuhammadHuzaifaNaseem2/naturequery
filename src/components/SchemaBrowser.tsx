'use client'

import { useState } from 'react'
import { DatabaseSchema, TableSchema, ColumnDefinition } from '@/actions/db'
import { useTranslation } from '@/contexts/LocaleContext'

interface SchemaBrowserProps {
  schema: DatabaseSchema | null
  onColumnClick?: (tableName: string, columnName: string) => void
  onRefreshSchema?: () => void
  isRefreshing?: boolean
}

export function SchemaBrowser({ schema, onColumnClick, onRefreshSchema, isRefreshing }: SchemaBrowserProps) {
  const { t } = useTranslation()
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const getTypeIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('int') || t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) {
      return <span className="text-primary font-mono text-xs">#</span>
    }
    if (t.includes('varchar') || t.includes('text') || t.includes('char')) {
      return <span className="text-success font-mono text-xs">T</span>
    }
    if (t.includes('date') || t.includes('time') || t.includes('timestamp')) {
      return <span className="text-warning font-mono text-xs">D</span>
    }
    if (t.includes('bool')) {
      return <span className="text-accent font-mono text-xs">B</span>
    }
    return <span className="text-muted-foreground font-mono text-xs">?</span>
  }

  const filteredTables = schema?.tables?.filter((table) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      table.tableName.toLowerCase().includes(query) ||
      table.columns.some((col) => col.name.toLowerCase().includes(query))
    )
  }) || []

  if (!schema || !schema.tables || schema.tables.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
        <p>{t('dashboard.schemaBrowser.noSchemaLoaded')}</p>
        <p className="text-xs mt-1">{t('dashboard.schemaBrowser.connectToDatabase')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + Refresh */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('dashboard.schemaBrowser.searchTables')}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          {onRefreshSchema && (
            <button
              onClick={onRefreshSchema}
              disabled={isRefreshing}
              title={t('dashboard.schemaBrowser.refreshSchema')}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tables list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-1">
          {filteredTables.map((table) => (
            <TableItem
              key={table.tableName}
              table={table}
              isExpanded={expandedTables.has(table.tableName)}
              onToggle={() => toggleTable(table.tableName)}
              onColumnClick={onColumnClick}
              getTypeIcon={getTypeIcon}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </div>

      {/* Stats footer */}
      <div className="p-2 border-t border-border text-xs text-muted-foreground flex justify-between">
        <span>{schema.tables.length} {t('dashboard.schemaBrowser.tables')}</span>
        <span>
          {schema.tables.reduce((acc, tbl) => acc + tbl.columns.length, 0)} {t('dashboard.schemaBrowser.columns')}
        </span>
      </div>
    </div>
  )
}

interface TableItemProps {
  table: TableSchema
  isExpanded: boolean
  onToggle: () => void
  onColumnClick?: (tableName: string, columnName: string) => void
  getTypeIcon: (type: string) => React.ReactNode
  searchQuery: string
}

function TableItem({ table, isExpanded, onToggle, onColumnClick, getTypeIcon, searchQuery }: TableItemProps) {
  const highlightMatch = (text: string) => {
    if (!searchQuery) return text
    const index = text.toLowerCase().indexOf(searchQuery.toLowerCase())
    if (index === -1) return text
    return (
      <>
        {text.slice(0, index)}
        <span className="bg-warning/30 text-warning-foreground">{text.slice(index, index + searchQuery.length)}</span>
        {text.slice(index + searchQuery.length)}
      </>
    )
  }

  return (
    <div className="mb-0.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
      >
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium flex-1 truncate group-hover:text-primary transition-colors">
          {highlightMatch(table.tableName)}
        </span>
        <span className="text-xs text-muted-foreground">
          {table.columns.length}
        </span>
      </button>

      {isExpanded && (
        <div className="ml-6 pl-4 border-l border-border/50 space-y-0.5 py-1">
          {table.columns.map((column) => (
            <ColumnItem
              key={column.name}
              column={column}
              tableName={table.tableName}
              onClick={onColumnClick}
              getTypeIcon={getTypeIcon}
              highlightMatch={highlightMatch}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ColumnItemProps {
  column: ColumnDefinition
  tableName: string
  onClick?: (tableName: string, columnName: string) => void
  getTypeIcon: (type: string) => React.ReactNode
  highlightMatch: (text: string) => React.ReactNode
}

function ColumnItem({ column, tableName, onClick, getTypeIcon, highlightMatch }: ColumnItemProps) {
  return (
    <button
      onClick={() => onClick?.(tableName, column.name)}
      className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-secondary/50 transition-colors text-left group"
    >
      <span className="w-4 h-4 flex items-center justify-center">
        {getTypeIcon(column.type)}
      </span>
      <span className="text-sm flex-1 truncate group-hover:text-primary transition-colors">
        {highlightMatch(column.name)}
      </span>
      {column.isPrimaryKey && (
        <svg className="w-3 h-3 text-warning" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
        </svg>
      )}
      <span className="text-xs text-muted-foreground font-mono">
        {column.type.toLowerCase()}
      </span>
    </button>
  )
}

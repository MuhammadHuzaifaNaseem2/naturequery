'use client'

import { Database, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { ThemeToggle } from '@/components/ThemeToggle'
import { QueryTemplates } from '@/components/QueryTemplates'
import { SavedConnection } from './types'

interface ConnectionSidebarProps {
  connections: SavedConnection[]
  filteredConnections: SavedConnection[]
  activeConnectionId: string | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectConnection: (id: string) => void
  onDeleteConnection: (id: string) => void
  onAddConnection: () => void
  onAddDemoConnection: () => void
  onSelectTemplate: (question: string) => void
}

export function ConnectionSidebar({
  filteredConnections,
  activeConnectionId,
  searchQuery,
  onSearchChange,
  onSelectConnection,
  onDeleteConnection,
  onAddConnection,
  onAddDemoConnection,
  onSelectTemplate,
}: ConnectionSidebarProps) {
  return (
    <aside className="w-72 border-r border-border bg-card flex flex-col">
      {/* Logo & Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg glow-primary">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">ReportFlow</h1>
              <p className="text-xs text-muted-foreground">NL to SQL</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <label className="flex items-center gap-2 input py-1.5 text-sm cursor-text">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="bg-transparent outline-none w-full placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* Connections */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connections</h2>
          <button
            onClick={onAddConnection}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {filteredConnections.length === 0 ? (
          <div className="text-center py-6">
            <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground mb-3">No connections</p>
            <button
              onClick={onAddDemoConnection}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Try Demo
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConnections.map((connection) => (
              <div
                key={connection.id}
                className={clsx(
                  'relative p-2.5 rounded-lg border transition-all group cursor-pointer',
                  activeConnectionId === connection.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card border-border hover:border-primary/20 hover:bg-secondary/50'
                )}
                onClick={() => onSelectConnection(connection.id)}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      activeConnectionId === connection.id
                        ? 'bg-primary text-white'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium text-sm truncate">{connection.name}</h3>
                      {connection.status === 'active' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {connection.schema?.tables.length || 0} tables
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteConnection(connection.id)
                  }}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onAddConnection}
          className="w-full mt-3 p-2 border border-dashed border-border hover:border-primary/30 rounded-lg text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Connection
        </button>
      </div>

      {/* Quick Templates */}
      <div className="border-t border-border">
        <QueryTemplates onSelectTemplate={onSelectTemplate} />
      </div>
    </aside>
  )
}

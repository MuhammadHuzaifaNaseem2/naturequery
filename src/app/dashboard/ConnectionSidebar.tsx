'use client'

import { useRef, useState } from 'react'
import { AppLogo } from '@/components/AppLogo'
import {
  Database,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  UploadCloud,
  AlertTriangle,
} from 'lucide-react'

// Mini logos for each DB type shown in the sidebar connection list
const DB_MINI_LOGOS: Record<string, React.ReactNode> = {
  postgresql: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#336791" />
      <ellipse cx="16" cy="15" rx="7" ry="8" fill="white" opacity="0.9" />
      <ellipse cx="16" cy="10" rx="5" ry="4" fill="#336791" />
      <circle cx="13.5" cy="13" r="1.2" fill="#336791" />
      <circle cx="18.5" cy="13" r="1.2" fill="#336791" />
    </svg>
  ),
  mysql: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#00758F" />
      <path
        d="M6 20 Q10 10 16 12 Q22 14 26 10 Q24 18 18 18 Q14 18 12 22 Q9 26 6 20z"
        fill="white"
        opacity="0.9"
      />
      <circle cx="22" cy="11" r="1.5" fill="#F29111" />
    </svg>
  ),
  mariadb: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#C0765A" />
      <path
        d="M8 22 Q8 14 14 12 Q20 10 22 14 Q24 18 20 20 Q16 22 14 20 Q12 18 14 16"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="22" cy="13" r="1.5" fill="white" />
    </svg>
  ),
  sqlserver: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#CC2927" />
      <path
        d="M11 11 Q11 9 16 9 Q21 9 21 12 Q21 15 16 15.5 Q11 16 11 19.5 Q11 23 16 23 Q21 23 21 21"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  sqlite: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="16" rx="7" ry="11" fill="#003B57" />
      <ellipse cx="14" cy="7" rx="7" ry="3.5" fill="#0F80CC" />
      <path d="M21 9 L27 4" stroke="#0F80CC" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="27" cy="4" r="2" fill="#0F80CC" />
    </svg>
  ),
  oracle: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#F80000" />
      <path d="M16 8 A8 8 0 1 1 15.99 8Z" fill="none" stroke="white" strokeWidth="5" />
    </svg>
  ),
  db2: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#052FAD" />
      <rect x="6" y="9" width="20" height="3" rx="1" fill="white" />
      <rect x="6" y="14.5" width="20" height="3" rx="1" fill="white" />
      <rect x="6" y="20" width="20" height="3" rx="1" fill="white" />
    </svg>
  ),
  redshift: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#205B99" />
      <path d="M16 5 L22 9.5 L22 22.5 L16 27 L10 22.5 L10 9.5Z" fill="#5294CF" />
      <path d="M16 5 L22 9.5 L16 13 L10 9.5Z" fill="#8CC4F0" />
    </svg>
  ),
  bigquery: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3 L27 9.5 V22.5 L16 29 L5 22.5 V9.5Z" fill="#4285F4" />
      <circle cx="15" cy="15" r="5.5" fill="white" opacity="0.95" />
      <circle cx="15" cy="15" r="3.5" fill="#4285F4" />
      <line
        x1="19"
        y1="19"
        x2="23"
        y2="23"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  snowflake: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#29B5E8" />
      <line x1="16" y1="4" x2="16" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="4" y1="16" x2="28" y2="16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line
        x1="7.5"
        y1="7.5"
        x2="24.5"
        y2="24.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="24.5"
        y1="7.5"
        x2="7.5"
        y2="24.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3" fill="white" />
    </svg>
  ),
  cockroachdb: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#6933FF" />
      <ellipse cx="16" cy="14" rx="5.5" ry="7" fill="white" opacity="0.92" />
      <circle cx="13.5" cy="12" r="1.3" fill="#6933FF" />
      <circle cx="18.5" cy="12" r="1.3" fill="#6933FF" />
    </svg>
  ),
  clickhouse: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#1C1C1C" />
      <rect x="4" y="8" width="4" height="16" rx="1" fill="#FAFF69" />
      <rect x="10" y="8" width="4" height="16" rx="1" fill="#FAFF69" />
      <rect x="16" y="8" width="4" height="16" rx="1" fill="#FAFF69" />
      <rect x="22" y="8" width="4" height="8" rx="1" fill="#FAFF69" />
    </svg>
  ),
  mongodb: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3 C14 9 9 12 9 18 A7 7 0 0 0 23 18 C23 12 18 9 16 3Z" fill="#10AA50" />
      <rect x="15" y="22" width="2" height="7" rx="1" fill="#10AA50" />
    </svg>
  ),
  neon: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#0C0C0C" />
      <path
        d="M9 24 L9 8 L23 24 L23 8"
        stroke="#00E599"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  planetscale: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#0C0C0C" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="white" strokeWidth="2" />
      <line x1="8" y1="24" x2="24" y2="8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  duckdb: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#FFF200" />
      <circle cx="16" cy="16" r="9" fill="#1C1C1C" />
      <circle cx="16" cy="16" r="5" fill="white" />
      <circle cx="18.5" cy="13.5" r="2.5" fill="white" />
      <circle cx="19.5" cy="13" r="1.2" fill="#1C1C1C" />
    </svg>
  ),
  turso: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#0D1117" />
      <path
        d="M16 5 L26 10.5 V21.5 L16 27 L6 21.5 V10.5Z"
        fill="none"
        stroke="#4FF8D2"
        strokeWidth="2"
      />
      <line
        x1="11"
        y1="13"
        x2="21"
        y2="13"
        stroke="#4FF8D2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="13"
        x2="16"
        y2="21"
        stroke="#4FF8D2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  magic: (
    <svg viewBox="0 0 32 32" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="magicBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="6" fill="url(#magicBg)" />
      <path
        d="M16 7 L17.8 13.2 L24 15 L17.8 16.8 L16 23 L14.2 16.8 L8 15 L14.2 13.2Z"
        fill="white"
      />
      <circle cx="23" cy="9" r="1.5" fill="white" opacity="0.85" />
      <circle cx="9" cy="23" r="1.2" fill="white" opacity="0.7" />
    </svg>
  ),
}
import { clsx } from 'clsx'
import { ThemeToggle } from '@/components/ThemeToggle'
import { QueryTemplates } from '@/components/QueryTemplates'
import { ConnectionListSkeleton } from '@/components/Skeleton'
import { SavedConnection } from './types'
import { useTranslation } from '@/contexts/LocaleContext'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'

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
  onNewChat?: () => void
  isLoading?: boolean
  onClose?: () => void
  onUploadCSV?: (file: File) => void
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
  onNewChat,
  isLoading,
  onClose,
  onUploadCSV,
}: ConnectionSidebarProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  return (
    <aside className="w-60 h-full border-r border-border bg-card flex flex-col">
      {/* Logo & Header */}
      <div className="tour-step-1 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AppLogo size="lg" showText={false} />
            <div>
              <h1 className="text-lg font-bold tracking-tight">NatureQuery</h1>
              <p className="text-xs text-muted-foreground">{t('dashboard.sidebar.nlToSql')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={() => onNewChat?.()}
          className="w-full btn-gradient text-sm py-2.5 px-4 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('common.newChat')}
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <label className="flex items-center gap-2 input py-1.5 text-sm cursor-text">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`${t('common.search')}...`}
            className="bg-transparent outline-none w-full placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Onboarding Checklist — inside scroll */}
        <div className="px-3 pt-3">
          <OnboardingChecklist onConnectDb={onAddConnection} onAskQuestion={() => {}} />
        </div>

        {/* Connections */}
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('dashboard.sidebar.connections')}
            </h2>
            <button
              onClick={onAddConnection}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {isLoading ? (
            <ConnectionListSkeleton />
          ) : filteredConnections.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-secondary/50 flex items-center justify-center">
                <Database className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t('dashboard.sidebar.noConnections')}
              </p>
              <button onClick={onAddDemoConnection} className="btn-gradient text-xs py-1.5 px-3">
                <Sparkles className="w-3.5 h-3.5" />
                {t('dashboard.sidebar.tryDemo')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(
                filteredConnections.reduce(
                  (acc, curr) => {
                    const group = curr.teamName || 'Personal'
                    if (!acc[group]) acc[group] = []
                    acc[group].push(curr)
                    return acc
                  },
                  {} as Record<string, typeof filteredConnections>
                )
              ).map(([group, conns]) => (
                <div key={group}>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 pl-1">
                    {group === 'Personal' ? t('dashboard.connectionSidebar.personal') : group}
                  </h3>
                  <div className="space-y-1">
                    {conns.map((connection) => (
                      <div
                        key={connection.id}
                        className={clsx(
                          'relative p-2.5 rounded-lg border transition-all duration-200 group cursor-pointer',
                          activeConnectionId === connection.id
                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/20 hover:bg-secondary/30'
                        )}
                        onClick={() => onSelectConnection(connection.id)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-background border border-border/50 overflow-hidden shadow-sm">
                            {DB_MINI_LOGOS[connection.dbType] ?? (
                              <Database className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-medium text-sm truncate">{connection.name}</h3>
                              {connection.status === 'active' && (
                                <span className="flex h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
                              )}
                              {connection.status === 'error' && (
                                <span className="flex h-1.5 w-1.5 rounded-full bg-destructive flex-shrink-0" />
                              )}
                            </div>
                            {connection.status === 'error' && connection.schemaError ? (
                              <p
                                className="text-[11px] text-destructive truncate"
                                title={connection.schemaError}
                              >
                                {connection.schemaError}
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {connection.schema
                                  ? `${connection.schema.tables.length} ${t('common.tables')}`
                                  : '…'}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(connection.id)
                          }}
                          className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 mt-2">
            <button
              onClick={onAddConnection}
              className="flex-1 p-1.5 border border-dashed border-border hover:border-primary/30 rounded-lg text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              {t('dashboard.sidebar.addConnection')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 border border-dashed border-border/50 hover:border-primary/30 rounded-lg text-muted-foreground hover:text-primary transition-all"
              title={t('dashboard.connectionSidebar.uploadCsv')}
            >
              <UploadCloud className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file && onUploadCSV) {
                onUploadCSV(file)
              }
              if (e.target) {
                e.target.value = ''
              }
            }}
          />
        </div>

        {/* Quick Templates — inside scroll */}
        <div className="border-t border-border">
          <QueryTemplates onSelectTemplate={onSelectTemplate} />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-[380px] max-w-[90vw] animate-fadeIn">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {t('dashboard.connectionSidebar.deleteTitle')}
              </h3>
              <p className="text-sm text-muted-foreground mb-1">
                {t('dashboard.connectionSidebar.deleteConfirmText')}
              </p>
              <p className="text-sm font-medium mb-1">
                {filteredConnections.find((c) => c.id === deleteConfirmId)?.name ||
                  t('dashboard.connectionSidebar.thisConnection')}
                ?
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                {t('dashboard.connectionSidebar.deleteWarning')}
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    onDeleteConnection(deleteConfirmId)
                    setDeleteConfirmId(null)
                  }}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

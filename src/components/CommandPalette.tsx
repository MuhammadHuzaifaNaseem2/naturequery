'use client'

import { useEffect } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from '@/components/ThemeProvider'
import { useTranslation } from '@/contexts/LocaleContext'
import {
  LayoutDashboard, History, Settings, Shield, CreditCard, Database,
  Moon, Sun, Monitor, Search, Play, Download, Trash2, Bookmark,
} from 'lucide-react'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connections?: Array<{ id: string; name: string }>
  activeConnectionId?: string | null
  onSelectConnection?: (id: string) => void
  queryHistory?: Array<{ question: string; sql: string }>
  savedQueries?: Array<{ id: string; name: string; question: string; sql: string }>
  onSelectQuery?: (question: string, sql: string) => void
  onExport?: (format: 'excel' | 'csv') => void
  onClearHistory?: () => void
  onNewQuery?: () => void
}

export function CommandPalette({
  open, onOpenChange, connections, activeConnectionId,
  onSelectConnection, queryHistory, savedQueries,
  onSelectQuery, onExport, onClearHistory, onNewQuery,
}: CommandPaletteProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { setTheme } = useTheme()
  const { t } = useTranslation()
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  if (!open) return null

  const groupHeadingClass = '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground'

  return (
    <div className="fixed inset-0 z-[100] animate-fadeIn">
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-scaleIn">
        <Command
          className="bg-card/95 backdrop-blur-xl rounded-xl shadow-2xl border border-border overflow-hidden"
          label="Command palette"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onOpenChange(false)
            }
          }}
        >
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Command.Input
              placeholder={t('dashboard.commandPalette.placeholder')}
              className="w-full py-3 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t('dashboard.commandPalette.noResults')}
            </Command.Empty>

            <Command.Group heading={t('dashboard.commandPalette.navigation')} className={groupHeadingClass}>
              <CmdItem icon={LayoutDashboard} onSelect={() => { router.push('/dashboard'); onOpenChange(false) }}>
                {t('dashboard.header.dashboard')}
              </CmdItem>
              <CmdItem icon={History} onSelect={() => { router.push('/dashboard/history'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.fullHistory')}
              </CmdItem>
              <CmdItem icon={Settings} onSelect={() => { router.push('/settings'); onOpenChange(false) }}>
                {t('common.settings')}
              </CmdItem>
              <CmdItem icon={CreditCard} onSelect={() => { router.push('/settings'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.billing')}
              </CmdItem>
              {isAdmin && (
                <CmdItem icon={Shield} onSelect={() => { router.push('/admin'); onOpenChange(false) }}>
                  {t('dashboard.commandPalette.adminPanel')}
                </CmdItem>
              )}
            </Command.Group>

            {connections && connections.length > 0 && (
              <Command.Group heading={t('dashboard.commandPalette.connections')} className={groupHeadingClass}>
                {connections.map((conn) => (
                  <CmdItem
                    key={conn.id}
                    icon={Database}
                    onSelect={() => { onSelectConnection?.(conn.id); onOpenChange(false) }}
                  >
                    <span className="flex-1">{t('dashboard.commandPalette.switchTo', { name: conn.name })}</span>
                    {conn.id === activeConnectionId && (
                      <span className="text-xs text-primary">({t('dashboard.commandPalette.active')})</span>
                    )}
                  </CmdItem>
                ))}
              </Command.Group>
            )}

            {queryHistory && queryHistory.length > 0 && (
              <Command.Group heading={t('dashboard.commandPalette.recentQueries')} className={groupHeadingClass}>
                {queryHistory.slice(0, 8).map((q, i) => (
                  <CmdItem
                    key={i}
                    icon={Play}
                    onSelect={() => { onSelectQuery?.(q.question, q.sql); onOpenChange(false) }}
                  >
                    {q.question.length > 60 ? q.question.slice(0, 60) + '...' : q.question}
                  </CmdItem>
                ))}
              </Command.Group>
            )}

            {savedQueries && savedQueries.length > 0 && (
              <Command.Group heading={t('dashboard.commandPalette.savedQueries')} className={groupHeadingClass}>
                {savedQueries.slice(0, 8).map((q) => (
                  <CmdItem
                    key={q.id}
                    icon={Bookmark}
                    onSelect={() => { onSelectQuery?.(q.question, q.sql); onOpenChange(false) }}
                  >
                    {q.name}
                  </CmdItem>
                ))}
              </Command.Group>
            )}

            <Command.Group heading={t('common.actions')} className={groupHeadingClass}>
              <CmdItem icon={Play} onSelect={() => { onNewQuery?.(); onOpenChange(false) }}>
                {t('dashboard.commandPalette.newQuery')}
              </CmdItem>
              <CmdItem icon={Download} onSelect={() => { onExport?.('excel'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.exportExcel')}
              </CmdItem>
              <CmdItem icon={Download} onSelect={() => { onExport?.('csv'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.exportCsv')}
              </CmdItem>
              <CmdItem icon={Trash2} onSelect={() => { onClearHistory?.(); onOpenChange(false) }}>
                {t('dashboard.commandPalette.clearHistory')}
              </CmdItem>
            </Command.Group>

            <Command.Group heading={t('dashboard.commandPalette.theme')} className={groupHeadingClass}>
              <CmdItem icon={Sun} onSelect={() => { setTheme('light'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.lightMode')}
              </CmdItem>
              <CmdItem icon={Moon} onSelect={() => { setTheme('dark'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.darkMode')}
              </CmdItem>
              <CmdItem icon={Monitor} onSelect={() => { setTheme('system'); onOpenChange(false) }}>
                {t('dashboard.commandPalette.systemTheme')}
              </CmdItem>
            </Command.Group>
          </Command.List>

          <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('dashboard.commandPalette.navigateArrows')}</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded border border-border text-[10px]">Esc</kbd> {t('dashboard.commandPalette.escClose')}
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}

function CmdItem({
  icon: Icon, children, onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  onSelect: () => void
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate">{children}</span>
    </Command.Item>
  )
}

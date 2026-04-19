'use client'

import { useEffect, useCallback } from 'react'

interface ShortcutHandlers {
  onSubmitQuery?: () => void
  onExportExcel?: () => void
  onExportCSV?: () => void
  onToggleTheme?: () => void
  onFocusInput?: () => void
  onClearInput?: () => void
  onToggleSettings?: () => void
  onOpenCommandPalette?: () => void
  onToggleSchema?: () => void
  onToggleHistory?: () => void
  onSaveQuery?: () => void
  onRunSQL?: () => void
  onFormatSQL?: () => void
  onToggleHelp?: () => void
}

export interface Shortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  action: keyof ShortcutHandlers
  category: 'Query' | 'Navigation' | 'Data' | 'General'
}

export const SHORTCUTS: Shortcut[] = [
  // Query
  { key: 'Enter', ctrlKey: true, description: 'Submit query', action: 'onSubmitQuery', category: 'Query' },
  { key: 'r', ctrlKey: true, description: 'Run current SQL', action: 'onRunSQL', category: 'Query' },
  { key: 'l', ctrlKey: true, shiftKey: true, description: 'Format / Beautify SQL', action: 'onFormatSQL', category: 'Query' },
  { key: 's', ctrlKey: true, description: 'Save current query', action: 'onSaveQuery', category: 'Query' },
  // Navigation
  { key: 'k', ctrlKey: true, description: 'Open Command Palette', action: 'onOpenCommandPalette', category: 'Navigation' },
  { key: '/', ctrlKey: true, description: 'Toggle Schema Browser', action: 'onToggleSchema', category: 'Navigation' },
  { key: 'h', ctrlKey: true, description: 'Toggle Query History', action: 'onToggleHistory', category: 'Navigation' },
  { key: ',', ctrlKey: true, description: 'Toggle Settings', action: 'onToggleSettings', category: 'Navigation' },
  // Data
  { key: 'e', ctrlKey: true, shiftKey: true, description: 'Export to Excel', action: 'onExportExcel', category: 'Data' },
  { key: 'c', ctrlKey: true, shiftKey: true, description: 'Export to CSV', action: 'onExportCSV', category: 'Data' },
  // General
  { key: 'd', ctrlKey: true, description: 'Toggle dark mode', action: 'onToggleTheme', category: 'General' },
  { key: 'Escape', description: 'Clear input', action: 'onClearInput', category: 'General' },
  { key: '?', description: 'Toggle shortcuts help', action: 'onToggleHelp', category: 'General' },
]

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!event.key) return

      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      for (const shortcut of SHORTCUTS) {
        const keyMatches = event.key === shortcut.key || event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey)
        const shiftMatches = !!shortcut.shiftKey === event.shiftKey
        const altMatches = !!shortcut.altKey === event.altKey

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          // Allow these shortcuts even inside inputs
          const inputAllowed: Array<keyof ShortcutHandlers> = ['onSubmitQuery', 'onClearInput']
          if (isInput && !inputAllowed.includes(shortcut.action)) {
            continue
          }

          const handler = handlers[shortcut.action]
          if (handler) {
            event.preventDefault()
            handler()
            break
          }
        }
      }
    },
    [handlers]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

const CATEGORY_ORDER: Shortcut['category'][] = ['Query', 'Navigation', 'Data', 'General']

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    shortcuts: SHORTCUTS.filter((s) => s.category === cat),
  }))

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg animate-scaleIn overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] divide-y divide-border">
          {grouped.map(({ category, shortcuts }) => (
            <div key={category} className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {category}
              </p>
              <div className="space-y-0.5">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground/80">{shortcut.description}</span>
                    <kbd className="flex items-center gap-1 flex-shrink-0 ml-4">
                      {shortcut.ctrlKey && (
                        <span className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">Ctrl</span>
                      )}
                      {shortcut.shiftKey && (
                        <span className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">Shift</span>
                      )}
                      {shortcut.altKey && (
                        <span className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">Alt</span>
                      )}
                      <span className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">
                        {shortcut.key === ' ' ? 'Space' : shortcut.key}
                      </span>
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border bg-secondary/20">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-secondary rounded border border-border">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}

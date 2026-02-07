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
}

export interface Shortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  action: keyof ShortcutHandlers
}

export const SHORTCUTS: Shortcut[] = [
  { key: 'Enter', ctrlKey: true, description: 'Submit query', action: 'onSubmitQuery' },
  { key: 'e', ctrlKey: true, shiftKey: true, description: 'Export to Excel', action: 'onExportExcel' },
  { key: 'c', ctrlKey: true, shiftKey: true, description: 'Export to CSV', action: 'onExportCSV' },
  { key: 'd', ctrlKey: true, description: 'Toggle dark mode', action: 'onToggleTheme' },
  { key: 'k', ctrlKey: true, description: 'Focus query input', action: 'onFocusInput' },
  { key: 'Escape', description: 'Clear input', action: 'onClearInput' },
  { key: ',', ctrlKey: true, description: 'Toggle settings', action: 'onToggleSettings' },
]

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except for Ctrl+Enter)
      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      for (const shortcut of SHORTCUTS) {
        const keyMatches = event.key === shortcut.key || event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey)
        const shiftMatches = !!shortcut.shiftKey === event.shiftKey
        const altMatches = !!shortcut.altKey === event.altKey

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          // Allow Ctrl+Enter in inputs for submit
          if (isInput && shortcut.action !== 'onSubmitQuery' && shortcut.action !== 'onClearInput') {
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

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full mx-4 animate-scaleIn">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              <kbd className="flex items-center gap-1">
                {shortcut.ctrlKey && (
                  <span className="px-2 py-1 text-xs font-mono bg-secondary rounded border border-border">
                    Ctrl
                  </span>
                )}
                {shortcut.shiftKey && (
                  <span className="px-2 py-1 text-xs font-mono bg-secondary rounded border border-border">
                    Shift
                  </span>
                )}
                {shortcut.altKey && (
                  <span className="px-2 py-1 text-xs font-mono bg-secondary rounded border border-border">
                    Alt
                  </span>
                )}
                <span className="px-2 py-1 text-xs font-mono bg-secondary rounded border border-border">
                  {shortcut.key === ' ' ? 'Space' : shortcut.key}
                </span>
              </kbd>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-secondary rounded border border-border">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}

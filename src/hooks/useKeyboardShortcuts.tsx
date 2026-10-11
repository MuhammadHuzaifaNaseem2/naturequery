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
  {
    key: 'Enter',
    ctrlKey: true,
    description: 'Submit query',
    action: 'onSubmitQuery',
    category: 'Query',
  },
  {
    key: 'r',
    ctrlKey: true,
    description: 'Run current SQL',
    action: 'onRunSQL',
    category: 'Query',
  },
  {
    key: 'l',
    ctrlKey: true,
    shiftKey: true,
    description: 'Format / Beautify SQL',
    action: 'onFormatSQL',
    category: 'Query',
  },
  {
    key: 's',
    ctrlKey: true,
    description: 'Save current query',
    action: 'onSaveQuery',
    category: 'Query',
  },
  // Navigation
  {
    key: 'k',
    ctrlKey: true,
    description: 'Open Command Palette',
    action: 'onOpenCommandPalette',
    category: 'Navigation',
  },
  {
    key: '/',
    ctrlKey: true,
    description: 'Toggle Schema Browser',
    action: 'onToggleSchema',
    category: 'Navigation',
  },
  {
    key: 'h',
    ctrlKey: true,
    description: 'Toggle Query History',
    action: 'onToggleHistory',
    category: 'Navigation',
  },
  {
    key: ',',
    ctrlKey: true,
    description: 'Toggle Settings',
    action: 'onToggleSettings',
    category: 'Navigation',
  },
  // Data
  {
    key: 'e',
    ctrlKey: true,
    shiftKey: true,
    description: 'Export to Excel',
    action: 'onExportExcel',
    category: 'Data',
  },
  {
    key: 'c',
    ctrlKey: true,
    shiftKey: true,
    description: 'Export to CSV',
    action: 'onExportCSV',
    category: 'Data',
  },
  // General
  {
    key: 'd',
    ctrlKey: true,
    description: 'Toggle dark mode',
    action: 'onToggleTheme',
    category: 'General',
  },
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
        const keyMatches =
          event.key === shortcut.key || event.key.toLowerCase() === shortcut.key.toLowerCase()
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

  // Escape closes the dialog, like every other dialog in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const key = 'rounded border border-border bg-background px-1.5 py-px font-mono text-[11px]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-[0_32px_64px_-32px_rgb(0_0_0/0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="shortcuts-title" className="text-base font-semibold">
            Keyboard shortcuts
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
          {grouped.map(({ category, shortcuts }) => (
            <div key={category} className="px-5 py-3">
              <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {category}
              </p>
              <div className="space-y-0.5">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground/85">{shortcut.description}</span>
                    <kbd className="ml-4 flex flex-shrink-0 items-center gap-1 font-sans">
                      {shortcut.ctrlKey && <span className={key}>Ctrl</span>}
                      {shortcut.shiftKey && <span className={key}>Shift</span>}
                      {shortcut.altKey && <span className={key}>Alt</span>}
                      <span className={key}>
                        {shortcut.key === ' '
                          ? 'Space'
                          : shortcut.key.length === 1
                            ? shortcut.key.toUpperCase()
                            : shortcut.key}
                      </span>
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-3">
          <p className="text-center text-xs text-muted-foreground">
            Press <kbd className={key}>?</kbd> to show or hide this list.
          </p>
        </div>
      </div>
    </div>
  )
}

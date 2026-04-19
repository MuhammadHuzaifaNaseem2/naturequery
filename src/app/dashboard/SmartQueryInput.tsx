'use client'

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { DatabaseSchema } from '@/actions/db'
import { Database, LayoutTemplate, History, Table, Columns, Lightbulb } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from '@/contexts/LocaleContext'

interface Suggestion {
  type: 'table' | 'column' | 'history' | 'template'
  text: string
  subtext?: string
}

interface SmartQueryInputProps {
  value: string
  onChange: (val: string) => void
  onSubmit?: () => void
  disabled?: boolean
  placeholder?: string
  schema?: DatabaseSchema
  history?: { question: string }[]
  templates?: { question: string }[]
  inputRef?: React.Ref<HTMLTextAreaElement>
  suggestionsEnabled?: boolean
  onToggleSuggestions?: () => void
}

export function SmartQueryInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  schema,
  history = [],
  templates = [],
  inputRef,
  suggestionsEnabled = true,
  onToggleSuggestions,
}: SmartQueryInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [closedBySelection, setClosedBySelection] = useState(false)
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const isApplyingRef = useRef(false)

  // Merge external ref
  const setRefs = (el: HTMLTextAreaElement) => {
    // @ts-ignore
    internalRef.current = el
    if (typeof inputRef === 'function') {
      inputRef(el)
    } else if (inputRef) {
      // @ts-ignore
      inputRef.current = el
    }
  }

  // Find the word currently being typed
  const getCurrentWord = () => {
    if (!internalRef.current) return ''
    const val = internalRef.current.value
    const cursor = internalRef.current.selectionStart
    const beforeCursor = val.slice(0, cursor)
    const words = beforeCursor.split(/\s+/)
    return words[words.length - 1].toLowerCase()
  }

  // Update suggestions based on input
  useEffect(() => {
    if (!showSuggestions || disabled || !suggestionsEnabled) return
    const word = getCurrentWord()
    
    if (word.length < 2) {
      // Show empty state or top templates if empty, but for smartness we just close if < 2 and not explicitly opened
      if (word.length === 0) {
        setSuggestions([
          ...templates.slice(0, 3).map(t => ({ type: 'template' as const, text: t.question, subtext: 'Template' })),
          ...history.slice(0, 3).map(h => ({ type: 'history' as const, text: h.question, subtext: 'Recent' }))
        ])
      } else {
        setSuggestions([])
      }
      return
    }

    const matches: Suggestion[] = []

    // 1. Match tables
    if (schema) {
      schema.tables.forEach(table => {
        if (table.tableName.toLowerCase().includes(word)) {
          matches.push({ type: 'table', text: table.tableName, subtext: 'Table' })
        }
        // Match columns
        table.columns.forEach(col => {
          if (col.name.toLowerCase().includes(word)) {
            matches.push({ type: 'column', text: col.name, subtext: `in ${table.tableName}` })
          }
        })
      })
    }

    // 2. Match history
    history.forEach(h => {
      if (h.question.toLowerCase().includes(word)) {
        matches.push({ type: 'history', text: h.question, subtext: 'History' })
      }
    })

    // Sort: tables first, then columns, then history
    matches.sort((a, b) => {
      const order = { table: 1, column: 2, template: 3, history: 4 }
      return order[a.type] - order[b.type]
    })

    // Remove duplicates
    const unique = Array.from(new Set(matches.map(m => m.text)))
      .map(text => matches.find(m => m.text === text)!)
      .slice(0, 8) // Max 8 suggestions

    setSuggestions(unique)
    setSelectedIndex(0)

  }, [value, showSuggestions, schema, history, templates, disabled])

  // Get caret coordinates to position dropdown
  const updateCaretPosition = () => {
    if (!internalRef.current) return
    // Simple rough estimation for textarea caret position
    const text = internalRef.current.value.substring(0, internalRef.current.selectionStart)
    const lines = text.split('\n')
    const currentLine = lines.length
    const currentLineText = lines[lines.length - 1]
    
    const lineHeight = 24 // aprox
    const charWidth = 8   // aprox
    
    setCursorPos({
      top: currentLine * lineHeight + 10,
      left: Math.min(currentLineText.length * charWidth + 20, 300)
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSubmit?.()
      return
    }

    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      isApplyingRef.current = true
      setClosedBySelection(true) // lock it down
      applySuggestion(suggestions[selectedIndex])
      setShowSuggestions(false)
      setTimeout(() => { isApplyingRef.current = false }, 100)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const applySuggestion = (suggestion: Suggestion) => {
    if (!internalRef.current) return
    
    const cursor = internalRef.current.selectionStart
    const beforeCursor = value.slice(0, cursor)
    const afterCursor = value.slice(cursor)
    
    const words = beforeCursor.split(/\s+/)
    words.pop() // Remove the partial word
    
    const prefix = words.length > 0 ? words.join(' ') + ' ' : ''
    // If it's a history/template, replace entire line or just append if it's table/col.
    // For smartness, if it's history/template we replace everything.
    if (suggestion.type === 'history' || suggestion.type === 'template') {
      onChange(suggestion.text + ' ')
      // Move cursor to end
      setTimeout(() => {
        if (internalRef.current) {
          internalRef.current.selectionStart = suggestion.text.length + 1
          internalRef.current.selectionEnd = suggestion.text.length + 1
        }
      }, 0)
    } else {
      const newVal = prefix + suggestion.text + ' ' + afterCursor
      onChange(newVal)
      // Restore cursor right after the inserted word
      setTimeout(() => {
        if (internalRef.current) {
          const newPos = prefix.length + suggestion.text.length + 1
          internalRef.current.selectionStart = newPos
          internalRef.current.selectionEnd = newPos
        }
      }, 0)
    }
  }

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table className="w-3 h-3 text-purple-400" />
      case 'column': return <Columns className="w-3 h-3 text-blue-400" />
      case 'history': return <History className="w-3 h-3 text-emerald-400" />
      case 'template': return <LayoutTemplate className="w-3 h-3 text-amber-400" />
      default: return <Database className="w-3 h-3" />
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <textarea
        ref={setRefs}
        value={value}
        onChange={e => {
          if (!suggestionsEnabled) return onChange(e.target.value)
          onChange(e.target.value)
          setClosedBySelection(false) // Unlock it if user types again
          setShowSuggestions(true)
          updateCaretPosition()
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (!suggestionsEnabled) return
          if (!isApplyingRef.current && !closedBySelection) {
            setShowSuggestions(true)
            updateCaretPosition()
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={2000}
        rows={5}
        className="tour-step-2 w-full min-h-[140px] max-h-[280px] p-4 bg-secondary/30 border-2 border-border/50 rounded-2xl text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/70 transition-all hover:border-primary/30 leading-relaxed font-sans"
      />

      {/* Suggestions toggle button */}
      {onToggleSuggestions && (
        <button
          type="button"
          onClick={onToggleSuggestions}
          title={suggestionsEnabled ? 'Disable autocomplete suggestions' : 'Enable autocomplete suggestions'}
          className={clsx(
            'absolute top-2 right-2 p-1.5 rounded-lg transition-all duration-200 group',
            suggestionsEnabled
              ? 'text-primary/70 hover:text-primary hover:bg-primary/10'
              : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary'
          )}
        >
          <Lightbulb className={clsx('w-3.5 h-3.5', suggestionsEnabled && 'fill-primary/20')} />
        </button>
      )}

      {suggestionsEnabled && showSuggestions && suggestions.length > 0 && (
        <div 
          className="absolute z-50 min-w-[240px] max-w-[320px] bg-card border border-border shadow-2xl rounded-xl overflow-hidden animate-slideUp"
          style={{ top: Math.min(cursorPos.top, 100), left: cursorPos.left }}
        >
          <div className="px-3 py-1.5 border-b border-border/50 bg-secondary/50">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Suggestions</span>
          </div>
          <div className="max-h-[220px] overflow-y-auto p-1">
            {suggestions.map((s, idx) => (
              <button
                key={`${s.type}-${s.text}-${idx}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  isApplyingRef.current = true
                  setClosedBySelection(true) // Lock it down
                  applySuggestion(s)
                  setShowSuggestions(false)
                  setTimeout(() => { 
                    internalRef.current?.focus()
                    isApplyingRef.current = false 
                  }, 10)
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-sm transition-colors",
                  idx === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                )}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-2 truncate">
                  {getIcon(s.type)}
                  <span className="truncate">{s.text}</span>
                </div>
                {s.subtext && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.subtext}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useCallback } from 'react'
import { Filter, X, Plus, Loader2, Sparkles, Send } from 'lucide-react'
import { clsx } from 'clsx'

export interface ActiveFilter {
  id: string
  label: string
  nlQuery: string
}

interface NLFilterBarProps {
  filters: ActiveFilter[]
  onAddFilter: (filterText: string) => Promise<void>
  onRemoveFilter: (id: string) => void
  onClearAll: () => void
  isApplying: boolean
  disabled?: boolean
}

export function NLFilterBar({
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
  isApplying,
  disabled,
}: NLFilterBarProps) {
  const [showInput, setShowInput] = useState(false)
  const [filterText, setFilterText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async () => {
    if (!filterText.trim() || isApplying) return
    await onAddFilter(filterText.trim())
    setFilterText('')
    setShowInput(false)
  }, [filterText, isApplying, onAddFilter])

  if (filters.length === 0 && !showInput) {
    return (
      <button
        onClick={() => {
          setShowInput(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/30 rounded-lg transition-all disabled:opacity-50"
      >
        <Filter className="w-3.5 h-3.5" />
        <span>Add AI filter...</span>
        <span className="text-[10px] opacity-60">e.g. &quot;only orders above $500&quot;</span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
      {/* Active filter pills */}
      {filters.map((filter) => (
        <div
          key={filter.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium animate-scaleIn"
        >
          <Sparkles className="w-3 h-3" />
          <span>{filter.label}</span>
          <button
            onClick={() => onRemoveFilter(filter.id)}
            className="ml-0.5 p-0.5 hover:bg-primary/20 rounded-full transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Add filter input */}
      {showInput ? (
        <div className="inline-flex items-center gap-1 bg-card border border-primary/30 rounded-full px-3 py-1 animate-scaleIn">
          <input
            ref={inputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') { setShowInput(false); setFilterText('') }
            }}
            placeholder="Describe filter..."
            className="bg-transparent text-xs outline-none w-36 placeholder:text-muted-foreground"
            disabled={isApplying}
            autoFocus
          />
          {isApplying ? (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!filterText.trim()}
              className="p-0.5 text-primary hover:text-primary/80 disabled:opacity-30 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => {
            setShowInput(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-primary border border-dashed border-border/60 hover:border-primary/30 rounded-full transition-all"
        >
          <Plus className="w-3 h-3" />
          Filter
        </button>
      )}

      {/* Clear all */}
      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

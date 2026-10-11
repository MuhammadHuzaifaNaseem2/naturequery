'use client'

import { useState, useRef, useCallback } from 'react'
import { Filter, X, Plus, Loader2, Send } from 'lucide-react'
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
        className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <Filter className="w-3.5 h-3.5" aria-hidden />
        <span>Filter in plain English</span>
        <span className="hidden font-serif text-[13px] italic text-muted-foreground/80 sm:inline">
          &ldquo;only orders above $500&rdquo;
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
      {/* Active filter pills */}
      {filters.map((filter) => (
        <div
          key={filter.id}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card py-1 pl-2.5 pr-1 font-serif text-[13px] italic text-foreground animate-fadeIn"
        >
          <Filter className="w-3 h-3 not-italic text-muted-foreground" aria-hidden />
          <span>{filter.label}</span>
          <button
            onClick={() => onRemoveFilter(filter.id)}
            aria-label={`Remove filter ${filter.label}`}
            className="ml-0.5 p-0.5 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Add filter input */}
      {showInput ? (
        <div className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2.5 py-1 focus-within:border-foreground/40 animate-fadeIn">
          <input
            ref={inputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') {
                setShowInput(false)
                setFilterText('')
              }
            }}
            placeholder="Describe the filter..."
            aria-label="Describe the filter in plain English"
            className="bg-transparent font-serif text-[13px] outline-none w-48 placeholder:italic placeholder:text-muted-foreground"
            disabled={isApplying}
            autoFocus
          />
          {isApplying ? (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!filterText.trim()}
              aria-label="Apply filter"
              className="p-0.5 text-foreground hover:text-primary disabled:opacity-30 transition-colors"
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
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Plus className="w-3 h-3" />
          Filter
        </button>
      )}

      {/* Clear all */}
      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

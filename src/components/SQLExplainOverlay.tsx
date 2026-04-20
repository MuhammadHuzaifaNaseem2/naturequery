'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Lightbulb, X } from 'lucide-react'
import { explainSQLClause } from '@/actions/ai'

interface SQLExplainOverlayProps {
  sql: string
}

interface TooltipState {
  text: string
  explanation: string | null
  loading: boolean
  x: number
  y: number
}

/**
 * Renders SQL with clickable clause segments.
 * When a user selects/clicks a portion of the SQL, sends it to AI for explanation.
 */
export function SQLExplainOverlay({ sql }: SQLExplainOverlayProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Close tooltip on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setTooltip(null)
      }
    }
    if (tooltip) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [tooltip])

  const handleTextSelect = useCallback(async () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return

    const selectedText = selection.toString().trim()
    if (selectedText.length < 3 || selectedText.length > 500) return

    // Get position for tooltip
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const x = rect.left - containerRect.left + rect.width / 2
    const y = rect.top - containerRect.top - 8

    setTooltip({ text: selectedText, explanation: null, loading: true, x, y })

    const result = await explainSQLClause(sql, selectedText)
    setTooltip((prev) =>
      prev?.text === selectedText
        ? {
            ...prev,
            explanation: result.explanation || 'Could not explain this clause.',
            loading: false,
          }
        : prev
    )
  }, [sql])

  // Split SQL into keyword tokens for syntax highlighting
  const tokens = tokenizeSQL(sql)

  return (
    <div ref={containerRef} className="relative">
      <pre
        className="text-foreground cursor-text select-text leading-relaxed"
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          width: '100%',
          margin: 0,
        }}
        onMouseUp={handleTextSelect}
      >
        {tokens.map((token, i) => (
          <span key={i} className={getTokenClass(token.type)}>
            {token.value}
          </span>
        ))}
      </pre>

      {/* Hint */}
      <div className="mt-2 flex items-center gap-1.5 text-xs leading-5 text-muted-foreground/60">
        <Lightbulb className="w-3 h-3 shrink-0" />
        <span>Select any part of the SQL to get an AI explanation</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="absolute z-50 animate-fadeIn"
          style={{
            left: Math.max(
              0,
              Math.min(tooltip.x - 140, (containerRef.current?.offsetWidth || 300) - 280)
            ),
            top: tooltip.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="bg-card border border-primary/20 rounded-xl shadow-xl p-3 w-[280px]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <code className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono line-clamp-1 flex-1">
                {tooltip.text}
              </code>
              <button
                onClick={() => setTooltip(null)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {tooltip.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Explaining...
              </div>
            ) : (
              <p className="text-xs text-foreground/80 leading-relaxed">{tooltip.explanation}</p>
            )}
            {/* Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r border-b border-primary/20 transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SQL Tokenizer for syntax highlighting ──────────────────────────

interface Token {
  type:
    | 'keyword'
    | 'function'
    | 'string'
    | 'number'
    | 'operator'
    | 'identifier'
    | 'whitespace'
    | 'punctuation'
  value: string
}

const SQL_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'NULL',
  'AS',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'FULL',
  'CROSS',
  'ON',
  'GROUP',
  'BY',
  'ORDER',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'DISTINCT',
  'UNION',
  'ALL',
  'INTERSECT',
  'EXCEPT',
  'WITH',
  'RECURSIVE',
  'ASC',
  'DESC',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'BETWEEN',
  'LIKE',
  'ILIKE',
  'EXISTS',
  'ANY',
  'TRUE',
  'FALSE',
  'OVER',
  'PARTITION',
  'NULLS',
  'FIRST',
  'LAST',
  'LATERAL',
  'FETCH',
  'NEXT',
  'ROWS',
  'ONLY',
])

const SQL_FUNCTIONS = new Set([
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COALESCE',
  'CAST',
  'EXTRACT',
  'DATE_TRUNC',
  'NOW',
  'CURRENT_DATE',
  'CURRENT_TIMESTAMP',
  'UPPER',
  'LOWER',
  'TRIM',
  'LENGTH',
  'SUBSTRING',
  'CONCAT',
  'REPLACE',
  'ROUND',
  'FLOOR',
  'CEIL',
  'ABS',
  'ROW_NUMBER',
  'RANK',
  'DENSE_RANK',
  'LAG',
  'LEAD',
  'FIRST_VALUE',
  'LAST_VALUE',
  'STRING_AGG',
  'ARRAY_AGG',
  'JSON_AGG',
  'TO_CHAR',
  'TO_DATE',
])

function tokenizeSQL(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < sql.length) {
    // Whitespace
    if (/\s/.test(sql[i])) {
      let start = i
      while (i < sql.length && /\s/.test(sql[i])) i++
      tokens.push({ type: 'whitespace', value: sql.slice(start, i) })
      continue
    }

    // String literal
    if (sql[i] === "'") {
      let start = i
      i++
      while (i < sql.length && sql[i] !== "'") i++
      if (i < sql.length) i++
      tokens.push({ type: 'string', value: sql.slice(start, i) })
      continue
    }

    // Number
    if (/\d/.test(sql[i])) {
      let start = i
      while (i < sql.length && /[\d.]/.test(sql[i])) i++
      tokens.push({ type: 'number', value: sql.slice(start, i) })
      continue
    }

    // Operators & punctuation
    if ('(),;*=<>!+-/'.includes(sql[i])) {
      tokens.push({
        type:
          sql[i] === '(' || sql[i] === ')' || sql[i] === ',' || sql[i] === ';'
            ? 'punctuation'
            : 'operator',
        value: sql[i],
      })
      i++
      continue
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(sql[i])) {
      let start = i
      while (i < sql.length && /[a-zA-Z0-9_.]/.test(sql[i])) i++
      const word = sql.slice(start, i)
      const upper = word.toUpperCase()

      if (SQL_KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: word })
      } else if (SQL_FUNCTIONS.has(upper)) {
        tokens.push({ type: 'function', value: word })
      } else {
        tokens.push({ type: 'identifier', value: word })
      }
      continue
    }

    // Anything else
    tokens.push({ type: 'punctuation', value: sql[i] })
    i++
  }

  return tokens
}

function getTokenClass(type: Token['type']): string {
  switch (type) {
    case 'keyword':
      return 'text-primary font-semibold'
    case 'function':
      return 'text-accent font-medium'
    case 'string':
      return 'text-success'
    case 'number':
      return 'text-amber-500'
    case 'operator':
      return 'text-muted-foreground'
    case 'identifier':
      return 'text-foreground'
    default:
      return ''
  }
}

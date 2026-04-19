'use client'

import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { sql, PostgreSQL, MySQL, SQLite, MSSQL, type SQLDialect } from '@codemirror/lang-sql'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { DatabaseSchema } from '@/actions/db'

// ── Custom light theme (matches NatureQuery design system) ────────────

const naturQueryLightTheme = EditorView.theme({
  '&': {
    fontSize: '13.5px',
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Menlo, monospace',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    caretColor: 'hsl(var(--primary))',
    padding: '12px 0',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'hsl(var(--primary))',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'hsl(var(--primary) / 0.15)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(var(--primary) / 0.1)',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--primary) / 0.04)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--primary) / 0.06)',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--secondary) / 0.5)',
    color: 'hsl(var(--muted-foreground))',
    border: 'none',
    borderRight: '1px solid hsl(var(--border))',
    paddingRight: '4px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    fontSize: '11px',
    padding: '0 8px 0 4px',
    minWidth: '32px',
    opacity: '0.6',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    cursor: 'pointer',
  },
  '.cm-tooltip': {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 8px 32px hsl(var(--foreground) / 0.08)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: '12px',
      maxHeight: '200px',
    },
    '& > ul > li': {
      padding: '4px 10px',
      lineHeight: '1.5',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'hsl(var(--primary) / 0.12)',
      color: 'hsl(var(--primary))',
    },
  },
  '.cm-matchingBracket': {
    backgroundColor: 'hsl(var(--primary) / 0.15)',
    outline: '1px solid hsl(var(--primary) / 0.4)',
    borderRadius: '2px',
  },
  '.cm-searchMatch': {
    backgroundColor: 'hsl(var(--warning) / 0.25)',
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'hsl(var(--primary) / 0.25)',
  },
  '.cm-panels': {
    backgroundColor: 'hsl(var(--card))',
    borderTop: '1px solid hsl(var(--border))',
  },
  '.cm-panel.cm-search': {
    padding: '8px 12px',
  },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    fontSize: '12px',
  },
}, { dark: false })

const naturQueryLightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed', fontWeight: '600' },    // purple - SELECT, FROM, WHERE
  { tag: tags.operator, color: '#7c3aed' },                      // purple - =, <, >
  { tag: tags.definitionKeyword, color: '#7c3aed', fontWeight: '600' },
  { tag: tags.typeName, color: '#0891b2' },                       // teal - INT, VARCHAR
  { tag: tags.string, color: '#059669' },                         // green - 'strings'
  { tag: tags.number, color: '#ea580c' },                         // orange - numbers
  { tag: tags.bool, color: '#ea580c' },                           // orange - TRUE/FALSE
  { tag: tags.null, color: '#6b7280', fontStyle: 'italic' },      // gray italic - NULL
  { tag: tags.comment, color: '#9ca3af', fontStyle: 'italic' },   // gray italic - comments
  { tag: tags.function(tags.variableName), color: '#2563eb' },    // blue - COUNT(), SUM()
  { tag: tags.variableName, color: '#1e293b' },                   // dark - column names
  { tag: tags.propertyName, color: '#0f172a' },                   // dark - table.column
  { tag: tags.standard(tags.variableName), color: '#2563eb' },    // blue - built-in funcs
  { tag: tags.special(tags.string), color: '#059669' },           // green
  { tag: tags.punctuation, color: '#64748b' },                    // gray - , () ;
])

// ── Custom dark theme overrides ──────────────────────────────────────

const naturQueryDarkTheme = EditorView.theme({
  '&': {
    fontSize: '13.5px',
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", Menlo, monospace',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    caretColor: 'hsl(var(--primary))',
    padding: '12px 0',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'hsl(var(--primary))',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'hsl(var(--primary) / 0.2)',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--primary) / 0.06)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--primary) / 0.08)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'hsl(var(--muted-foreground))',
    border: 'none',
    borderRight: '1px solid hsl(var(--border) / 0.5)',
    paddingRight: '4px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    fontSize: '11px',
    padding: '0 8px 0 4px',
    minWidth: '32px',
    opacity: '0.5',
  },
  '.cm-tooltip': {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: 'hsl(var(--primary) / 0.2)',
      color: 'hsl(var(--primary))',
    },
  },
  '.cm-matchingBracket': {
    backgroundColor: 'hsl(var(--primary) / 0.2)',
    outline: '1px solid hsl(var(--primary) / 0.5)',
    borderRadius: '2px',
  },
  '.cm-panels': {
    backgroundColor: 'hsl(var(--card))',
  },
}, { dark: true })

// ── Schema → CodeMirror completion table ─────────────────────────────

function schemaToCompletionSpec(schema?: DatabaseSchema): Record<string, string[]> {
  if (!schema?.tables) return {}
  const spec: Record<string, string[]> = {}
  for (const table of schema.tables) {
    spec[table.tableName] = table.columns.map(c => c.name)
  }
  return spec
}

// Map our dbType to CodeMirror SQL dialect
function getDialect(dbType?: string): SQLDialect {
  switch (dbType) {
    case 'mysql': return MySQL
    case 'sqlite': return SQLite
    case 'sqlserver': return MSSQL
    default: return PostgreSQL
  }
}

// ── Props ────────────────────────────────────────────────────────────

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute?: () => void
  schema?: DatabaseSchema
  dbType?: string
  isDark?: boolean
  placeholder?: string
  readOnly?: boolean
  height?: string
  className?: string
}

// ── Component ────────────────────────────────────────────────────────

export function SQLEditor({
  value,
  onChange,
  onExecute,
  schema,
  dbType,
  isDark = false,
  placeholder = 'Write your SQL query here...\n\n-- Ctrl+Enter to run\n-- Ctrl+Space for autocomplete',
  readOnly = false,
  height = '280px',
  className = '',
}: SQLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const themeCompartment = useRef(new Compartment())
  const sqlCompartment = useRef(new Compartment())
  const readOnlyCompartment = useRef(new Compartment())

  // Build SQL extension with schema autocompletion
  const sqlExtension = useMemo(() => {
    return sql({
      dialect: getDialect(dbType),
      schema: schemaToCompletionSpec(schema),
      upperCaseKeywords: true,
    })
  }, [schema, dbType])

  // Pick theme based on dark mode
  const themeExtensions = useMemo(() => {
    return isDark
      ? [oneDark, naturQueryDarkTheme]
      : [syntaxHighlighting(naturQueryLightHighlight), naturQueryLightTheme]
  }, [isDark])

  // Ctrl+Enter to execute
  const executeKeymap = useMemo(() => {
    return keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: () => {
          onExecute?.()
          return true
        },
      },
    ])
  }, [onExecute])

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return

    const startState = EditorState.create({
      doc: value,
      extensions: [
        // Core
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightSelectionMatches(),

        // Autocompletion
        autocompletion({
          activateOnTyping: true,
          maxRenderedOptions: 20,
        }),

        // Keymaps
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        executeKeymap,

        // SQL language with schema
        sqlCompartment.current.of(sqlExtension),

        // Theme
        themeCompartment.current.of(themeExtensions),

        // Read-only
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),

        // Placeholder
        cmPlaceholder(placeholder),

        // Height constraint
        EditorView.theme({
          '&': { maxHeight: height },
          '.cm-scroller': { overflow: 'auto' },
        }),

        // Sync changes back to React state
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString()
            onChange(newValue)
          }
        }),

        // Default syntax highlighting for light mode fallback
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentValue = view.state.doc.toString()
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      })
    }
  }, [value])

  // Update theme when isDark changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(themeExtensions),
    })
  }, [themeExtensions])

  // Update SQL dialect/schema when they change
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: sqlCompartment.current.reconfigure(sqlExtension),
    })
  }, [sqlExtension])

  // Update read-only when it changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        EditorState.readOnly.of(readOnly)
      ),
    })
  }, [readOnly])

  return (
    <div
      ref={editorRef}
      className={`overflow-hidden rounded-lg border border-border/50 bg-secondary/20 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200 ${className}`}
    />
  )
}

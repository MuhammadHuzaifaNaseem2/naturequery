'use client'

/**
 * StreamingQueryPanel
 *
 * A self-contained AI query panel that streams the model's chain-of-thought
 * reasoning token-by-token before presenting the final SQL.
 *
 * Phases:
 *   idle       → user types question, hits Generate
 *   thinking   → CoT tokens stream into a terminal-style panel
 *   sql_ready  → SQL appears with execute / save / HITL feedback controls
 *   error      → error banner with retry
 *
 * Props:
 *   connectionId    — the DB connection to query against
 *   connectionName  — display name for the connection badge
 *   onSQLReady      — called when final SQL is confirmed; parent can execute it
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react'
import {
  Sparkles,
  Brain,
  Terminal,
  Play,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'
import { clsx } from 'clsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'thinking' | 'sql_ready' | 'error'

interface HITLFeedback {
  queryId: string
  rating: 1 | -1 | null
  correctedSql: string
  showCorrection: boolean
  submitted: boolean
}

interface StreamingQueryPanelProps {
  connectionId: string
  connectionName?: string
  onSQLReady?: (sql: string, question: string) => void
  conversationContext?: { question: string; sql: string; rowCount?: number }[]
  onPlanLimitReached?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), timeout)
      })
    },
    [timeout]
  )
  return { copied, copy }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated cursor blink */
function Cursor() {
  return (
    <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
  )
}

/** Terminal-style CoT display */
function ThinkingTerminal({
  tokens,
  isActive,
}: {
  tokens: string
  isActive: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as tokens arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [tokens])

  return (
    <div className="rounded-xl overflow-hidden border border-border/60 shadow-inner">
      {/* Terminal title bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        <div className="flex items-center gap-1.5 ml-3">
          <Brain className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase">
            AI Reasoning
          </span>
        </div>
        {isActive && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        )}
      </div>

      {/* Token output */}
      <div
        ref={scrollRef}
        className="bg-zinc-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed min-h-[120px] max-h-[220px] overflow-y-auto whitespace-pre-wrap"
      >
        <span className="text-zinc-500 select-none">$ </span>
        {tokens || (
          <span className="text-zinc-600 italic">Analyzing your question and schema...</span>
        )}
        {isActive && <Cursor />}
      </div>
    </div>
  )
}

/** SQL code block with copy button */
function SQLBlock({ sql, onCopy }: { sql: string; onCopy?: () => void }) {
  const { copied, copy } = useCopyToClipboard()

  const handleCopy = () => {
    copy(sql)
    onCopy?.()
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-border/60">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            Generated SQL
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors font-mono"
          title="Copy SQL"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="bg-zinc-950 p-4 font-mono text-sm text-sky-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
        {sql}
      </pre>
    </div>
  )
}

/** Thumbs up/down + correction input for HITL feedback */
function HITLFeedbackBar({
  queryId,
  onFeedbackSubmitted,
}: {
  queryId: string
  onFeedbackSubmitted?: (rating: 1 | -1) => void
}) {
  const [state, setState] = useState<{
    rating: 1 | -1 | null
    showCorrection: boolean
    correctedSql: string
    submitting: boolean
    submitted: boolean
  }>({
    rating: null,
    showCorrection: false,
    correctedSql: '',
    submitting: false,
    submitted: false,
  })

  const submitFeedback = async (rating: 1 | -1, correctedSql?: string) => {
    setState((s) => ({ ...s, submitting: true }))
    try {
      await fetch('/api/generate-sql/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId, rating, correctedSql }),
      })
      setState((s) => ({ ...s, submitting: false, submitted: true, rating }))
      onFeedbackSubmitted?.(rating)
    } catch {
      setState((s) => ({ ...s, submitting: false }))
    }
  }

  if (state.submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>
          {state.rating === 1
            ? 'Thanks! This helps improve future suggestions.'
            : 'Correction saved. We\'ll use this to improve accuracy.'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Was this SQL correct?</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => submitFeedback(1)}
            disabled={state.submitting}
            title="SQL is correct"
            className={clsx(
              'p-1.5 rounded-lg transition-all text-xs flex items-center gap-1',
              state.rating === 1
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'hover:bg-secondary text-muted-foreground hover:text-emerald-400'
            )}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() =>
              setState((s) => ({
                ...s,
                rating: -1,
                showCorrection: !s.showCorrection,
              }))
            }
            disabled={state.submitting}
            title="SQL needs correction"
            className={clsx(
              'p-1.5 rounded-lg transition-all flex items-center gap-1',
              state.rating === -1
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'hover:bg-secondary text-muted-foreground hover:text-red-400'
            )}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Correction input — expands on thumbs down */}
      {state.showCorrection && (
        <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-muted-foreground">
            Paste the correct SQL below (helps train the model):
          </p>
          <textarea
            value={state.correctedSql}
            onChange={(e) =>
              setState((s) => ({ ...s, correctedSql: e.target.value }))
            }
            placeholder="SELECT ... (your corrected query)"
            rows={4}
            className="w-full px-3 py-2 text-xs font-mono bg-zinc-950 border border-border rounded-lg text-sky-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
          <button
            onClick={() => submitFeedback(-1, state.correctedSql)}
            disabled={state.submitting || !state.correctedSql.trim()}
            className="btn-primary text-xs py-1.5 px-3"
          >
            {state.submitting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Submit Correction
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StreamingQueryPanel({
  connectionId,
  connectionName,
  onSQLReady,
  conversationContext,
  onPlanLimitReached,
}: StreamingQueryPanelProps) {
  const [question, setQuestion] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [thoughtTokens, setThoughtTokens] = useState('')
  const [finalSQL, setFinalSQL] = useState('')
  const [queryId, setQueryId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [showThoughts, setShowThoughts] = useState(true)

  // Abort controller ref — lets us cancel an in-flight stream
  const abortRef = useRef<AbortController | null>(null)

  // Batch token appends with rAF to avoid layout thrashing on fast streams
  const pendingTokensRef = useRef('')
  const rafRef = useRef<number | null>(null)

  const flushTokens = useCallback(() => {
    if (pendingTokensRef.current) {
      setThoughtTokens((prev) => prev + pendingTokensRef.current)
      pendingTokensRef.current = ''
    }
    rafRef.current = null
  }, [])

  const appendThought = useCallback(
    (token: string) => {
      pendingTokensRef.current += token
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushTokens)
      }
    },
    [flushTokens]
  )

  // Clean up rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    pendingTokensRef.current = ''
    setPhase('idle')
    setThoughtTokens('')
    setFinalSQL('')
    setQueryId(null)
    setErrorMessage('')
    setShowThoughts(true)
  }, [])

  const generate = useCallback(async () => {
    if (!question.trim() || !connectionId) return

    reset()
    setPhase('thinking')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/generate-sql/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          connectionId,
          conversationContext: conversationContext?.length ? conversationContext : undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => 'Request failed')
        let parsed: { error?: string; limitReached?: boolean } | null = null
        try { parsed = JSON.parse(body) } catch { /* not JSON */ }
        if (parsed?.limitReached) {
          onPlanLimitReached?.()
          setPhase('idle')
          return
        }
        throw new Error(parsed?.error ?? body)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages (terminated by \n\n)
        const messages = sseBuffer.split('\n\n')
        sseBuffer = messages.pop() ?? '' // keep incomplete last chunk

        for (const message of messages) {
          if (!message.trim()) continue

          let event = 'message'
          let data = ''

          for (const line of message.split('\n')) {
            if (line.startsWith('event: ')) {
              event = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              data = line.slice(6).trim()
            }
          }

          if (!data) continue

          try {
            const parsed = JSON.parse(data)

            switch (event) {
              case 'thought':
                appendThought(parsed.token ?? '')
                break

              case 'sql':
                // Flush any pending thought tokens before transitioning
                flushTokens()
                if (rafRef.current !== null) {
                  cancelAnimationFrame(rafRef.current)
                  rafRef.current = null
                }
                setFinalSQL(parsed.sql ?? '')
                setPhase('sql_ready')
                break

              case 'done':
                setQueryId(parsed.queryId ?? null)
                break

              case 'error':
                throw new Error(parsed.message ?? 'Stream error')
            }
          } catch (parseError) {
            if (event === 'error') {
              throw new Error(data)
            }
            // Non-error JSON parse failures are ignored (malformed chunk)
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return // user cancelled
      setErrorMessage(
        error instanceof Error ? error.message : 'SQL generation failed'
      )
      setPhase('error')
    }
  }, [question, connectionId, reset, appendThought, flushTokens])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      generate()
    }
  }

  const handleUseSQL = () => {
    if (finalSQL && onSQLReady) {
      onSQLReady(finalSQL, question)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Question input */}
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={phase === 'thinking'}
          placeholder="Ask a question about your data... (Ctrl+Enter to generate)"
          rows={3}
          className={clsx(
            'w-full p-4 bg-secondary/30 border-2 rounded-2xl text-sm resize-none',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
            'placeholder:text-muted-foreground/60 transition-all leading-relaxed',
            phase === 'thinking'
              ? 'border-primary/30 opacity-60 cursor-not-allowed'
              : 'border-border/50 hover:border-primary/30'
          )}
        />
        {connectionName && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-lg border border-border/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
              {connectionName}
            </span>
          </div>
        )}
      </div>

      {/* Generate / Cancel button row */}
      <div className="flex items-center gap-2">
        {phase === 'thinking' ? (
          <button
            onClick={() => {
              abortRef.current?.abort()
              setPhase('idle')
            }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={!question.trim() || !connectionId}
            className="btn-gradient flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Generate SQL
          </button>
        )}

        {(phase === 'sql_ready' || phase === 'error') && (
          <button
            onClick={reset}
            className="btn-secondary text-sm flex items-center gap-2"
            title="Start over"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Query
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
          Ctrl+Enter to generate
        </span>
      </div>

      {/* Chain-of-Thought terminal — visible during thinking + collapsible after */}
      {(phase === 'thinking' || (phase === 'sql_ready' && thoughtTokens)) && (
        <div className="space-y-2">
          {phase === 'sql_ready' && (
            <button
              onClick={() => setShowThoughts((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showThoughts ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {showThoughts ? 'Hide' : 'Show'} reasoning
            </button>
          )}

          {(phase === 'thinking' || showThoughts) && (
            <ThinkingTerminal
              tokens={thoughtTokens}
              isActive={phase === 'thinking'}
            />
          )}
        </div>
      )}

      {/* Thinking progress indicator (before first token arrives) */}
      {phase === 'thinking' && !thoughtTokens && (
        <div className="flex items-center gap-3 px-4 py-3 bg-secondary/40 border border-border/40 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Fetching schema and building context...
          </span>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl animate-in fade-in duration-200">
          <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Generation failed</p>
            <p className="text-xs text-destructive/80 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Final SQL + controls */}
      {phase === 'sql_ready' && finalSQL && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SQLBlock sql={finalSQL} />

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SQL validated — read-only SELECT</span>
            </div>

            {onSQLReady && (
              <button
                onClick={handleUseSQL}
                className="ml-auto btn-success text-sm py-1.5 flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                Run Query
              </button>
            )}
          </div>

          {/* HITL feedback */}
          {queryId && (
            <div className="border-t border-border/40 pt-3">
              <HITLFeedbackBar queryId={queryId} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

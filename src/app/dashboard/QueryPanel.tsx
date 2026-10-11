'use client'

import { type Ref, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play,
  Brain,
  Download,
  CheckCircle2,
  Loader2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  Table2,
  BarChart3,
  Bookmark,
  Pin,
  Clock,
  Database,
  Wand2,
  AlignLeft,
  LayoutTemplate,
  RotateCcw,
  Gauge,
  CopyPlus,
  Scale,
  Lightbulb,
} from 'lucide-react'
import { NLFilterBar, type ActiveFilter } from '@/components/NLFilterBar'
import { SQLExplainOverlay } from '@/components/SQLExplainOverlay'
import { QueryPerformancePanel } from '@/components/QueryPerformancePanel'
import { SQLEditor } from '@/components/SQLEditor'
import { clsx } from 'clsx'
import ResultsTable from '@/components/ResultsTable'
import { ResultsChart } from '@/components/ResultsChart'
import { DataInsights } from '@/components/DataInsights'
import { explainSQL } from '@/actions/ai'
import { format as formatSQL } from 'sql-formatter'
import { saveAsTemplate } from '@/actions/queries'
import { toast } from 'sonner'
import { QueryResultRow } from '@/actions/db'
import { SavedConnection, QueryResults } from './types'
import type { InsightResult } from '@/actions/insights'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'
import { SmartQueryInput } from './SmartQueryInput'
import { StepLabel } from './StepLabel'
import { useTheme } from '@/components/ThemeProvider'
import { WEB_DATABASES } from '@/lib/supported-databases'
import {
  createInvestigationReport,
  INVESTIGATION_BASELINE_KEY,
  INVESTIGATION_TRANSFER_KEY,
  isInvestigationReport,
  type InvestigationReport,
} from '@/lib/investigation-transfer'

type ResultsView = 'table' | 'chart' | 'insights' | 'performance'
type SaveState = 'idle' | 'saving' | 'saved'

interface QueryPanelProps {
  activeConnection: SavedConnection | undefined
  nlQuery: string
  onNlQueryChange: (query: string) => void
  generatedSQL: string
  onSQLChange?: (sql: string) => void
  isGenerating: boolean
  isExecuting: boolean
  isExporting: boolean
  isFixing?: boolean
  queryResults: QueryResults | null
  error: string | null
  showExportMenu: boolean
  onToggleExportMenu: (show: boolean) => void
  onGenerateSQL: () => void
  onStreamingSQL?: (sql: string, question: string) => void
  onExecuteSQL: (overrideSql?: string) => void
  onFixQuery?: () => void
  onExport: (format: 'excel' | 'csv') => void
  onSaveQuery: (
    name: string,
    question: string,
    sql: string
  ) => void | boolean | Promise<boolean | void>
  onPinToDashboard?: (
    question: string,
    sql: string,
    data: QueryResultRow[],
    fields: string[]
  ) => void
  onScheduleQuery?: (question: string, sql: string) => void
  queryInputRef: Ref<HTMLTextAreaElement>
  insights?: InsightResult | null
  isAnalyzing?: boolean
  onAnalyze?: () => void
  onFollowUpClick?: (question: string) => void
  onAddDemoConnection?: () => void
  onAddConnection?: () => void
  queryHistory?: QueryHistoryItem[]
  savedQueries?: SavedQueryItem[]
  schemaSuggestions?: { summary: string; suggestions: string[] } | null
  isDiscovering?: boolean
  conversationLength?: number
  conversationContext?: { question: string; sql: string; rowCount?: number }[]
  onClearConversation?: () => void
  activeFilters?: ActiveFilter[]
  isApplyingFilter?: boolean
  onAddFilter?: (filterText: string) => Promise<void>
  onRemoveFilter?: (id: string) => void
  onClearFilters?: () => void
  onPlanLimitReached?: () => void
}

const kbd =
  'rounded border border-border bg-background px-1 py-px font-mono text-[10px] text-muted-foreground'

/** Quiet text button used for secondary actions next to a step. */
const textAction =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50'

/** Square icon button used in the answer toolbar. */
const iconAction =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

export function QueryPanel({
  activeConnection,
  nlQuery,
  onNlQueryChange,
  generatedSQL,
  onSQLChange,
  isGenerating,
  isExecuting,
  isExporting,
  isFixing,
  queryResults,
  error,
  showExportMenu,
  onToggleExportMenu,
  onGenerateSQL,
  onExecuteSQL,
  onFixQuery,
  onExport,
  onSaveQuery,
  onPinToDashboard,
  onScheduleQuery,
  queryInputRef,
  insights,
  isAnalyzing,
  onAnalyze,
  onFollowUpClick,
  onAddDemoConnection,
  onAddConnection,
  queryHistory,
  savedQueries,
  schemaSuggestions,
  isDiscovering,
  conversationLength,
  onClearConversation,
  activeFilters,
  isApplyingFilter,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
}: QueryPanelProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const [resultsView, setResultsView] = useState<ResultsView>('table')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [inputMode, setInputMode] = useState<'ai' | 'sql'>('ai')
  const [rawSQL, setRawSQL] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editorSaveState, setEditorSaveState] = useState<SaveState>('idle')
  const [templateState, setTemplateState] = useState<SaveState>('idle')
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [investigationBaseline, setInvestigationBaseline] = useState<InvestigationReport | null>(
    null
  )

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(INVESTIGATION_BASELINE_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (isInvestigationReport(parsed)) setInvestigationBaseline(parsed)
    } catch {
      sessionStorage.removeItem(INVESTIGATION_BASELINE_KEY)
    }
  }, [])

  const currentInvestigationReport = () => {
    if (!queryResults || !activeConnection) return null
    const question = nlQuery.trim()
    return createInvestigationReport({
      name: question || `Query result from ${activeConnection.name}`,
      question,
      sql: generatedSQL,
      connectionId: activeConnection.id,
      connectionName: activeConnection.name,
      rows: queryResults.rows,
      fields: queryResults.fields,
    })
  }

  const setCurrentAsReportA = () => {
    const report = currentInvestigationReport()
    if (!report) return
    try {
      sessionStorage.setItem(INVESTIGATION_BASELINE_KEY, JSON.stringify(report))
      setInvestigationBaseline(report)
      toast('Report A is ready', {
        description: 'Run the second query, then click Compare with A.',
      })
    } catch {
      toast.error('This result is too large to keep for comparison', {
        description: 'Run a smaller query by adding a date range or LIMIT.',
      })
    }
  }

  const compareCurrentWithReportA = () => {
    const comparison = currentInvestigationReport()
    if (!investigationBaseline || !comparison) return
    try {
      sessionStorage.setItem(
        INVESTIGATION_TRANSFER_KEY,
        JSON.stringify({ source: investigationBaseline, comparison })
      )
      router.push('/dashboard/investigate')
    } catch {
      toast.error('These results are too large to compare in this browser', {
        description: 'Run smaller queries by adding a date range or LIMIT.',
      })
    }
  }

  // Parse AI rate limit retry delay from error message and start countdown
  useEffect(() => {
    if (!error || !error.toLowerCase().includes('ai service rate limit')) {
      setRetryCountdown(null)
      return
    }
    const match = error.match(/try again in ([\d.]+[ms]+)/i)
    if (!match) return
    const timeStr = match[1]
    const minutes = parseInt(timeStr.match(/(\d+)m/)?.[1] ?? '0')
    const seconds = parseFloat(timeStr.match(/([\d.]+)s/)?.[1] ?? '0')
    const total = Math.ceil(minutes * 60 + seconds)
    if (total > 0) setRetryCountdown(total)
  }, [error])

  // Countdown tick
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return
    const timer = setTimeout(() => setRetryCountdown((n) => (n !== null ? n - 1 : null)), 1000)
    return () => clearTimeout(timer)
  }, [retryCountdown])

  // Suggestions toggle — persisted to localStorage
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(() => {
    try {
      return localStorage.getItem('rf_suggestions_enabled') !== 'false'
    } catch {
      return true
    }
  })
  const handleToggleSuggestions = () => {
    setSuggestionsEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem('rf_suggestions_enabled', String(next))
      } catch {}
      return next
    })
  }

  // Clear stale explanation whenever SQL changes (BUG-001)
  useEffect(() => {
    setExplanation(null)
  }, [generatedSQL])

  const handleExplain = async () => {
    if (!generatedSQL || isExplaining) return
    setIsExplaining(true)
    const result = await explainSQL(generatedSQL)
    setIsExplaining(false)
    if (result.success && result.explanation) {
      setExplanation(result.explanation)
    }
  }

  // Run raw SQL from the editor
  const handleEditorExecute = () => {
    if (!rawSQL.trim() || !onSQLChange) return
    onSQLChange(rawSQL) // Sync UI state
    onExecuteSQL(rawSQL) // Execute immediately using the passed value
  }

  // Saves through the dashboard hook and shows "Saved" on the button instead of a toast.
  const saveWithFeedback = async (
    setState: (state: SaveState) => void,
    name: string,
    question: string,
    sql: string
  ) => {
    setState('saving')
    const result = await onSaveQuery(name, question, sql)
    // void-returning callers: assume success since errors are reported by the hook
    const ok = result === undefined ? true : !!result
    if (ok) {
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } else {
      setState('idle')
    }
  }

  const formatted = (sql: string) => {
    try {
      return formatSQL(sql, { language: 'sql', tabWidth: 2, keywordCase: 'upper' })
    } catch {
      return null
    }
  }

  // Empty state: no database selected yet
  if (!activeConnection) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-14 sm:px-10 sm:pt-20">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {t('dashboard.queryPanel.emptyLabel')}
          </p>
          <h2 className="mt-4 max-w-3xl text-balance font-serif text-[clamp(2rem,4vw,3.1rem)] font-normal leading-[1.06] tracking-[-0.02em] text-foreground">
            {t('dashboard.queryPanel.emptyTitle')}{' '}
            <em className="text-muted-foreground">{t('dashboard.queryPanel.emptyTitleRest')}</em>
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {t('dashboard.queryPanel.emptyBody')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onAddConnection} className="btn-primary h-10 px-5">
              <Database className="h-4 w-4" aria-hidden />
              {t('dashboard.queryPanel.addConnection')}
            </button>
            <button onClick={onAddDemoConnection} className="btn-secondary h-10 px-5">
              {t('dashboard.queryPanel.tryDemoDatabase')}
            </button>
          </div>
          <div className="mt-14 max-w-3xl border-t border-border pt-6">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t('dashboard.queryPanel.worksWith')}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs text-muted-foreground">
              {WEB_DATABASES.map((name) => (
                <li key={name}>{name}</li>
              ))}
              <li className="text-foreground/70">{t('dashboard.queryPanel.csvOrExcel')}</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const followUps = conversationLength ?? 0
  const views: { id: ResultsView; label: string; Icon: typeof Table2 }[] = [
    { id: 'table', label: t('dashboard.queryPanel.table'), Icon: Table2 },
    { id: 'chart', label: t('dashboard.queryPanel.chart'), Icon: BarChart3 },
    { id: 'insights', label: t('dashboard.queryPanel.insights'), Icon: Brain },
    { id: 'performance', label: t('dashboard.queryPanel.performance'), Icon: Gauge },
  ]

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-10 px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
        {/* 01 · The question */}
        <section aria-labelledby="step-ask" className="animate-fadeIn">
          <div className="mb-3 flex items-end justify-between gap-4">
            <StepLabel step="01" id="step-ask">
              {t('dashboard.queryPanel.stepAsk')}
            </StepLabel>
            <div
              role="tablist"
              aria-label={t('dashboard.queryPanel.stepAsk')}
              className="flex items-center rounded-md border border-border bg-card p-0.5"
            >
              {(['ai', 'sql'] as const).map((mode) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={inputMode === mode}
                  onClick={() => {
                    setInputMode(mode)
                    // Pre-load existing generated SQL into the editor
                    if (mode === 'sql' && generatedSQL && !rawSQL) setRawSQL(generatedSQL)
                  }}
                  className={clsx(
                    'rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
                    inputMode === mode
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {mode === 'ai'
                    ? t('dashboard.queryPanel.modeQuestion')
                    : t('dashboard.queryPanel.modeSql')}
                </button>
              ))}
            </div>
          </div>

          {inputMode === 'ai' && (
            <>
              <div className="rounded-lg border border-border bg-card transition-colors focus-within:border-foreground/35">
                {followUps > 0 && (
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">
                    <span>
                      {followUps === 1
                        ? t('dashboard.queryPanel.followUpOne')
                        : t('dashboard.queryPanel.followUpMany', { count: followUps })}
                    </span>
                    <button
                      onClick={onClearConversation}
                      className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      {t('dashboard.queryPanel.startOver')}
                    </button>
                  </div>
                )}

                <SmartQueryInput
                  value={nlQuery}
                  onChange={onNlQueryChange}
                  onSubmit={onGenerateSQL}
                  disabled={!activeConnection}
                  placeholder={t('dashboard.queryPanel.placeholder')}
                  schema={activeConnection?.schema}
                  history={queryHistory?.map((h) => ({ question: h.question })) || []}
                  templates={savedQueries?.map((q) => ({ question: q.question })) || []}
                  inputRef={queryInputRef}
                  suggestionsEnabled={suggestionsEnabled}
                  onToggleSuggestions={handleToggleSuggestions}
                />

                <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 sm:px-4">
                  <span className="hidden items-center gap-1 sm:inline-flex">
                    <kbd className={kbd}>Ctrl</kbd>
                    <kbd className={kbd}>Enter</kbd>
                  </span>
                  <button
                    onClick={onGenerateSQL}
                    disabled={!activeConnection || !nlQuery.trim() || isGenerating}
                    className={clsx('btn-primary ml-auto', isGenerating && 'btn-generating')}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {t('dashboard.queryPanel.generating')}
                      </>
                    ) : (
                      t('dashboard.queryPanel.generateButton')
                    )}
                  </button>
                </div>
              </div>

              {/* Questions suggested from the schema */}
              {schemaSuggestions && (
                <div className="mt-5">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {isDiscovering
                      ? t('dashboard.queryPanel.analyzingSchema')
                      : t('dashboard.queryPanel.questionsToTry')}
                  </p>
                  {schemaSuggestions.summary && (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {schemaSuggestions.summary}
                    </p>
                  )}
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {schemaSuggestions.suggestions.slice(0, 4).map((s, i) => (
                      <li key={i}>
                        <button
                          onClick={() => onNlQueryChange(s)}
                          className="rounded-md border border-border bg-card px-3 py-1.5 text-left font-serif text-[0.95rem] italic leading-snug text-foreground transition-colors hover:border-foreground/30"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {inputMode === 'sql' && (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <SQLEditor
                value={rawSQL}
                onChange={setRawSQL}
                onExecute={handleEditorExecute}
                schema={activeConnection?.schema}
                dbType={activeConnection?.dbType}
                isDark={resolvedTheme === 'dark'}
                height="280px"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 sm:px-4">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const next = formatted(rawSQL)
                      if (next) setRawSQL(next)
                    }}
                    disabled={!rawSQL.trim()}
                    className={textAction}
                  >
                    <AlignLeft className="h-3.5 w-3.5" aria-hidden />
                    {t('dashboard.queryPanel.format')}
                  </button>
                  {rawSQL.trim() && (
                    <button
                      onClick={() => {
                        if (editorSaveState !== 'idle') return
                        const name = rawSQL.slice(0, 50).replace(/\n/g, ' ') || 'Custom Query'
                        saveWithFeedback(setEditorSaveState, name, '', rawSQL)
                      }}
                      disabled={editorSaveState !== 'idle'}
                      className={textAction}
                    >
                      {editorSaveState === 'saving' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : editorSaveState === 'saved' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {editorSaveState === 'saved' ? 'Saved' : t('common.save')}
                    </button>
                  )}
                </div>
                <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:inline-flex">
                  <kbd className={kbd}>Ctrl</kbd>
                  <kbd className={kbd}>Enter</kbd>
                  <span className="ml-0.5 mr-2">to run</span>
                  <kbd className={kbd}>Ctrl</kbd>
                  <kbd className={kbd}>Space</kbd>
                  <span className="ml-0.5">to complete</span>
                </span>
                <button
                  onClick={handleEditorExecute}
                  disabled={!rawSQL.trim() || isExecuting}
                  className="btn-primary"
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden />
                  )}
                  {isExecuting
                    ? t('dashboard.queryPanel.running')
                    : t('dashboard.queryPanel.runQuery')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* What went wrong, and how to continue */}
        {error &&
          (() => {
            const lc = error.toLowerCase()
            const isAIRateLimit = lc.includes('ai service rate limit')
            // Primary source: our sql-validator.ts and the normalised AI path.
            // Safety net: catch any DML-related message that leaked through a
            // different code path (database-level rejection, streaming route, etc.)
            const isSecurityBlock =
              lc.includes('only select queries are allowed') ||
              lc.includes('read-only to protect') ||
              lc.includes('prohibited query') ||
              /cannot execute (delete|update|insert|drop|truncate|alter)/i.test(error) ||
              /only supports? select/i.test(error)

            if (isSecurityBlock) {
              return (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/[0.06] p-4 sm:p-5"
                >
                  <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-foreground">Read-only protection</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    <p className="mt-3 text-xs font-medium text-foreground/80">
                      Try asking it as a question:
                    </p>
                    <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                      <li>
                        Instead of <em>&quot;delete all customers&quot;</em>, try{' '}
                        <span className="font-medium text-foreground">
                          &quot;show me all customers&quot;
                        </span>
                      </li>
                      <li>
                        Instead of <em>&quot;update prices to 100&quot;</em>, try{' '}
                        <span className="font-medium text-foreground">
                          &quot;list products with their prices&quot;
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              )
            }

            return (
              <div
                role="alert"
                className={clsx(
                  'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5',
                  isAIRateLimit
                    ? 'border-warning/40 bg-warning/[0.06]'
                    : 'border-destructive/40 bg-destructive/[0.05]'
                )}
              >
                <div className="flex items-start gap-3">
                  {isAIRateLimit ? (
                    <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" aria-hidden />
                  ) : (
                    <XCircle
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-foreground">
                      {isAIRateLimit ? 'The AI service is busy' : t('common.error')}
                    </h4>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{error}</p>
                    {isAIRateLimit && (
                      <>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          While you wait, switch to <strong>SQL</strong> above to run queries
                          yourself.
                        </p>
                        {retryCountdown !== null && (
                          <div className="mt-2 flex items-center gap-2">
                            {retryCountdown > 0 ? (
                              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" aria-hidden />
                                Ready to retry in {retryCountdown}s
                              </span>
                            ) : (
                              <button
                                onClick={onGenerateSQL}
                                className="btn-secondary px-2.5 py-1 text-xs"
                              >
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                                Retry now
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {onFixQuery && !isAIRateLimit && !!generatedSQL && (
                  <button
                    onClick={onFixQuery}
                    disabled={isFixing}
                    className="btn-secondary flex-shrink-0 self-start whitespace-nowrap"
                  >
                    {isFixing ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Wand2 className="h-4 w-4" aria-hidden />
                    )}
                    {t('dashboard.queryPanel.aiFixIt')}
                  </button>
                )}
              </div>
            )
          })()}

        {/* 02 · The SQL NatureQuery wrote */}
        {generatedSQL && (
          <section aria-labelledby="step-sql" className="animate-fadeIn">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <StepLabel step="02" id="step-sql">
                {t('dashboard.queryPanel.stepWrites')}
              </StepLabel>
              <div className="flex flex-wrap items-center gap-0.5">
                <button
                  onClick={() => {
                    if (saveState !== 'idle') return
                    const name = nlQuery.slice(0, 50) || 'Untitled Query'
                    saveWithFeedback(setSaveState, name, nlQuery, generatedSQL)
                  }}
                  disabled={saveState !== 'idle'}
                  className={textAction}
                >
                  {saveState === 'saving' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : saveState === 'saved' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {saveState === 'saving'
                    ? 'Saving...'
                    : saveState === 'saved'
                      ? 'Saved'
                      : t('common.save')}
                </button>
                {onSQLChange && (
                  <button
                    onClick={() => {
                      const next = formatted(generatedSQL)
                      if (next) onSQLChange(next)
                    }}
                    className={textAction}
                  >
                    <AlignLeft className="h-3.5 w-3.5" aria-hidden />
                    {t('dashboard.queryPanel.format')}
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (templateState !== 'idle') return
                    const name = nlQuery.slice(0, 50) || 'Custom Template'
                    setTemplateState('saving')
                    const result = await saveAsTemplate({
                      name,
                      question: nlQuery,
                      sql: generatedSQL,
                      category: 'custom',
                    })
                    if (result.success) {
                      setTemplateState('saved')
                      setTimeout(() => setTemplateState('idle'), 2000)
                    } else {
                      toast.error('Failed to save template', { description: result.error })
                      setTemplateState('idle')
                    }
                  }}
                  disabled={templateState !== 'idle'}
                  className={textAction}
                  title="Save as reusable template"
                >
                  {templateState === 'saving' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : templateState === 'saved' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {templateState === 'saving'
                    ? 'Saving...'
                    : templateState === 'saved'
                      ? 'Saved'
                      : t('dashboard.queryPanel.template')}
                </button>
                <button onClick={handleExplain} disabled={isExplaining} className={textAction}>
                  {isExplaining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isExplaining
                    ? t('dashboard.queryPanel.explaining')
                    : explanation
                      ? t('dashboard.queryPanel.reExplain')
                      : t('dashboard.queryPanel.explainQuery')}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="overflow-x-auto px-5 py-4 sm:px-6 sm:py-5">
                <SQLExplainOverlay sql={generatedSQL} />
              </div>
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
                  {t('dashboard.queryPanel.checkedReadOnly')}
                </p>
                <button
                  onClick={() => onExecuteSQL()}
                  disabled={isExecuting}
                  className="btn-primary w-full sm:w-auto"
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden />
                  )}
                  {isExecuting
                    ? t('dashboard.queryPanel.running')
                    : t('dashboard.queryPanel.runQuery')}
                </button>
              </div>
            </div>

            {explanation && (
              <div className="mt-4 rounded-lg border border-border bg-secondary/50 px-5 py-4">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {t('dashboard.queryPanel.whatQueryDoes')}
                </p>
                <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {explanation}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Waiting for the database */}
        {isExecuting && !queryResults && (
          <div role="status" aria-label={t('dashboard.queryPanel.running')} className="space-y-3">
            <div className="h-3 w-32 rounded skeleton-shine" />
            <div className="space-y-2.5 rounded-lg border border-border bg-card p-4">
              {[100, 94, 97, 90, 84].map((width) => (
                <div
                  key={width}
                  className="h-6 rounded skeleton-shine"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 03 · The answer */}
        {queryResults && (
          <section
            key={queryResults.rowCount + '-' + queryResults.executionTime}
            aria-labelledby="step-answer"
            className="animate-fadeIn"
          >
            <StepLabel step="03" id="step-answer">
              {t('dashboard.queryPanel.stepAnswer')}
            </StepLabel>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
              <div
                role="tablist"
                aria-label={t('dashboard.queryPanel.results')}
                className="-mb-px flex"
              >
                {views.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={resultsView === id}
                    onClick={() => {
                      setResultsView(id)
                      if (id === 'insights' && !insights && onAnalyze) onAnalyze()
                    }}
                    className={clsx(
                      'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                      resultsView === id
                        ? 'border-foreground font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-0.5 pb-1.5">
                {queryResults.rows.length > 0 && (
                  <>
                    <button
                      onClick={setCurrentAsReportA}
                      className={textAction}
                      title={
                        investigationBaseline
                          ? 'Replace the saved Report A'
                          : 'Use this result as Report A'
                      }
                    >
                      <CopyPlus className="h-4 w-4" aria-hidden />
                      <span className="hidden xl:inline">
                        {investigationBaseline ? 'Replace A' : 'Set as Report A'}
                      </span>
                    </button>
                    {investigationBaseline && (
                      <button
                        onClick={compareCurrentWithReportA}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-secondary"
                        title={`Compare this result with ${investigationBaseline.name}`}
                      >
                        <Scale className="h-4 w-4" aria-hidden />
                        <span className="hidden lg:inline">Compare with A</span>
                      </button>
                    )}
                  </>
                )}
                {onPinToDashboard && queryResults.rows.length > 0 && (
                  <button
                    onClick={() =>
                      onPinToDashboard(
                        nlQuery,
                        generatedSQL,
                        queryResults.rows,
                        queryResults.fields
                      )
                    }
                    className={iconAction}
                    title={t('dashboard.queryPanel.pinToDashboard')}
                    aria-label={t('dashboard.queryPanel.pinToDashboard')}
                  >
                    <Pin className="h-4 w-4" aria-hidden />
                  </button>
                )}
                {onScheduleQuery && (
                  <button
                    onClick={() => onScheduleQuery(nlQuery, generatedSQL)}
                    className={iconAction}
                    title={t('dashboard.queryPanel.scheduleQuery')}
                    aria-label={t('dashboard.queryPanel.scheduleQuery')}
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => onToggleExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    aria-label="Export results"
                    title="Export results"
                    aria-expanded={showExportMenu}
                    aria-controls="results-export-options"
                    className={iconAction}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  {showExportMenu && (
                    <div
                      id="results-export-options"
                      className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover py-1 shadow-[0_16px_40px_-20px_hsl(var(--foreground)/0.45)] animate-fadeIn"
                    >
                      <button
                        onClick={() => onExport('excel')}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {t('dashboard.queryPanel.excelFile')}
                      </button>
                      <button
                        onClick={() => onExport('csv')}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {t('dashboard.queryPanel.csvFile')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              {/* Plain-English filters for the table */}
              {onAddFilter && generatedSQL && resultsView === 'table' && (
                <div className="mb-3">
                  <NLFilterBar
                    filters={activeFilters || []}
                    isApplying={isApplyingFilter || false}
                    onAddFilter={onAddFilter}
                    onRemoveFilter={onRemoveFilter || (() => {})}
                    onClearAll={onClearFilters || (() => {})}
                  />
                </div>
              )}

              {resultsView === 'table' && (
                <ResultsTable
                  rows={queryResults.rows}
                  fields={queryResults.fields}
                  rowCount={queryResults.rowCount}
                  executionTime={queryResults.executionTime}
                />
              )}
              {resultsView === 'chart' && (
                <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                  <ResultsChart
                    rows={queryResults.rows}
                    fields={queryResults.fields}
                    recommendation={queryResults.chartRecommendation}
                  />
                </div>
              )}
              {resultsView === 'insights' && (
                <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                  <DataInsights
                    insights={insights}
                    isLoading={isAnalyzing}
                    onFollowUpClick={onFollowUpClick}
                  />
                </div>
              )}
              {resultsView === 'performance' && (
                <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                  <QueryPerformancePanel
                    sql={generatedSQL}
                    schema={activeConnection?.schema ?? { tables: [] }}
                    executionTimeMs={queryResults.executionTime}
                    rowCount={queryResults.rowCount}
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

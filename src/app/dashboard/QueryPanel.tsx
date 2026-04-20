'use client'

import { type Ref, type RefObject, useState, lazy, Suspense } from 'react'
import {
  Play,
  Brain,
  Download,
  Sparkles,
  Terminal,
  CheckCircle2,
  Loader2,
  XCircle,
  FileSpreadsheet,
  FileText,
  Table2,
  ChevronDown,
  BarChart3,
  Bookmark,
  Pin,
  Clock,
  Zap,
  Database,
  Wand2,
  ToggleLeft,
  ToggleRight,
  AlignLeft,
  LayoutTemplate,
  MessageSquare,
  RotateCcw,
  Gauge,
  Code2,
} from 'lucide-react'
import { StreamingQueryPanel } from '@/components/StreamingQueryPanel'
import { NLFilterBar, type ActiveFilter } from '@/components/NLFilterBar'
import { SQLExplainOverlay } from '@/components/SQLExplainOverlay'
import { QueryPerformancePanel } from '@/components/QueryPerformancePanel'
import { SQLEditor } from '@/components/SQLEditor'
import { clsx } from 'clsx'
import { GlowCard } from '@/components/GlowCard'
import ResultsTable from '@/components/ResultsTable'
import { ResultsChart } from '@/components/ResultsChart'
import { DataInsights } from '@/components/DataInsights'
import { explainSQL } from '@/actions/ai'
import { format as formatSQL } from 'sql-formatter'
import { saveAsTemplate } from '@/actions/queries'
import { toast } from 'sonner'
import { QueryResultRow } from '@/actions/db'
import { SavedConnection, QueryResults, ChartRecommendation } from './types'
import type { InsightResult } from '@/actions/insights'
import type { QueryHistoryItem, SavedQueryItem } from '@/actions/queries'
import { useTranslation } from '@/contexts/LocaleContext'
import { SmartQueryInput } from './SmartQueryInput'
import { useTheme } from '@/components/ThemeProvider'

type ResultsView = 'table' | 'chart' | 'insights' | 'performance'

interface QueryPanelProps {
  isLoading?: boolean
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
  onSaveQuery: (name: string, question: string, sql: string) => void
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

export function QueryPanel({
  isLoading,
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
  onStreamingSQL,
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
  conversationContext,
  onClearConversation,
  activeFilters,
  isApplyingFilter,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  onPlanLimitReached,
}: QueryPanelProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [resultsView, setResultsView] = useState<ResultsView>('table')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [inputMode, setInputMode] = useState<'ai' | 'sql'>('ai')
  const [rawSQL, setRawSQL] = useState('')

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

  // Loading state — waiting for local storage/hydration
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">Loading workspace...</p>
      </div>
    )
  }

  // Empty state — no connection selected
  if (!activeConnection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-2xl w-full">
          <div className="card rounded-2xl p-10 md:p-14 text-center border border-border/50 shadow-2xl relative overflow-hidden group">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Database className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">{t('dashboard.queryPanel.connectDatabase')}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('dashboard.queryPanel.connectDescription')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={onAddConnection} className="btn-gradient px-6 py-3">
                <Database className="w-4 h-4" />
                {t('dashboard.queryPanel.addConnection')}
              </button>
              <button onClick={onAddDemoConnection} className="btn-secondary px-6 py-3">
                <Sparkles className="w-4 h-4" />
                {t('dashboard.queryPanel.tryDemo')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto px-6 pb-6 pt-2">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Natural Language Input */}
        <GlowCard className="pt-5 pb-7 px-7 lg:pt-6 lg:pb-10 lg:px-10 animate-fadeIn">
          {/* Mode Toggle: Ask AI / SQL Editor */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => setInputMode('ai')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                inputMode === 'ai'
                  ? 'bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Sparkles className="w-4 h-4" />
              {t('dashboard.queryPanel.askAi')}
            </button>
            <button
              onClick={() => {
                setInputMode('sql')
                // Pre-load existing generated SQL into the editor
                if (generatedSQL && !rawSQL) setRawSQL(generatedSQL)
              }}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                inputMode === 'sql'
                  ? 'bg-gradient-to-r from-accent to-primary text-white shadow-md shadow-accent/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Code2 className="w-4 h-4" />
              {t('dashboard.queryPanel.sqlEditor')}
            </button>
          </div>

          {/* AI Input Mode */}
          {inputMode === 'ai' && (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{t('dashboard.queryPanel.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.queryPanel.describeData')}
                  </p>
                </div>
              </div>

              {/* Conversation context indicator */}
              {conversationLength && conversationLength > 0 ? (
                <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    {t('dashboard.queryPanel.conversation')}: {conversationLength}{' '}
                    {conversationLength === 1
                      ? t('dashboard.queryPanel.conversationExchange')
                      : t('dashboard.queryPanel.conversationExchanges')}
                  </span>
                  <button
                    onClick={onClearConversation}
                    className="ml-auto text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t('common.clear')}
                  </button>
                </div>
              ) : null}

              {/* Smart Query Input with autocomplete */}
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

              {/* Schema discovery suggestions */}
              {schemaSuggestions && (
                <div className="mt-3 p-3 bg-accent/5 border border-accent/10 rounded-lg">
                  <p className="text-xs font-medium text-accent mb-2 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" />
                    {isDiscovering
                      ? t('dashboard.queryPanel.analyzingSchema')
                      : t('dashboard.queryPanel.schemaInsights')}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">{schemaSuggestions.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {schemaSuggestions.suggestions.slice(0, 4).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => onNlQueryChange(s)}
                        className="text-[11px] px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-full transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onGenerateSQL}
                    disabled={!activeConnection || !nlQuery.trim() || isGenerating}
                    className={clsx(
                      'btn-gradient relative overflow-hidden transition-all duration-300 text-sm py-2 px-4',
                      isGenerating && 'min-w-[180px] scale-[1.02]'
                    )}
                  >
                    {isGenerating ? (
                      <>
                        {/* Animated gradient shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="flex items-center gap-1 z-10 relative">
                          {t('dashboard.queryPanel.generating') || 'Generating SQL'}
                          <span className="flex gap-0.5">
                            <span
                              className="w-1 h-1 bg-white rounded-full animate-bounce"
                              style={{ animationDelay: '0ms' }}
                            />
                            <span
                              className="w-1 h-1 bg-white rounded-full animate-bounce"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="w-1 h-1 bg-white rounded-full animate-bounce"
                              style={{ animationDelay: '300ms' }}
                            />
                          </span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {t('dashboard.queryPanel.generateButton')}
                      </>
                    )}
                  </button>
                </div>

                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Press{' '}
                  <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">
                    Ctrl
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">
                    Enter
                  </kbd>
                </span>
              </div>
            </>
          )}

          {/* SQL Editor Mode */}
          {inputMode === 'sql' && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
                  <Code2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{t('dashboard.queryPanel.sqlEditor')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.queryPanel.sqlEditorDescription')}
                  </p>
                </div>
              </div>

              <SQLEditor
                value={rawSQL}
                onChange={setRawSQL}
                onExecute={handleEditorExecute}
                schema={activeConnection?.schema}
                dbType={activeConnection?.dbType}
                isDark={resolvedTheme === 'dark'}
                height="280px"
              />

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleEditorExecute}
                    disabled={!rawSQL.trim() || isExecuting}
                    className="btn-success text-sm py-2 px-4 hover-scale"
                  >
                    {isExecuting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {isExecuting
                      ? t('dashboard.queryPanel.running')
                      : t('dashboard.queryPanel.runQuery')}
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const formatted = formatSQL(rawSQL, {
                          language: 'sql',
                          tabWidth: 2,
                          keywordCase: 'upper',
                        })
                        setRawSQL(formatted)
                      } catch {}
                    }}
                    disabled={!rawSQL.trim()}
                    className="btn-secondary text-sm py-2 px-3"
                  >
                    <AlignLeft className="w-4 h-4" />
                    {t('dashboard.queryPanel.format')}
                  </button>
                  {rawSQL.trim() && (
                    <button
                      onClick={() => {
                        const name = rawSQL.slice(0, 50).replace(/\n/g, ' ') || 'Custom Query'
                        onSaveQuery(name, '', rawSQL)
                      }}
                      className="btn-secondary text-sm py-2 px-3"
                    >
                      <Bookmark className="w-4 h-4" />
                      {t('common.save')}
                    </button>
                  )}
                </div>

                <span className="text-xs text-muted-foreground hidden sm:inline">
                  <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">
                    Ctrl
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">
                    Enter
                  </kbd>{' '}
                  to run &nbsp;·&nbsp;
                  <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">
                    Ctrl
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">
                    Space
                  </kbd>{' '}
                  for autocomplete
                </span>
              </div>
            </>
          )}
        </GlowCard>

        {/* Error Message */}
        {error &&
          (() => {
            const isGroqLimit = error.toLowerCase().includes('groq api rate limit')
            return (
              <div
                className={`border rounded-xl p-4 flex items-start justify-between gap-3 animate-slideUp ${isGroqLimit ? 'bg-amber-500/10 border-amber-500/30' : 'bg-destructive/10 border-destructive/30'}`}
              >
                <div className="flex items-start gap-3">
                  {isGroqLimit ? (
                    <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4
                      className={`font-medium ${isGroqLimit ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'}`}
                    >
                      {isGroqLimit ? 'Groq API Limit (External Service)' : t('common.error')}
                    </h4>
                    <p
                      className={`text-sm mt-1 ${isGroqLimit ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-destructive/80'}`}
                    >
                      {error}
                    </p>
                    {isGroqLimit && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        This is Groq&apos;s server-side limit, not ours. Use the{' '}
                        <strong>SQL Editor</strong> tab to run queries directly while waiting.
                      </p>
                    )}
                  </div>
                </div>
                {/* Never show AI Fix It for Groq rate limit errors — it would immediately fail again */}
                {onFixQuery && !isGroqLimit && (
                  <button
                    onClick={onFixQuery}
                    disabled={isFixing}
                    className="btn-secondary whitespace-nowrap text-sm bg-background border-destructive/20 hover:bg-destructive/10 text-destructive flex items-center gap-2"
                  >
                    {isFixing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {t('dashboard.queryPanel.aiFixIt')}
                  </button>
                )}
              </div>
            )
          })()}

        {/* SQL Preview */}
        {generatedSQL && (
          <div className="card p-5 animate-slideUp">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-md">
                  <Terminal className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('dashboard.queryPanel.generatedSql')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('dashboard.queryPanel.readyToExecute')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onExecuteSQL()}
                disabled={isExecuting}
                className="btn-success text-sm py-1.5 hover-scale"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isExecuting
                  ? t('dashboard.queryPanel.running')
                  : t('dashboard.queryPanel.runQuery')}
              </button>
            </div>

            <div className="code-block">
              <SQLExplainOverlay sql={generatedSQL} />
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>{t('dashboard.queryPanel.validated')}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const name = nlQuery.slice(0, 50) || 'Untitled Query'
                    onSaveQuery(name, nlQuery, generatedSQL)
                  }}
                  className="text-xs text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors"
                >
                  <Bookmark className="w-3 h-3" />
                  {t('common.save')}
                </button>
                {onSQLChange && (
                  <button
                    onClick={() => {
                      try {
                        const formatted = formatSQL(generatedSQL, {
                          language: 'sql',
                          tabWidth: 2,
                          keywordCase: 'upper',
                        })
                        onSQLChange(formatted)
                      } catch {}
                    }}
                    className="text-xs text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors"
                  >
                    <AlignLeft className="w-3 h-3" />
                    {t('dashboard.queryPanel.format')}
                  </button>
                )}
                <button
                  onClick={async () => {
                    const name = nlQuery.slice(0, 50) || 'Custom Template'
                    const result = await saveAsTemplate({
                      name,
                      question: nlQuery,
                      sql: generatedSQL,
                      category: 'custom',
                    })
                    if (result.success) {
                      toast.success('Template saved')
                    } else {
                      toast.error('Failed to save template', { description: result.error })
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-accent font-medium flex items-center gap-1 transition-colors"
                  title="Save as reusable template"
                >
                  <LayoutTemplate className="w-3 h-3" />
                  {t('dashboard.queryPanel.template')}
                </button>
                <button
                  onClick={handleExplain}
                  disabled={isExplaining}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                >
                  {isExplaining ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isExplaining
                    ? t('dashboard.queryPanel.explaining')
                    : explanation
                      ? t('dashboard.queryPanel.reExplain')
                      : t('dashboard.queryPanel.explainQuery')}
                </button>
              </div>
            </div>

            {explanation && (
              <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                <p className="text-xs font-medium text-primary mb-1.5">
                  {t('dashboard.queryPanel.whatQueryDoes')}
                </p>
                <div className="text-sm text-foreground/80 whitespace-pre-line">{explanation}</div>
              </div>
            )}
          </div>
        )}

        {/* Loading Skeleton */}
        {isExecuting && !queryResults && (
          <div className="card p-5 animate-pulse border-primary/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg skeleton-shine"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 skeleton-shine rounded"></div>
                <div className="h-3 w-24 skeleton-shine rounded"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-8 w-full skeleton-shine rounded-md"></div>
              <div className="h-8 w-full skeleton-shine rounded-md opacity-80"></div>
              <div className="h-8 w-full skeleton-shine rounded-md opacity-60"></div>
              <div className="h-8 w-full skeleton-shine rounded-md opacity-40"></div>
              <div className="h-8 w-full skeleton-shine rounded-md opacity-20"></div>
            </div>
          </div>
        )}

        {/* Query Results */}
        {queryResults && (
          <GlowCard
            key={queryResults.rowCount + '-' + queryResults.executionTime}
            className="p-5 animate-slideUp"
          >
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-success to-primary flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('dashboard.queryPanel.results')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {queryResults.rowCount} {t('common.rows')} &bull; {queryResults.executionTime}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* View Toggle */}
                <button
                  onClick={() => setResultsView('table')}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    resultsView === 'table'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  title="Table view"
                >
                  <Table2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setResultsView('chart')}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    resultsView === 'chart'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  title="Chart view"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setResultsView('insights')
                    if (!insights && onAnalyze) onAnalyze()
                  }}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    resultsView === 'insights'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  title="AI Insights"
                >
                  <Brain className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setResultsView('performance')}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    resultsView === 'performance'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  title="Performance"
                >
                  <Gauge className="w-4 h-4" />
                </button>

                {/* Actions */}
                <div className="w-px h-5 bg-border mx-1" />
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
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                    title="Pin to dashboard"
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                )}
                {onScheduleQuery && (
                  <button
                    onClick={() => onScheduleQuery(nlQuery, generatedSQL)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                    title="Schedule this query"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                )}

                {/* Export */}
                <div className="relative">
                  <button
                    onClick={() => onToggleExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  {showExportMenu && (
                    <div className="absolute top-full right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg py-1 z-10 animate-scaleIn">
                      <button
                        onClick={() => onExport('excel')}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-success" />
                        {t('dashboard.queryPanel.excelFile')}
                      </button>
                      <button
                        onClick={() => onExport('csv')}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-primary" />
                        {t('dashboard.queryPanel.csvFile')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* NL Filter Bar */}
            {onAddFilter && generatedSQL && resultsView === 'table' && (
              <NLFilterBar
                filters={activeFilters || []}
                isApplying={isApplyingFilter || false}
                onAddFilter={onAddFilter}
                onRemoveFilter={onRemoveFilter || (() => {})}
                onClearAll={onClearFilters || (() => {})}
              />
            )}

            {/* Results Content */}
            {resultsView === 'table' && (
              <ResultsTable
                rows={queryResults.rows}
                fields={queryResults.fields}
                rowCount={queryResults.rowCount}
                executionTime={queryResults.executionTime}
              />
            )}
            {resultsView === 'chart' && (
              <ResultsChart
                rows={queryResults.rows}
                fields={queryResults.fields}
                recommendation={queryResults.chartRecommendation}
              />
            )}
            {resultsView === 'insights' && (
              <DataInsights
                insights={insights}
                isLoading={isAnalyzing}
                onFollowUpClick={onFollowUpClick}
              />
            )}
            {resultsView === 'performance' && (
              <QueryPerformancePanel
                sql={generatedSQL}
                schema={activeConnection?.schema!}
                executionTimeMs={queryResults.executionTime}
                rowCount={queryResults.rowCount}
              />
            )}
          </GlowCard>
        )}
      </div>
    </div>
  )
}

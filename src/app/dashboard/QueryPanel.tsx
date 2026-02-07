'use client'

import { type Ref, useState } from 'react'
import {
  Play,
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
} from 'lucide-react'
import { clsx } from 'clsx'
import ResultsTable from '@/components/ResultsTable'
import { ResultsChart } from '@/components/ResultsChart'
import { explainSQL } from '@/actions/ai'
import { SavedConnection, QueryResults } from './types'

type ResultsView = 'table' | 'chart'

interface QueryPanelProps {
  activeConnection: SavedConnection | undefined
  nlQuery: string
  onNlQueryChange: (query: string) => void
  generatedSQL: string
  isGenerating: boolean
  isExecuting: boolean
  isExporting: boolean
  queryResults: QueryResults | null
  error: string | null
  showExportMenu: boolean
  onToggleExportMenu: (show: boolean) => void
  onGenerateSQL: () => void
  onExecuteSQL: () => void
  onExport: (format: 'excel' | 'csv') => void
  onSaveQuery: (name: string, question: string, sql: string) => void
  queryInputRef: Ref<HTMLTextAreaElement>
}

export function QueryPanel({
  activeConnection,
  nlQuery,
  onNlQueryChange,
  generatedSQL,
  isGenerating,
  isExecuting,
  isExporting,
  queryResults,
  error,
  showExportMenu,
  onToggleExportMenu,
  onGenerateSQL,
  onExecuteSQL,
  onExport,
  onSaveQuery,
  queryInputRef,
}: QueryPanelProps) {
  const [resultsView, setResultsView] = useState<ResultsView>('table')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)

  const handleExplain = async () => {
    if (!generatedSQL || isExplaining) return
    setIsExplaining(true)
    const result = await explainSQL(generatedSQL)
    setIsExplaining(false)
    if (result.success && result.explanation) {
      setExplanation(result.explanation)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Natural Language Input */}
        <div className="card p-5 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold">Ask a Question</h3>
          </div>

          <textarea
            ref={queryInputRef}
            value={nlQuery}
            onChange={(e) => onNlQueryChange(e.target.value)}
            placeholder={
              activeConnection
                ? 'Describe what data you want in plain English...\n\nExamples:\n- Show me all customers from New York\n- What are the top 5 products by sales?\n- Find orders placed in the last 30 days'
                : 'Connect to a database to start querying...'
            }
            className="w-full h-32 p-4 bg-secondary/50 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground transition-all"
            disabled={!activeConnection}
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={onGenerateSQL}
                disabled={!activeConnection || !nlQuery.trim() || isGenerating}
                className="btn-primary"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isGenerating ? 'Generating...' : 'Generate SQL'}
              </button>

              <div className="relative">
                <button
                  onClick={() => onToggleExportMenu(!showExportMenu)}
                  disabled={!queryResults || isExporting}
                  className="btn-secondary"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </button>

                {showExportMenu && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg py-1 z-10 animate-scaleIn">
                    <button
                      onClick={() => onExport('excel')}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-success" />
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => onExport('csv')}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                      CSV (.csv)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <span className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-xs">Enter</kbd> to generate
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3 animate-slideUp">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-destructive">Error</h4>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* SQL Preview */}
        {generatedSQL && (
          <div className="card p-5 animate-slideUp">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-semibold">Generated SQL</h3>
              </div>
              <button
                onClick={onExecuteSQL}
                disabled={isExecuting}
                className="btn-success text-sm py-1.5"
              >
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isExecuting ? 'Running...' : 'Run Query'}
              </button>
            </div>

            <div className="code-block">
              <pre className="text-foreground whitespace-pre-wrap">{generatedSQL}</pre>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>Validated: SELECT-only query, safe to execute</span>
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
                  Save
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
                  {isExplaining ? 'Explaining...' : explanation ? 'Re-explain' : 'Explain Query'}
                </button>
              </div>
            </div>

            {explanation && (
              <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                <p className="text-xs font-medium text-primary mb-1.5">What this query does:</p>
                <div className="text-sm text-foreground/80 whitespace-pre-line">{explanation}</div>
              </div>
            )}
          </div>
        )}

        {/* Query Results */}
        {queryResults && (
          <div className="card p-5 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Table2 className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Results</h3>
                  <p className="text-xs text-muted-foreground">
                    {queryResults.rowCount} rows in {queryResults.executionTime}ms
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Table / Chart toggle */}
                <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                  <button
                    onClick={() => setResultsView('table')}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      resultsView === 'table'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    Table
                  </button>
                  <button
                    onClick={() => setResultsView('chart')}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      resultsView === 'chart'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Chart
                  </button>
                </div>
                <button
                  onClick={() => onExport('excel')}
                  disabled={isExporting}
                  className="btn-primary text-sm py-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download Excel
                </button>
              </div>
            </div>

            {resultsView === 'table' ? (
              <ResultsTable
                rows={queryResults.rows}
                fields={queryResults.fields}
                rowCount={queryResults.rowCount}
                executionTime={queryResults.executionTime}
              />
            ) : (
              <ResultsChart
                rows={queryResults.rows}
                fields={queryResults.fields}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

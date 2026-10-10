import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import {
  BarChart3,
  Ban,
  BookOpenText,
  ClipboardCopy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Play,
  Sparkles,
  Table2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import ResultsTable from '@web/components/ResultsTable'
import { ResultsChart } from '@web/components/ResultsChart'
import {
  Button,
  EmptyState,
  ErrorNotice,
  IconButton,
  Kbd,
  Menu,
  Segmented,
  Spinner,
  modKey,
} from '../../components/ui'
import { formatCount, formatDuration, plural } from '../../lib/format'
import { api } from '../../lib/nq'
import { toTableData, toTsv } from '../../lib/results'
import {
  cancelTab,
  setResultView,
  setView,
  useApp,
  type AiReportDraft,
  type QueryTab,
} from '../../store/app-store'
import {
  dismissExplanation,
  dismissInsights,
  fixTab,
  lastQuestionOf,
  summarizeTab,
} from '../../store/assistant'
import { ReportAiButton } from './ReportAiButton'

/** Errors the AI can usually fix: mistakes in the query, not connection problems. */
function fixable(tab: QueryTab): boolean {
  const error = tab.error
  if (!error || !tab.sql.trim()) return false
  if (error.code === 'DATABASE_ERROR') return true
  return error.code === 'VALIDATION' && !/read-only|not allowed|blocked/i.test(error.message)
}

function bullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

function AiCard({
  icon,
  title,
  report,
  onClose,
  children,
}: {
  icon: ReactNode
  title: string
  /** The finished answer, which can be reported. */
  report?: AiReportDraft
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="selectable mx-3 mt-2.5 shrink-0 rounded-lg border border-primary/25 bg-primary/[0.05] px-3 py-2.5 text-[12.5px]">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="flex-1 font-medium">{title}</span>
        {report && <ReportAiButton draft={report} className="h-6 w-6" />}
        <IconButton label="Close" onClick={onClose} className="h-6 w-6">
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

/** Whether an element is at least `width` pixels wide, updated as it resizes. */
function useWiderThan(ref: React.RefObject<HTMLElement>, width: number): boolean {
  const [wider, setWider] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWider(entry.contentRect.width >= width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, width])
  return wider
}

function AiPanels({ tab, beside }: { tab: QueryTab; beside: boolean }) {
  const { explanation, insights } = tab
  if (!explanation && !insights) return null
  // Beside the result when there is room, otherwise above it, so the rows stay in view.
  return (
    <div
      className={clsx(
        'overflow-y-auto pb-2.5',
        beside ? 'order-last w-[340px] shrink-0 border-l border-border/70' : 'max-h-[38%] shrink-0'
      )}
    >
      {explanation && (
        <AiCard
          icon={<BookOpenText className="h-4 w-4" />}
          title="What this query does"
          report={
            explanation.status === 'ready'
              ? { kind: 'explanation', question: explanation.forSql, content: explanation.text }
              : undefined
          }
          onClose={() => dismissExplanation(tab.id)}
        >
          {explanation.status === 'loading' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" /> Reading the query…
            </p>
          )}
          {explanation.status === 'error' && <ErrorNotice error={explanation.error} compact />}
          {explanation.status === 'ready' && (
            <>
              <ul className="list-disc space-y-1 pl-5">
                {bullets(explanation.text).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {explanation.forSql !== tab.sql.trim() && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  The query has changed since this explanation.
                </p>
              )}
            </>
          )}
        </AiCard>
      )}
      {insights && (
        <AiCard
          icon={<Lightbulb className="h-4 w-4" />}
          title="Summary"
          report={
            insights.status === 'ready'
              ? {
                  kind: 'summary',
                  question: lastQuestionOf(tab) || tab.sql,
                  content: [
                    insights.summary,
                    ...insights.highlights.map((line) => `- ${line}`),
                  ].join('\n'),
                }
              : undefined
          }
          onClose={() => dismissInsights(tab.id)}
        >
          {insights.status === 'loading' && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="h-3.5 w-3.5" /> Summarizing the result…
            </p>
          )}
          {insights.status === 'error' && <ErrorNotice error={insights.error} compact />}
          {insights.status === 'ready' && (
            <>
              <p>{insights.summary}</p>
              {insights.highlights.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {insights.highlights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {!insights.usedRows && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  Based on the question and column names only. To include result values,{' '}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => setView('settings')}
                  >
                    allow AI summaries to use result rows
                  </button>
                  .
                </p>
              )}
            </>
          )}
        </AiCard>
      )}
    </div>
  )
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [])
  return <span className="tabular">{formatDuration(now - since)}</span>
}

export function ResultsPanel({ tab }: { tab: QueryTab }) {
  const rowLimit = useApp((state) => state.settings.rowLimit)
  const body = useRef<HTMLDivElement>(null)
  const wide = useWiderThan(body, 900)
  const result = tab.status === 'success' ? tab.result : undefined
  const table = useMemo(() => (result ? toTableData(result) : null), [result])

  const exportAs = async (format: 'csv' | 'xlsx' | 'json') => {
    if (!result) return
    try {
      const outcome = await api.files.exportResult({
        format,
        columns: table!.fields,
        rows: result.rows,
        suggestedName: `${tab.title} ${new Date().toISOString().slice(0, 10)}`,
      })
      if (outcome.saved) toast.success('Results exported', { description: outcome.path })
    } catch (error) {
      toast.error((error as Error).message, { description: (error as { hint?: string }).hint })
    }
  }

  const copyAll = async () => {
    if (!result || !table) return
    await api.clipboard.write(toTsv(table.fields, result.rows))
    toast.success(`Copied ${plural(result.rows.length, 'row')}`, {
      description: 'Paste into Excel or Google Sheets.',
    })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Results">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border/70 px-3">
        <Segmented
          size="sm"
          label="Result view"
          value={tab.resultView}
          onChange={(view) => setResultView(tab.id, view)}
          options={[
            { value: 'table', label: 'Table', icon: <Table2 className="h-3.5 w-3.5" /> },
            { value: 'chart', label: 'Chart', icon: <BarChart3 className="h-3.5 w-3.5" /> },
          ]}
        />
        {result && (
          <span className="truncate text-[12px] tabular text-muted-foreground">
            {plural(result.rowCount, 'row')} · {formatDuration(result.durationMs)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {result && result.rows.length > 0 && (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => void summarizeTab(tab.id)}
                disabled={tab.insights?.status === 'loading'}
                title="Summarize this result in plain English"
              >
                Summarize
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<ClipboardCopy className="h-3.5 w-3.5" />}
                onClick={() => void copyAll()}
              >
                Copy
              </Button>
              <Menu
                label="Export"
                trigger={(props) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download className="h-3.5 w-3.5" />}
                    {...props}
                  >
                    Export
                  </Button>
                )}
                items={[
                  {
                    label: 'Excel workbook (.xlsx)',
                    icon: <FileSpreadsheet className="h-4 w-4" />,
                    onSelect: () => void exportAs('xlsx'),
                  },
                  {
                    label: 'CSV file (.csv)',
                    icon: <FileText className="h-4 w-4" />,
                    onSelect: () => void exportAs('csv'),
                  },
                  {
                    label: 'JSON file (.json)',
                    icon: <FileJson className="h-4 w-4" />,
                    onSelect: () => void exportAs('json'),
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {result?.truncated && (
        <div className="flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-[12px]">
          <span>
            Showing the first {formatCount(rowLimit)} rows. Add filters or a LIMIT to narrow the
            result, or{' '}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setView('settings')}
            >
              raise the row limit
            </button>
            .
          </span>
        </div>
      )}

      <div ref={body} className={clsx('flex min-h-0 flex-1', wide ? 'flex-row' : 'flex-col')}>
        <AiPanels tab={tab} beside={wide} />

        <div className="relative min-h-0 min-w-0 flex-1">
          {tab.status === 'idle' &&
            (tab.mode === 'ask' ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="Ask a question to see results"
                description="NatureQuery writes the query, shows it above, and runs it on this computer."
                className="h-full"
              />
            ) : (
              <EmptyState
                icon={<Play className="h-5 w-5" />}
                title="Run a query to see results"
                description={
                  <span className="inline-flex items-center gap-1">
                    Press <Kbd>{modKey()}</Kbd> <Kbd>Enter</Kbd> in the editor.
                  </span>
                }
                className="h-full"
              />
            ))}
          {tab.status === 'running' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] text-muted-foreground">
              <Spinner className="h-5 w-5 text-primary" />
              <p>Running query… {tab.startedAt && <Elapsed since={tab.startedAt} />}</p>
              <Button
                size="sm"
                icon={<Ban className="h-3.5 w-3.5" />}
                onClick={() => void cancelTab(tab.id)}
              >
                Cancel
              </Button>
            </div>
          )}
          {tab.status === 'error' && tab.error && (
            <div className="h-full space-y-3 overflow-y-auto p-4">
              <ErrorNotice error={tab.error} />
              {fixable(tab) && (
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={
                      tab.assistant.status === 'fixing' ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )
                    }
                    disabled={tab.assistant.status !== 'idle'}
                    onClick={() => void fixTab(tab.id)}
                  >
                    {tab.assistant.status === 'fixing' ? 'Fixing…' : 'Fix with AI'}
                  </Button>
                  <span className="text-[12px] text-muted-foreground">
                    NatureQuery suggests a corrected query and runs it. You can undo the change.
                  </span>
                </div>
              )}
              {tab.assistant.error && tab.mode !== 'ask' && (
                <ErrorNotice error={tab.assistant.error} compact />
              )}
            </div>
          )}
          {tab.status === 'canceled' && (
            <EmptyState
              icon={<Ban className="h-5 w-5" />}
              title="Query canceled"
              description="Run it again whenever you are ready."
              className="h-full"
            />
          )}
          {result &&
            table &&
            (result.rows.length === 0 ? (
              <EmptyState
                icon={<Table2 className="h-5 w-5" />}
                title="No rows returned"
                description={
                  result.columns.length
                    ? `The query ran successfully. Columns: ${result.columns.map((c) => c.name).join(', ')}.`
                    : 'The query ran successfully.'
                }
                className="h-full"
              />
            ) : tab.resultView === 'chart' ? (
              <div className="h-full overflow-auto p-4">
                <ResultsChart rows={table.rows} fields={table.fields} />
              </div>
            ) : (
              <div className="nq-results nq-results-fill h-full">
                <ResultsTable
                  rows={table.rows}
                  fields={table.fields}
                  rowCount={result.rowCount}
                  executionTime={result.durationMs}
                />
              </div>
            ))}
        </div>
      </div>
    </section>
  )
}

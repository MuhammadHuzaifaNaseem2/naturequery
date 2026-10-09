import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Ban,
  ClipboardCopy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Play,
  Table2,
} from 'lucide-react'
import { toast } from 'sonner'
import ResultsTable from '@web/components/ResultsTable'
import { ResultsChart } from '@web/components/ResultsChart'
import {
  Button,
  EmptyState,
  ErrorNotice,
  Kbd,
  Menu,
  Segmented,
  Spinner,
  modKey,
} from '../../components/ui'
import { formatCount, formatDuration, plural } from '../../lib/format'
import { api } from '../../lib/nq'
import { toTableData, toTsv } from '../../lib/results'
import { cancelTab, setResultView, setView, useApp, type QueryTab } from '../../store/app-store'

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

      <div className="relative min-h-0 flex-1">
        {tab.status === 'idle' && (
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
        )}
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
          <div className="h-full overflow-y-auto p-4">
            <ErrorNotice error={tab.error} />
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
    </section>
  )
}

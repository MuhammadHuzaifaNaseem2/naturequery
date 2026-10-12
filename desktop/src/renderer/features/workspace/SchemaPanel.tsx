import { memo, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  ChevronRight,
  Copy,
  Eye,
  KeyRound,
  Link,
  RefreshCw,
  Search,
  Table2,
  Columns3,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import type { TableInfo } from '@shared/types'
import { ErrorNotice, IconButton, Input, Spinner } from '../../components/ui'
import { PanelResizer, usePanelWidth } from '../../components/resizable'
import { formatCount } from '../../lib/format'
import { api } from '../../lib/nq'
import { previewQuery } from '../../lib/sql'
import { loadSchema, openTab, useApp, useConnection } from '../../store/app-store'

async function copy(text: string) {
  await api.clipboard.write(text)
  toast.success(`Copied ${text.length > 40 ? 'name' : text}`)
}

const TableRow = memo(function TableRow({
  table,
  expanded,
  onToggle,
  onPreview,
}: {
  table: TableInfo
  expanded: boolean
  onToggle: () => void
  onPreview: () => void
}) {
  return (
    <div>
      <div className="group flex h-7 items-center rounded-md pr-1 hover:bg-secondary/70">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-1 text-left"
          title={`${table.qualifiedName}${table.rowEstimate !== undefined ? `\nAbout ${formatCount(table.rowEstimate)} rows` : ''}`}
        >
          <ChevronRight
            className={clsx(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90'
            )}
          />
          {table.kind === 'view' ? (
            <Layers className="h-3.5 w-3.5 shrink-0 text-accent" />
          ) : (
            <Table2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate text-[12.5px]">{table.name}</span>
          {table.rowEstimate !== undefined && table.rowEstimate > 0 && (
            <span className="ml-auto shrink-0 pl-2 text-[10.5px] tabular text-muted-foreground group-hover:hidden">
              {formatCount(table.rowEstimate)}
            </span>
          )}
        </button>
        <div className="hidden shrink-0 items-center group-hover:flex group-focus-within:flex">
          <IconButton
            label={`Preview rows of ${table.name}`}
            onClick={onPreview}
            className="h-6 w-6"
          >
            <Eye className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Copy name"
            onClick={() => void copy(table.qualifiedName)}
            className="h-6 w-6"
          >
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
      {expanded && (
        <ul className="mb-1 ml-[22px] border-l border-border/70 pl-2">
          {table.columns.map((column) => {
            const fk = table.foreignKeys.find((key) => key.column === column.name)
            return (
              <li key={column.name}>
                <button
                  type="button"
                  onClick={() => void copy(column.name)}
                  title={`${column.name} · ${column.type}${column.nullable ? '' : ' · not null'}${fk ? `\nReferences ${fk.referencedTable}.${fk.referencedColumn}` : ''}\nClick to copy`}
                  className="flex h-6 w-full items-center gap-1.5 rounded px-1 text-left hover:bg-secondary/70"
                >
                  {column.isPrimaryKey ? (
                    <KeyRound className="h-3 w-3 shrink-0 text-warning" />
                  ) : fk ? (
                    <Link className="h-3 w-3 shrink-0 text-accent" />
                  ) : (
                    <Columns3 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="truncate text-[12px]">{column.name}</span>
                  <span className="ml-auto shrink-0 truncate pl-2 font-mono text-[10.5px] text-muted-foreground">
                    {column.type}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})

export function SchemaPanel({ connectionId }: { connectionId: string }) {
  const connection = useConnection(connectionId)
  const state = useApp((s) => s.schemas[connectionId])
  const panel = usePanelWidth('nq.schemaPanelWidth', 272, 200, 560)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const tables = state?.snapshot?.tables ?? []
  const term = filter.trim().toLowerCase()
  const groups = useMemo(() => {
    const visible = term
      ? tables.filter(
          (table) =>
            table.name.toLowerCase().includes(term) ||
            table.columns.some((column) => column.name.toLowerCase().includes(term))
        )
      : tables
    const bySchema = new Map<string, TableInfo[]>()
    for (const table of visible) {
      const key = table.schema ?? ''
      if (!bySchema.has(key)) bySchema.set(key, [])
      bySchema.get(key)!.push(table)
    }
    return [...bySchema.entries()]
  }, [tables, term])

  if (!connection) return null
  const multipleSchemas =
    groups.length > 1 ||
    (groups[0] && groups[0][0] && !['', 'public', 'dbo', 'main'].includes(groups[0][0]))

  return (
    <aside
      style={{ width: panel.width }}
      className="relative flex h-full shrink-0 flex-col border-r border-border/70 bg-card/30"
      aria-label="Tables"
    >
      <PanelResizer label="Resize the tables list" panel={panel} />
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border/70 pl-3 pr-1.5">
        <span className="flex-1 truncate text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tables
        </span>
        {state?.status === 'ready' && (
          <span className="text-[11px] tabular text-muted-foreground">
            {formatCount(tables.length)}
          </span>
        )}
        <IconButton
          label="Refresh tables"
          onClick={() => void loadSchema(connectionId, true)}
          disabled={state?.status === 'loading'}
        >
          <RefreshCw
            className={clsx('h-3.5 w-3.5', state?.status === 'loading' && 'animate-spin')}
          />
        </IconButton>
      </div>
      <div className="shrink-0 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-[7px] h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tables and columns"
            className="h-7 pl-7 text-[12px]"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {state?.status === 'loading' && !tables.length && (
          <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" /> Loading tables…
          </div>
        )}
        {state?.status === 'error' && state.error && (
          <div className="p-1.5">
            <ErrorNotice error={state.error} compact />
          </div>
        )}
        {state?.status === 'ready' && !tables.length && (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-muted-foreground">
            No tables are visible to this account. Check that the user has permission to read them.
          </p>
        )}
        {state?.status === 'ready' && tables.length > 0 && !groups.length && (
          <p className="px-2 py-3 text-[12px] text-muted-foreground">Nothing matches “{filter}”.</p>
        )}
        {groups.map(([schema, list]) => (
          <div key={schema || 'default'}>
            {multipleSchemas && (
              <div className="sticky top-0 z-10 bg-card/95 px-1.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                {schema || 'default'} <span className="font-normal">· {list.length}</span>
              </div>
            )}
            {list.map((table) => {
              const key = `${schema}.${table.name}`
              return (
                <TableRow
                  key={key}
                  table={table}
                  expanded={
                    !!expanded[key] ||
                    (!!term &&
                      table.columns.some((c) => c.name.toLowerCase().includes(term)) &&
                      !table.name.toLowerCase().includes(term))
                  }
                  onToggle={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}
                  onPreview={() =>
                    openTab(connectionId, {
                      sql: previewQuery(connection.type, table),
                      title: table.name,
                      run: true,
                    })
                  }
                />
              )
            })}
          </div>
        ))}
        {state?.snapshot?.truncated && (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">
            Showing the first 5,000 tables.
          </p>
        )}
      </div>
    </aside>
  )
}

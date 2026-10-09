import { useCallback, useEffect, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  Copy,
  History,
  Play,
  Search,
  SquareArrowOutUpRight,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { HistoryEntry } from '@shared/types'
import { Button, Dialog, EmptyState, IconButton, Input, Select, Spinner } from '../../components/ui'
import { formatDuration, formatRelativeTime, plural } from '../../lib/format'
import { api } from '../../lib/nq'
import { findConnection, openTab, useApp } from '../../store/app-store'

const PAGE = 100

export function HistoryView() {
  const connections = useApp((state) => state.connections)
  const sample = useApp((state) => state.sample)
  const [search, setSearch] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const load = useCallback(
    async (before?: string) => {
      const page = await api.history.list({
        search: search || undefined,
        connectionId: connectionId || undefined,
        limit: PAGE,
        before,
      })
      setEntries((current) => (before && current ? [...current, ...page] : page))
      setHasMore(page.length === PAGE)
    },
    [search, connectionId]
  )

  useEffect(() => {
    const timer = setTimeout(() => void load().catch(() => setEntries([])), 150)
    return () => clearTimeout(timer)
  }, [load])

  const remove = async (id: string) => {
    await api.history.remove(id)
    setEntries((current) => current?.filter((entry) => entry.id !== id) ?? null)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-6 py-4">
        <div className="mr-auto">
          <h1 className="text-[17px] font-semibold tracking-tight">History</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Every query you run is kept on this computer only.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries and questions"
            className="pl-8"
          />
        </div>
        <div className="w-52">
          <Select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            aria-label="Filter by connection"
          >
            <option value="">All connections</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
            {sample && <option value="sample">{sample.name}</option>}
          </Select>
        </div>
        <Button
          variant="ghost"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={() => setConfirmClear(true)}
          disabled={!entries?.length}
        >
          Clear
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {entries === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title={search || connectionId ? 'No matching queries' : 'No history yet'}
            description={
              search || connectionId
                ? 'Try a different search.'
                : 'Queries you run appear here, so you can find and rerun them later.'
            }
            className="py-20"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {entries.map((entry) => {
              const available = !!findConnection(entry.connectionId)
              return (
                <li
                  key={entry.id}
                  className="group flex items-start gap-3 px-6 py-3 hover:bg-secondary/30"
                >
                  <span className="mt-0.5">
                    {entry.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-label="Succeeded" />
                    ) : entry.status === 'canceled' ? (
                      <Ban className="h-4 w-4 text-muted-foreground" aria-label="Canceled" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" aria-label="Failed" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    {entry.question && (
                      <p className="mb-1 text-[13px] font-medium">{entry.question}</p>
                    )}
                    <pre className="selectable max-h-24 overflow-hidden whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground/85">
                      {entry.text}
                    </pre>
                    <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                      {entry.connectionName} · {formatRelativeTime(entry.createdAt)}
                      {entry.status === 'success' &&
                        entry.rowCount !== undefined &&
                        ` · ${plural(entry.rowCount, 'row')}`}
                      {entry.durationMs !== undefined && ` · ${formatDuration(entry.durationMs)}`}
                      {entry.error && <span className="text-destructive"> · {entry.error}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton
                      label="Open in a new tab"
                      disabled={!available}
                      onClick={() =>
                        openTab(entry.connectionId, { sql: entry.text, question: entry.question })
                      }
                    >
                      <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label="Run again"
                      disabled={!available}
                      onClick={() =>
                        openTab(entry.connectionId, {
                          sql: entry.text,
                          question: entry.question,
                          run: true,
                        })
                      }
                    >
                      <Play className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label="Copy query"
                      onClick={async () => {
                        await api.clipboard.write(entry.text)
                        toast.success('Query copied')
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Delete from history" onClick={() => void remove(entry.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </li>
              )
            })}
            {hasMore && (
              <li className="flex justify-center py-4">
                <Button size="sm" onClick={() => void load(entries[entries.length - 1]?.createdAt)}>
                  Load older queries
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        width="sm"
        title="Clear all history?"
        description="This removes every query from your history on this computer. Saved queries are not affected."
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.history.clear()
                setEntries([])
                setConfirmClear(false)
                toast.success('History cleared')
              }}
            >
              Clear history
            </Button>
          </>
        }
      >
        <span className="sr-only">Confirm clearing history</span>
      </Dialog>
    </div>
  )
}

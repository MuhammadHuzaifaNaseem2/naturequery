import { useEffect, useState } from 'react'
import { Bookmark, Play, Search, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SavedQuery } from '@shared/types'
import { DbIcon } from '../../components/brand'
import { Button, EmptyState, IconButton, Input, Spinner } from '../../components/ui'
import { formatRelativeTime } from '../../lib/format'
import { api } from '../../lib/nq'
import { findConnection, openTab, useApp } from '../../store/app-store'

export function SavedView() {
  const [queries, setQueries] = useState<SavedQuery[] | null>(null)
  const [search, setSearch] = useState('')
  const connections = useApp((state) => state.connections)

  useEffect(() => {
    api.saved.list().then(setQueries, () => setQueries([]))
  }, [])

  const term = search.trim().toLowerCase()
  const visible = (queries ?? []).filter(
    (query) =>
      !term ||
      query.name.toLowerCase().includes(term) ||
      query.text.toLowerCase().includes(term) ||
      query.question?.toLowerCase().includes(term)
  )

  const open = (query: SavedQuery, run = false) => {
    const connectionId =
      query.connectionId && findConnection(query.connectionId) ? query.connectionId : undefined
    if (!connectionId) {
      toast.error('The connection for this query no longer exists.', {
        description: 'Open it from the editor with another connection by copying the query.',
      })
      return
    }
    openTab(connectionId, {
      sql: query.text,
      question: query.question,
      title: query.name,
      savedQueryId: query.id,
      run,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-6 py-4">
        <div className="mr-auto">
          <h1 className="text-[17px] font-semibold tracking-tight">Saved queries</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Queries you want to keep and run again.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved queries"
            className="pl-8"
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {queries === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-5 w-5" />}
            title={term ? 'No matching saved queries' : 'No saved queries yet'}
            description={
              term
                ? 'Try a different search.'
                : 'Use Save in the query editor to keep queries you run often.'
            }
            className="py-16"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((query) => {
              const connection = query.connectionId
                ? query.connectionId === 'sample'
                  ? findConnection('sample')
                  : connections.find((c) => c.id === query.connectionId)
                : undefined
              return (
                <article
                  key={query.id}
                  className="group flex flex-col rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-2.5">
                    {connection ? (
                      <DbIcon type={connection.type} size="sm" className="mt-0.5" />
                    ) : (
                      <Bookmark className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13.5px] font-semibold">{query.name}</h3>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {connection?.name ?? 'No connection'} · Updated{' '}
                        {formatRelativeTime(query.updatedAt).toLowerCase()}
                      </p>
                    </div>
                  </div>
                  {query.description && (
                    <p className="mt-2 text-[12.5px] text-muted-foreground">{query.description}</p>
                  )}
                  <pre className="selectable mt-3 max-h-28 flex-1 overflow-hidden whitespace-pre-wrap break-words rounded-md bg-secondary/50 p-2.5 font-mono text-[11.5px] leading-relaxed">
                    {query.text}
                  </pre>
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Play className="h-3 w-3 fill-current" />}
                      onClick={() => open(query, true)}
                    >
                      Run
                    </Button>
                    <Button
                      size="sm"
                      icon={<SquareArrowOutUpRight className="h-3.5 w-3.5" />}
                      onClick={() => open(query)}
                    >
                      Open
                    </Button>
                    <IconButton
                      label="Delete saved query"
                      className="ml-auto"
                      onClick={async () => {
                        await api.saved.remove(query.id)
                        setQueries(
                          (current) => current?.filter((item) => item.id !== query.id) ?? null
                        )
                        toast.success('Saved query deleted')
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

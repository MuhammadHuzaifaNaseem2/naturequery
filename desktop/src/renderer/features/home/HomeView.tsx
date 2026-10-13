import { useEffect, useState } from 'react'
import { ArrowRight, Clock, DatabaseZap, Lock, Sparkles, Store } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'
import { DbIcon } from '../../components/brand'
import { formatRelativeTime, truncate } from '../../lib/format'
import { api } from '../../lib/nq'
import {
  connectionLabel,
  findConnection,
  openConnection,
  openDialog,
  openTab,
  setView,
  useApp,
} from '../../store/app-store'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function ActionCard({
  icon,
  title,
  description,
  action,
  onClick,
  tone,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  onClick: () => void
  tone: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <span className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        {icon}
      </span>
      <span className="text-[14.5px] font-semibold tracking-tight">{title}</span>
      <span className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {description}
      </span>
      <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary">
        {action}{' '}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

export function HomeView() {
  const connections = useApp((state) => state.connections)
  const auth = useApp((state) => state.auth)
  const user = auth.status === 'signed-in' ? auth.user : null
  const [recent, setRecent] = useState<HistoryEntry[]>([])

  useEffect(() => {
    api.history.list({ limit: 6 }).then(setRecent, () => setRecent([]))
  }, [])

  const recentConnections = [...connections]
    .sort((a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt))
    .slice(0, 6)
  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-10 pb-12 pt-10">
        <h1 className="text-[26px] font-semibold tracking-tight">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Ask your databases questions in plain English or SQL, right from this computer.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <ActionCard
            icon={<DatabaseZap className="h-5 w-5" />}
            tone="bg-primary/15 text-primary"
            title="Connect a database"
            description="PostgreSQL, MySQL, SQL Server, Oracle, Snowflake, BigQuery, MongoDB and 12 more, on this computer, your office network or the cloud."
            action="Add a connection"
            onClick={() => openDialog({ kind: 'connection' })}
          />
          <ActionCard
            icon={<Store className="h-5 w-5" />}
            tone="bg-success/15 text-success"
            title="Explore the sample store"
            description="A ready-made database of customers, products and orders to try queries and charts."
            action="Open sample data"
            onClick={() =>
              findConnection('sample') && openTab('sample', { title: 'Acme Store', run: true })
            }
          />
          <ActionCard
            icon={<Sparkles className="h-5 w-5" />}
            tone="bg-accent/15 text-accent"
            title="Ask in plain English"
            description="Describe what you want to know and NatureQuery writes the SQL for you."
            action="Ask a question"
            onClick={() => openTab(recentConnections[0]?.id ?? 'sample', { mode: 'ask' })}
          />
        </div>

        {recentConnections.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-[13px] font-semibold">Your connections</h2>
            <div className="grid grid-cols-3 gap-3">
              {recentConnections.map((connection) => (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => openConnection(connection.id)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40"
                >
                  <DbIcon type={connection.type} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">
                      {connection.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {connection.lastUsedAt
                        ? `Used ${formatRelativeTime(connection.lastUsedAt).toLowerCase()}`
                        : connectionLabel(connection)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">Recent queries</h2>
              <button
                type="button"
                className="text-[12.5px] text-primary hover:underline"
                onClick={() => setView('history')}
              >
                View all history
              </button>
            </div>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-card">
              {recent.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() =>
                      findConnection(entry.connectionId) &&
                      openTab(entry.connectionId, { sql: entry.text, question: entry.question })
                    }
                    disabled={!findConnection(entry.connectionId)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[12px]">
                        {truncate(entry.question || entry.text, 140)}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {entry.connectionName} · {formatRelativeTime(entry.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Queries run directly from this computer. Database passwords are encrypted with your
          Windows account and never leave this device.
        </p>
      </div>
    </div>
  )
}

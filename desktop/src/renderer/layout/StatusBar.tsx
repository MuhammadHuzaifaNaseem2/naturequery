import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { DB_TYPE_INFO } from '@shared/db-types'
import { formatDuration, plural } from '../lib/format'
import { useActiveTab, useApp, useConnection } from '../store/app-store'

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return <>{formatDuration(now - since)}</>
}

export function StatusBar() {
  const view = useApp((state) => state.view)
  const version = useApp((state) => state.info?.version)
  const tab = useActiveTab()
  const connection = useConnection(view === 'workspace' ? tab?.connectionId : undefined)
  const schema = useApp((state) => (tab ? state.schemas[tab.connectionId] : undefined))

  let status: React.ReactNode = 'Ready'
  if (tab?.status === 'running' && tab.startedAt)
    status = (
      <>
        Running… <Elapsed since={tab.startedAt} />
      </>
    )
  else if (tab?.status === 'success' && tab.result) {
    status = `${plural(tab.result.rowCount, 'row')}${tab.result.truncated ? ' (limit reached)' : ''} in ${formatDuration(tab.result.durationMs)}`
  } else if (tab?.status === 'error') status = 'Query failed'
  else if (tab?.status === 'canceled') status = 'Query canceled'

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border/70 bg-sidebar px-3 text-[11px] text-muted-foreground">
      {connection && view === 'workspace' ? (
        <span className="flex items-center gap-1.5">
          <span
            className={
              schema?.status === 'ready'
                ? 'h-1.5 w-1.5 rounded-full bg-success'
                : schema?.status === 'error'
                  ? 'h-1.5 w-1.5 rounded-full bg-destructive'
                  : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/50'
            }
          />
          {connection.name} · {DB_TYPE_INFO[connection.type].label}
        </span>
      ) : (
        <span>No query open</span>
      )}
      {view === 'workspace' && tab && <span className="tabular">{status}</span>}
      <span
        className="ml-auto flex items-center gap-1"
        title="Queries are checked before they run, and only read-only queries are allowed."
      >
        <ShieldCheck className="h-3.5 w-3.5" /> Read-only
      </span>
      {version && <span>v{version}</span>}
    </footer>
  )
}

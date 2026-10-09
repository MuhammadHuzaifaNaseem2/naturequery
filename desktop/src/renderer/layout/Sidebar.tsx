import { clsx } from 'clsx'
import {
  Bookmark,
  Copy,
  Database,
  History,
  Home,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  SquareTerminal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ConnectionInfo } from '@shared/types'
import { DbIcon } from '../components/brand'
import { IconButton, Menu, Spinner } from '../components/ui'
import { api } from '../lib/nq'
import {
  connectionLabel,
  loadSchema,
  openConnection,
  openDialog,
  openTab,
  setView,
  useApp,
  type View,
} from '../store/app-store'
import { AccountBadge } from './AccountBadge'

function NavItem({
  view,
  icon,
  label,
  badge,
}: {
  view: View
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  const active = useApp((state) => state.view === view)
  return (
    <button
      type="button"
      onClick={() => setView(view)}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
        active
          ? 'bg-primary/10 font-medium text-foreground'
          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
      )}
    >
      <span className={clsx('h-4 w-4', active && 'text-primary')}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge ? <span className="text-[11px] tabular text-muted-foreground">{badge}</span> : null}
    </button>
  )
}

function StatusDot({ connectionId }: { connectionId: string }) {
  const schema = useApp((state) => state.schemas[connectionId])
  if (schema?.status === 'loading') return <Spinner className="h-3 w-3" />
  return (
    <span
      title={
        schema?.status === 'ready'
          ? 'Connected'
          : schema?.status === 'error'
            ? 'Connection problem'
            : 'Not connected yet'
      }
      className={clsx(
        'h-1.5 w-1.5 rounded-full',
        schema?.status === 'ready'
          ? 'bg-success'
          : schema?.status === 'error'
            ? 'bg-destructive'
            : 'bg-muted-foreground/40'
      )}
    />
  )
}

function ConnectionRow({ connection, sample }: { connection: ConnectionInfo; sample?: boolean }) {
  const active = useApp((state) => {
    const tab = state.tabs.find((candidate) => candidate.id === state.activeTabId)
    return state.view === 'workspace' && tab?.connectionId === connection.id
  })

  const duplicate = async () => {
    try {
      const copy = await api.connections.duplicate(connection.id)
      toast.success(`Created “${copy.name}”`)
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  return (
    <div
      className={clsx(
        'group relative flex h-9 items-center rounded-md pr-1 transition-colors',
        active ? 'bg-secondary text-foreground' : 'hover:bg-secondary/60'
      )}
    >
      <button
        type="button"
        onClick={() => openConnection(connection.id)}
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-2 text-left"
        title={`${connection.name}\n${connectionLabel(connection)}`}
      >
        <DbIcon type={connection.type} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight">{connection.name}</span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {sample ? 'Built-in sample data' : connectionLabel(connection)}
          </span>
        </span>
        <StatusDot connectionId={connection.id} />
      </button>
      <Menu
        label={`${connection.name} actions`}
        trigger={(props) => (
          <IconButton
            label="Connection actions"
            className="ml-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100"
            {...props}
          >
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        )}
        items={[
          {
            label: 'New query',
            icon: <SquareTerminal className="h-4 w-4" />,
            onSelect: () => openTab(connection.id),
          },
          {
            label: 'Refresh tables',
            icon: <RefreshCw className="h-4 w-4" />,
            onSelect: () => void loadSchema(connection.id, true),
          },
          ...(sample
            ? []
            : [
                'separator' as const,
                {
                  label: 'Edit connection',
                  icon: <Pencil className="h-4 w-4" />,
                  onSelect: () => openDialog({ kind: 'connection', editing: connection }),
                },
                {
                  label: 'Duplicate',
                  icon: <Copy className="h-4 w-4" />,
                  onSelect: () => void duplicate(),
                },
                'separator' as const,
                {
                  label: 'Remove connection',
                  icon: <Trash2 className="h-4 w-4" />,
                  danger: true,
                  onSelect: () => openDialog({ kind: 'confirm-remove-connection', connection }),
                },
              ]),
        ]}
      />
    </div>
  )
}

export function Sidebar() {
  const connections = useApp((state) => state.connections)
  const sample = useApp((state) => state.sample)
  const tabCount = useApp((state) => state.tabs.length)

  return (
    <aside
      className="flex w-[264px] shrink-0 flex-col border-r border-border/70 bg-sidebar"
      aria-label="Navigation"
    >
      <nav className="space-y-0.5 p-2.5">
        <NavItem view="home" icon={<Home className="h-4 w-4" />} label="Home" />
        <NavItem
          view="workspace"
          icon={<SquareTerminal className="h-4 w-4" />}
          label="Queries"
          badge={tabCount || undefined}
        />
        <NavItem view="history" icon={<History className="h-4 w-4" />} label="History" />
        <NavItem view="saved" icon={<Bookmark className="h-4 w-4" />} label="Saved queries" />
      </nav>

      <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Connections
        </h2>
        <IconButton label="Add a connection" onClick={() => openDialog({ kind: 'connection' })}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
        {connections.length === 0 && (
          <button
            type="button"
            onClick={() => openDialog({ kind: 'connection' })}
            className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-border px-3 py-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Database className="h-4 w-4 shrink-0" />
            Connect your first database
          </button>
        )}
        {connections.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} />
        ))}
        {sample && (
          <>
            <h3 className="px-1.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sample
            </h3>
            <ConnectionRow connection={sample} sample />
          </>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border/70 p-2.5">
        <AccountBadge />
        <NavItem view="settings" icon={<SettingsIcon className="h-4 w-4" />} label="Settings" />
      </div>
    </aside>
  )
}

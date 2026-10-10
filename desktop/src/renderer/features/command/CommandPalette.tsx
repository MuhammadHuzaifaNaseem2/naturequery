import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  Bookmark,
  BookOpenText,
  DatabaseZap,
  History,
  Home,
  Keyboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  SquareTerminal,
  Table2,
} from 'lucide-react'
import type { SavedQuery } from '@shared/types'
import { DbIcon } from '../../components/brand'
import { api } from '../../lib/nq'
import { previewQuery } from '../../lib/sql'
import {
  findConnection,
  openConnection,
  openDialog,
  openTab,
  setTabMode,
  setView,
  togglePalette,
  useActiveTab,
  useApp,
} from '../../store/app-store'
import { explainTab } from '../../store/assistant'

interface Item {
  id: string
  group: string
  label: string
  detail?: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette() {
  const open = useApp((state) => state.paletteOpen)
  const connections = useApp((state) => state.connections)
  const sample = useApp((state) => state.sample)
  const activeTab = useActiveTab()
  const schema = useApp((state) =>
    activeTab ? state.schemas[activeTab.connectionId]?.snapshot : undefined
  )
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState<SavedQuery[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      setQuery('')
      setIndex(0)
      element.showModal()
      api.saved.list().then(setSaved, () => setSaved([]))
    }
    if (!open && element.open) element.close()
  }, [open])

  const items = useMemo<Item[]>(() => {
    const close = (run: () => void) => () => {
      togglePalette(false)
      run()
    }
    const all: Item[] = [
      {
        id: 'new-connection',
        group: 'Actions',
        label: 'Add a connection',
        icon: <Plus className="h-4 w-4" />,
        run: close(() => openDialog({ kind: 'connection' })),
      },
      {
        id: 'new-query',
        group: 'Actions',
        label: 'New query',
        icon: <SquareTerminal className="h-4 w-4" />,
        run: close(() => openTab(activeTab?.connectionId ?? connections[0]?.id ?? 'sample')),
      },
      {
        id: 'ask',
        group: 'Actions',
        label: 'Ask a question in plain English',
        icon: <Sparkles className="h-4 w-4" />,
        run: close(() => {
          if (activeTab) setTabMode(activeTab.id, 'ask')
          else openTab(connections[0]?.id ?? 'sample', { mode: 'ask' })
        }),
      },
      ...(activeTab?.sql.trim()
        ? [
            {
              id: 'explain',
              group: 'Actions',
              label: 'Explain this query',
              icon: <BookOpenText className="h-4 w-4" />,
              run: close(() => void explainTab(activeTab.id)),
            },
          ]
        : []),
      {
        id: 'home',
        group: 'Actions',
        label: 'Go to Home',
        icon: <Home className="h-4 w-4" />,
        run: close(() => setView('home')),
      },
      {
        id: 'history',
        group: 'Actions',
        label: 'Open history',
        icon: <History className="h-4 w-4" />,
        run: close(() => setView('history')),
      },
      {
        id: 'saved',
        group: 'Actions',
        label: 'Open saved queries',
        icon: <Bookmark className="h-4 w-4" />,
        run: close(() => setView('saved')),
      },
      {
        id: 'settings',
        group: 'Actions',
        label: 'Open settings',
        icon: <Settings className="h-4 w-4" />,
        run: close(() => setView('settings')),
      },
      {
        id: 'shortcuts',
        group: 'Actions',
        label: 'Keyboard shortcuts',
        icon: <Keyboard className="h-4 w-4" />,
        run: close(() => openDialog({ kind: 'shortcuts' })),
      },
      {
        id: 'sign-out',
        group: 'Actions',
        label: 'Sign out of NatureQuery',
        icon: <LogOut className="h-4 w-4" />,
        run: close(() => void api.auth.signOut().catch(() => {})),
      },
      ...[...connections, ...(sample ? [sample] : [])].map((connection) => ({
        id: `connection-${connection.id}`,
        group: 'Connections',
        label: connection.name,
        detail: 'Open connection',
        icon: <DbIcon type={connection.type} size="sm" />,
        run: close(() => openConnection(connection.id)),
      })),
      ...saved.map((item) => ({
        id: `saved-${item.id}`,
        group: 'Saved queries',
        label: item.name,
        detail: item.connectionId ? findConnection(item.connectionId)?.name : undefined,
        icon: <Bookmark className="h-4 w-4" />,
        run: close(() => {
          const connectionId =
            item.connectionId && findConnection(item.connectionId)
              ? item.connectionId
              : activeTab?.connectionId
          if (connectionId)
            openTab(connectionId, { sql: item.text, title: item.name, savedQueryId: item.id })
        }),
      })),
    ]
    if (activeTab && schema) {
      const connection = findConnection(activeTab.connectionId)
      for (const table of schema.tables.slice(0, 2000)) {
        all.push({
          id: `table-${table.qualifiedName}`,
          group: `Tables in ${connection?.name ?? 'this connection'}`,
          label: table.name,
          detail: table.schema,
          icon: <Table2 className="h-4 w-4" />,
          run: close(
            () =>
              connection &&
              openTab(connection.id, {
                sql: previewQuery(connection.type, table),
                title: table.name,
                run: true,
              })
          ),
        })
      }
    }
    return all
  }, [connections, sample, saved, activeTab, schema])

  const term = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!term) return items.filter((item) => !item.group.startsWith('Tables')).slice(0, 60)
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(term) || item.detail?.toLowerCase().includes(term)
      )
      .sort(
        (a, b) =>
          Number(!a.label.toLowerCase().startsWith(term)) -
          Number(!b.label.toLowerCase().startsWith(term))
      )
      .slice(0, 60)
  }, [items, term])

  useEffect(() => setIndex(0), [term])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  let lastGroup = ''
  return (
    <dialog
      ref={dialog}
      aria-label="Search and commands"
      onCancel={(event) => {
        event.preventDefault()
        togglePalette(false)
      }}
      onMouseDown={(event) => {
        if (event.target === dialog.current) togglePalette(false)
      }}
      className="mt-[12vh] w-[600px] max-w-[calc(100vw-48px)] overflow-hidden rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/40"
    >
      {open && (
        <div>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setIndex((value) => Math.min(value + 1, visible.length - 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setIndex((value) => Math.max(value - 1, 0))
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  visible[index]?.run()
                }
              }}
              placeholder="Type a command, connection, table or saved query"
              className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
              aria-label="Search"
            />
          </div>
          <ul ref={list} role="listbox" className="max-h-[420px] overflow-y-auto p-1.5">
            {visible.length === 0 && (
              <li className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                No results for “{query}”
              </li>
            )}
            {visible.map((item, position) => {
              const header = item.group !== lastGroup ? item.group : null
              lastGroup = item.group
              return (
                <li key={item.id}>
                  {header && (
                    <div className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {header}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={position === index}
                    data-index={position}
                    onMouseMove={() => setIndex(position)}
                    onClick={item.run}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]',
                      position === index ? 'bg-primary/15 text-foreground' : 'text-foreground/90'
                    )}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-muted-foreground">
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.detail && (
                      <span className="truncate text-[11.5px] text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <DatabaseZap className="h-3.5 w-3.5" /> Press Enter to open, Esc to close
          </div>
        </div>
      )}
    </dialog>
  )
}

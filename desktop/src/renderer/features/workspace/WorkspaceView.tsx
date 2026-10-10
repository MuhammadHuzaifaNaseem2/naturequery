import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Plus, X } from 'lucide-react'
import { DbIcon } from '../../components/brand'
import { IconButton, Spinner } from '../../components/ui'
import {
  activateTab,
  closeTab,
  findConnection,
  openTab,
  useActiveTab,
  useApp,
} from '../../store/app-store'
import { HomeView } from '../home/HomeView'
import { QueryEditor } from './QueryEditor'
import { ResultsPanel } from './ResultsPanel'
import { SchemaPanel } from './SchemaPanel'

const HEIGHT_KEY = 'nq.editorHeight'

function TabStrip() {
  const tabs = useApp((state) => state.tabs)
  const activeTabId = useApp((state) => state.activeTabId)
  const connections = useApp((state) => state.connections)
  const sample = useApp((state) => state.sample)
  const active = tabs.find((tab) => tab.id === activeTabId)

  return (
    <div
      role="tablist"
      aria-label="Open queries"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border/70 bg-sidebar/60"
    >
      {tabs.map((tab) => {
        const connection =
          tab.connectionId === 'sample'
            ? sample
            : connections.find((c) => c.id === tab.connectionId)
        const selected = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => activateTab(tab.id)}
            onAuxClick={(event) => {
              if (event.button === 1) closeTab(tab.id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') activateTab(tab.id)
            }}
            title={`${tab.title}${connection ? `\n${connection.name}` : ''}`}
            className={clsx(
              'group relative flex max-w-[220px] shrink-0 cursor-default items-center gap-2 border-r border-border/70 pl-3 pr-1.5 text-[12.5px] transition-colors',
              selected
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            )}
          >
            {selected && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
            {tab.status === 'running' ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              connection && (
                <DbIcon type={connection.type} size="sm" className="!h-4 !w-4 !text-[7px]" />
              )
            )}
            <span className="truncate">{tab.title}</span>
            <IconButton
              label="Close tab"
              onClick={(event) => {
                event.stopPropagation()
                closeTab(tab.id)
              }}
              className={clsx('h-5 w-5', !selected && 'opacity-0 group-hover:opacity-100')}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )
      })}
      <IconButton
        label="New query"
        className="mx-1 my-auto"
        onClick={() => {
          const connectionId = active?.connectionId ?? findConnection('sample')?.id
          if (connectionId) openTab(connectionId)
        }}
      >
        <Plus className="h-4 w-4" />
      </IconButton>
    </div>
  )
}

const MIN_EDITOR = 120
const MIN_RESULTS = 140

/** The tallest the editor may be, so the results always keep some room. */
function maxEditorHeight(containerHeight: number) {
  return Math.max(MIN_EDITOR, containerHeight - MIN_RESULTS)
}

function useEditorHeight(container: React.RefObject<HTMLDivElement>) {
  const saved = useRef(Number(localStorage.getItem(HEIGHT_KEY)) || 0)
  const [height, setHeight] = useState(() => saved.current || 260)
  const latest = useRef(height)
  latest.current = height
  const dragging = useRef(false)

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    dragging.current = true
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }, [])
  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging.current || !container.current) return
      const rect = container.current.getBoundingClientRect()
      setHeight(
        Math.max(MIN_EDITOR, Math.min(event.clientY - rect.top, maxEditorHeight(rect.height)))
      )
    },
    [container]
  )
  const onPointerUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    saved.current = Math.round(latest.current)
    localStorage.setItem(HEIGHT_KEY, String(saved.current))
  }, [])

  return { height, setHeight, saved, handlers: { onPointerDown, onPointerMove, onPointerUp } }
}

export function WorkspaceView() {
  const tab = useActiveTab()
  const schemaOpen = useApp((state) => state.schemaPanelOpen)
  const container = useRef<HTMLDivElement>(null)
  const editorArea = useRef<HTMLDivElement>(null)
  const { height, setHeight, saved, handlers } = useEditorHeight(container)

  useEffect(() => {
    const onResize = () => {
      const rect = container.current?.getBoundingClientRect()
      if (rect) setHeight((value) => Math.min(value, maxEditorHeight(rect.height)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setHeight])

  // Until the user drags the divider, the editor takes a share of the window.
  const hasTab = !!tab
  useLayoutEffect(() => {
    const rect = container.current?.getBoundingClientRect()
    if (saved.current || !rect) return
    setHeight(
      Math.min(Math.max(260, Math.round(rect.height * 0.42)), 440, maxEditorHeight(rect.height))
    )
  }, [hasTab, saved, setHeight])

  // When a whole query arrives at once (the AI wrote or fixed it, Format, a paste),
  // make the editor tall enough to show all of it. Typing one line at a time does
  // not resize anything. Depends only on the texts, so running the query does not
  // cancel the measurement.
  const tabId = tab?.id
  const tabSql = tab?.sql ?? ''
  const lines = tabSql.split('\n').length
  const aiSql = tab?.aiChange?.after ?? tab?.conversation.at(-1)?.sql
  const last = useRef<{ tabId?: string; aiSql?: string; lines: number }>({ lines: 0 })
  useEffect(() => {
    const previous = last.current
    last.current = { tabId, aiSql, lines }
    if (!tabId || tabId !== previous.tabId) return
    const aiWrote = !!aiSql && aiSql !== previous.aiSql && aiSql === tabSql
    if (!aiWrote && lines <= previous.lines + 1) return
    const frame = requestAnimationFrame(() => {
      const scroller = editorArea.current?.querySelector<HTMLElement>('.cm-scroller')
      const rect = container.current?.getBoundingClientRect()
      if (!scroller || !rect) return
      const hidden = scroller.scrollHeight - scroller.clientHeight
      if (hidden <= 0) return
      const max = Math.min(Math.round(rect.height * 0.6), maxEditorHeight(rect.height))
      setHeight((value) => Math.max(value, Math.min(max, value + hidden + 8)))
    })
    return () => cancelAnimationFrame(frame)
  }, [tabId, aiSql, tabSql, lines, setHeight])

  if (!tab) return <HomeView />

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabStrip />
      <div className="flex min-h-0 flex-1">
        {schemaOpen && <SchemaPanel connectionId={tab.connectionId} />}
        <div ref={container} className="flex min-w-0 flex-1 flex-col">
          <div ref={editorArea} style={{ height }} className="shrink-0">
            <QueryEditor tab={tab} />
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize editor"
            title="Drag to resize"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') setHeight((value) => Math.max(MIN_EDITOR, value - 24))
              if (event.key === 'ArrowDown') setHeight((value) => value + 24)
            }}
            className="group relative h-2 shrink-0 cursor-row-resize border-y border-border/70 bg-sidebar/60 hover:bg-primary/20 focus:bg-primary/20 focus:outline-none"
            {...handlers}
          >
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-primary group-focus:bg-primary" />
          </div>
          <ResultsPanel tab={tab} />
        </div>
      </div>
    </div>
  )
}

import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type AppError,
  type AppInfo,
  type AuthState,
  type ConnectionInfo,
  type ConversationTurn,
  type QueryResult,
  type SchemaSnapshot,
  type Settings,
  type ThemeName,
} from '@shared/types'
import { DB_TYPE_INFO, usesSql } from '@shared/db-types'
import { api, asAppError } from '../lib/nq'
import { applyThemeClass, currentChrome, resolveTheme, type ResolvedTheme } from '../lib/theme'

export type View = 'home' | 'workspace' | 'history' | 'saved' | 'settings'

export interface QueryTab {
  id: string
  connectionId: string
  title: string
  mode: 'sql' | 'ask'
  sql: string
  question: string
  conversation: ConversationTurn[]
  status: 'idle' | 'running' | 'success' | 'error' | 'canceled'
  queryId?: string
  startedAt?: number
  result?: QueryResult
  error?: AppError
  resultView: 'table' | 'chart'
  savedQueryId?: string
}

export interface SchemaState {
  status: 'loading' | 'ready' | 'error'
  snapshot?: SchemaSnapshot
  error?: AppError
}

export type DialogState =
  | { kind: 'connection'; editing?: ConnectionInfo; presetType?: ConnectionInfo['type'] }
  | { kind: 'welcome' }
  | { kind: 'shortcuts' }
  | { kind: 'save-query'; tabId: string }
  | { kind: 'confirm-remove-connection'; connection: ConnectionInfo }
  | null

interface AppState {
  ready: boolean
  info: AppInfo | null
  settings: Settings
  resolvedTheme: ResolvedTheme
  connections: ConnectionInfo[]
  sample: ConnectionInfo | null
  schemas: Record<string, SchemaState>
  tabs: QueryTab[]
  activeTabId: string | null
  view: View
  auth: AuthState
  dialog: DialogState
  paletteOpen: boolean
  sidebarCollapsed: boolean
  schemaPanelOpen: boolean
}

const TABS_KEY = 'nq.tabs.v1'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

export const useApp = create<AppState>(() => ({
  ready: false,
  info: null,
  settings: DEFAULT_SETTINGS,
  resolvedTheme: 'dim',
  connections: [],
  sample: null,
  schemas: {},
  tabs: [],
  activeTabId: null,
  view: 'home',
  auth: { status: 'signed-out' },
  dialog: null,
  paletteOpen: false,
  sidebarCollapsed: false,
  schemaPanelOpen: true,
}))

const set = useApp.setState
const get = useApp.getState

export function newId(): string {
  return crypto.randomUUID()
}

// ─── Lookup helpers ──────────────────────────────────────────────────

export function findConnection(id: string | undefined): ConnectionInfo | undefined {
  if (!id) return undefined
  const { connections, sample } = get()
  return id === 'sample'
    ? (sample ?? undefined)
    : connections.find((connection) => connection.id === id)
}

export function useConnection(id: string | undefined): ConnectionInfo | undefined {
  return useApp((state) =>
    !id
      ? undefined
      : id === 'sample'
        ? (state.sample ?? undefined)
        : state.connections.find((c) => c.id === id)
  )
}

export function useActiveTab(): QueryTab | undefined {
  return useApp((state) => state.tabs.find((tab) => tab.id === state.activeTabId))
}

function updateTab(id: string, patch: Partial<QueryTab> | ((tab: QueryTab) => Partial<QueryTab>)) {
  set((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, ...(typeof patch === 'function' ? patch(tab) : patch) } : tab
    ),
  }))
}

// ─── Startup ─────────────────────────────────────────────────────────

export async function initialize(): Promise<void> {
  const [info, settings, connections, sample, auth] = await Promise.all([
    api.app.info(),
    api.settings.get(),
    api.connections.list(),
    api.app.sampleConnection(),
    api.auth.state().catch((): AuthState => ({ status: 'signed-out' })),
  ])
  set({ info, settings, connections, sample, auth })
  applyTheme(settings.theme)
  systemDark.addEventListener('change', () => applyTheme(get().settings.theme))
  restoreTabs()
  api.connections.onChanged(() => void refreshConnections())
  api.auth.onChanged((state) => set({ auth: state }))
  set({
    ready: true,
    dialog: settings.onboardingCompleted ? null : { kind: 'welcome' },
    view: get().tabs.length ? 'workspace' : 'home',
  })
}

export function applyTheme(theme: ThemeName) {
  const resolved = resolveTheme(theme, systemDark.matches)
  applyThemeClass(resolved)
  set({ resolvedTheme: resolved })
  void api.app.setTheme(theme, currentChrome(resolved)).catch(() => {})
}

export async function updateSettings(patch: Partial<Settings>) {
  const settings = await api.settings.update(patch)
  set({ settings })
  if (patch.theme) applyTheme(patch.theme)
  return settings
}

// ─── Connections and schema ──────────────────────────────────────────

export async function refreshConnections() {
  const connections = await api.connections.list()
  set((state) => {
    const ids = new Set(connections.map((connection) => connection.id).concat('sample'))
    const tabs = state.tabs.filter((tab) => ids.has(tab.connectionId))
    const activeTabId = tabs.some((tab) => tab.id === state.activeTabId)
      ? state.activeTabId
      : (tabs[0]?.id ?? null)
    return {
      connections,
      tabs,
      activeTabId,
      view: !tabs.length && state.view === 'workspace' ? 'home' : state.view,
    }
  })
}

export async function loadSchema(connectionId: string, refresh = false) {
  const current = get().schemas[connectionId]
  if (!refresh && current && current.status !== 'error') return
  set((state) => ({
    schemas: {
      ...state.schemas,
      [connectionId]: { ...state.schemas[connectionId], status: 'loading' },
    },
  }))
  try {
    const snapshot = await api.db.schema(connectionId, refresh)
    set((state) => ({
      schemas: { ...state.schemas, [connectionId]: { status: 'ready', snapshot } },
    }))
  } catch (error) {
    set((state) => ({
      schemas: { ...state.schemas, [connectionId]: { status: 'error', error: asAppError(error) } },
    }))
  }
}

export function forgetSchema(connectionId: string) {
  set((state) => {
    const schemas = { ...state.schemas }
    delete schemas[connectionId]
    return { schemas }
  })
}

// ─── Tabs ────────────────────────────────────────────────────────────

function defaultSql(connectionId: string): string {
  const connection = findConnection(connectionId)
  if (!connection) return ''
  if (connectionId === 'sample') {
    return 'SELECT month, orders, revenue\nFROM monthly_revenue\nORDER BY month DESC\nLIMIT 12;'
  }
  if (!usesSql(connection.type)) {
    return '{\n  "collection": "",\n  "pipeline": [{ "$limit": 50 }]\n}'
  }
  return ''
}

export function openTab(
  connectionId: string,
  options: {
    sql?: string
    question?: string
    mode?: QueryTab['mode']
    title?: string
    savedQueryId?: string
    run?: boolean
  } = {}
) {
  const connection = findConnection(connectionId)
  if (!connection) return
  const sameConnection = get().tabs.filter((tab) => tab.connectionId === connectionId).length
  const tab: QueryTab = {
    id: newId(),
    connectionId,
    title:
      options.title ??
      (sameConnection ? `${connection.name} (${sameConnection + 1})` : connection.name),
    mode: options.mode ?? 'sql',
    sql: options.sql ?? defaultSql(connectionId),
    question: options.question ?? '',
    conversation: [],
    status: 'idle',
    resultView: 'table',
    savedQueryId: options.savedQueryId,
  }
  set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id, view: 'workspace' }))
  void loadSchema(connectionId)
  persistTabs()
  if (options.run && tab.sql.trim()) void runTab(tab.id)
  return tab.id
}

/** Focuses an existing tab for this connection, or opens one. */
export function openConnection(connectionId: string) {
  const existing = get().tabs.find((tab) => tab.connectionId === connectionId)
  if (existing) {
    set({ activeTabId: existing.id, view: 'workspace' })
    void loadSchema(connectionId)
    return
  }
  openTab(connectionId)
}

export function activateTab(id: string) {
  set({ activeTabId: id, view: 'workspace' })
}

export function closeTab(id: string) {
  const tab = get().tabs.find((candidate) => candidate.id === id)
  if (tab?.status === 'running' && tab.queryId) void api.db.cancel(tab.queryId).catch(() => {})
  set((state) => {
    const index = state.tabs.findIndex((candidate) => candidate.id === id)
    const tabs = state.tabs.filter((candidate) => candidate.id !== id)
    const activeTabId =
      state.activeTabId === id
        ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
        : state.activeTabId
    return {
      tabs,
      activeTabId,
      view: tabs.length ? state.view : state.view === 'workspace' ? 'home' : state.view,
    }
  })
  persistTabs()
}

export function setTabSql(id: string, sql: string) {
  updateTab(id, { sql })
  persistTabs()
}

export function setTabQuestion(id: string, question: string) {
  updateTab(id, { question })
}

export function setTabMode(id: string, mode: QueryTab['mode']) {
  updateTab(id, { mode })
  persistTabs()
}

export function setResultView(id: string, resultView: QueryTab['resultView']) {
  updateTab(id, { resultView })
}

export function renameTab(id: string, title: string) {
  updateTab(id, { title: title.trim().slice(0, 80) || 'Query' })
  persistTabs()
}

export async function runTab(
  id: string,
  options: { source?: 'editor' | 'ai'; question?: string } = {}
) {
  const tab = get().tabs.find((candidate) => candidate.id === id)
  if (!tab || tab.status === 'running') return
  const text = tab.sql
  if (!text.trim()) return
  const queryId = newId()
  updateTab(id, { status: 'running', queryId, error: undefined, startedAt: Date.now() })
  try {
    const result = await api.db.query({
      connectionId: tab.connectionId,
      text,
      queryId,
      source: options.source ?? 'editor',
      question: options.question,
    })
    updateTab(id, (current) => ({
      status: 'success',
      result,
      queryId: undefined,
      resultView: current.resultView,
    }))
  } catch (error) {
    const appError = asAppError(error)
    updateTab(id, {
      status: appError.code === 'CANCELED' ? 'canceled' : 'error',
      error: appError,
      queryId: undefined,
    })
  }
}

export async function cancelTab(id: string) {
  const tab = get().tabs.find((candidate) => candidate.id === id)
  if (tab?.status === 'running' && tab.queryId) await api.db.cancel(tab.queryId).catch(() => {})
}

let persistTimer: ReturnType<typeof setTimeout> | undefined
function persistTabs() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    const { tabs, activeTabId } = get()
    try {
      localStorage.setItem(
        TABS_KEY,
        JSON.stringify({
          activeTabId,
          tabs: tabs.map(({ id, connectionId, title, mode, sql, question, savedQueryId }) => ({
            id,
            connectionId,
            title,
            mode,
            sql,
            question,
            savedQueryId,
          })),
        })
      )
    } catch {
      // Storage full or unavailable; tabs simply will not be restored.
    }
  }, 400)
}

function restoreTabs() {
  try {
    const raw = localStorage.getItem(TABS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { activeTabId: string | null; tabs: Partial<QueryTab>[] }
    const tabs: QueryTab[] = (saved.tabs ?? [])
      .filter((tab) => tab.id && tab.connectionId && findConnection(tab.connectionId))
      .slice(0, 20)
      .map((tab) => ({
        id: tab.id!,
        connectionId: tab.connectionId!,
        title: tab.title || 'Query',
        mode: tab.mode === 'ask' ? 'ask' : 'sql',
        sql: tab.sql ?? '',
        question: tab.question ?? '',
        conversation: [],
        status: 'idle',
        resultView: 'table',
        savedQueryId: tab.savedQueryId,
      }))
    const activeTabId = tabs.some((tab) => tab.id === saved.activeTabId)
      ? saved.activeTabId
      : (tabs[0]?.id ?? null)
    set({ tabs, activeTabId })
    const active = tabs.find((tab) => tab.id === activeTabId)
    if (active) void loadSchema(active.connectionId)
  } catch {
    localStorage.removeItem(TABS_KEY)
  }
}

// ─── Dialogs and navigation ──────────────────────────────────────────

export function openDialog(dialog: DialogState) {
  set({ dialog })
}

export function closeDialog() {
  set({ dialog: null })
}

export function setView(view: View) {
  set({ view })
}

export function togglePalette(open?: boolean) {
  set((state) => ({ paletteOpen: open ?? !state.paletteOpen }))
}

export function toggleSidebar() {
  set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}

export function toggleSchemaPanel() {
  set((state) => ({ schemaPanelOpen: !state.schemaPanelOpen }))
}

export function connectionLabel(connection: ConnectionInfo): string {
  const info = DB_TYPE_INFO[connection.type]
  if (connection.type === 'sqlite')
    return connection.sqlite?.path.split(/[\\/]/).pop() ?? info.label
  if (connection.type === 'turso') return connection.turso?.url ?? info.label
  if (connection.type === 'snowflake') return connection.snowflake?.account ?? info.label
  if (connection.type === 'bigquery') return connection.bigquery?.projectId ?? info.label
  if (connection.type === 'firestore') return connection.firestore?.projectId ?? info.label
  if (connection.type === 'dynamodb') return connection.dynamodb?.region ?? info.label
  const host = connection.sqlserver?.instance
    ? `${connection.host}\\${connection.sqlserver.instance}`
    : connection.host
  return [host, connection.database].filter(Boolean).join(' / ') || info.label
}

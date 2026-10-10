import { create } from 'zustand'
import { toast } from 'sonner'
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
  type UpdateStatus,
} from '@shared/types'
import { DB_TYPE_INFO, usesSql } from '@shared/db-types'
import { api, asAppError } from '../lib/nq'
import { applyThemeClass, currentChrome, resolveTheme, type ResolvedTheme } from '../lib/theme'

export type View = 'home' | 'workspace' | 'history' | 'saved' | 'settings'

/** The plain-English assistant's state in a tab. */
export interface AssistantState {
  status: 'idle' | 'thinking' | 'fixing'
  /** A clarifying question from the AI, or why it declined. */
  notice?: { kind: 'clarify' | 'refused'; message: string }
  error?: AppError
}

/** An AI answer shown above the results: loading, ready or failed. */
export type AiPanel<T> =
  | { status: 'loading' }
  | ({ status: 'ready' } & T)
  | { status: 'error'; error: AppError }

export interface QueryTab {
  id: string
  connectionId: string
  title: string
  mode: 'sql' | 'ask'
  sql: string
  /** Text in the question box. */
  question: string
  /** The question that produced the current query, if any. */
  lastQuestion?: string
  conversation: ConversationTurn[]
  status: 'idle' | 'running' | 'success' | 'error' | 'canceled'
  queryId?: string
  startedAt?: number
  result?: QueryResult
  error?: AppError
  resultView: 'table' | 'chart'
  savedQueryId?: string
  assistant: AssistantState
  explanation?: AiPanel<{ text: string; forSql: string }>
  insights?: AiPanel<{ summary: string; highlights: string[]; usedRows: boolean }>
  /** The query before the AI changed it, so the change can be undone. */
  aiChange?: { before: string; after: string }
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

/** Open tabs from versions before sign-in was required, shared by everyone on the computer. */
const EARLIER_TABS_KEY = 'nq.tabs.v1'
const tabsKey = (userId: string) => `${EARLIER_TABS_KEY}:${userId}`
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

export function findTab(id: string): QueryTab | undefined {
  return get().tabs.find((tab) => tab.id === id)
}

export function updateTab(
  id: string,
  patch: Partial<QueryTab> | ((tab: QueryTab) => Partial<QueryTab>)
) {
  set((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, ...(typeof patch === 'function' ? patch(tab) : patch) } : tab
    ),
  }))
}

// ─── Startup ─────────────────────────────────────────────────────────

export async function initialize(): Promise<void> {
  const [info, settings, sample, auth] = await Promise.all([
    api.app.info(),
    api.settings.get(),
    api.app.sampleConnection(),
    api.auth.state().catch((): AuthState => ({ status: 'signed-out' })),
  ])
  set({ info, settings, sample, auth })
  applyTheme(settings.theme)
  systemDark.addEventListener('change', () => applyTheme(get().settings.theme))
  api.connections.onChanged(() => void refreshConnections())
  api.auth.onChanged(onAuthChanged)
  api.updates.onStatus(onUpdateStatus)
  if (auth.status === 'signed-in') await openWorkspace(auth.user.id)
  set({ ready: true })
}

function signedInUserId(): string | null {
  const auth = get().auth
  return auth.status === 'signed-in' ? auth.user.id : null
}

/** Loads the signed-in account's connections and the tabs it had open. */
async function openWorkspace(userId: string) {
  let connections: ConnectionInfo[] = []
  try {
    connections = await api.connections.list()
  } catch (error) {
    const appError = asAppError(error)
    toast.error(appError.message, { description: appError.hint })
  }
  // Signed out, or another account signed in, while loading.
  if (signedInUserId() !== userId) return
  set({ connections })
  restoreTabs(userId)
  set({
    view: get().tabs.length ? 'workspace' : 'home',
    dialog: get().settings.onboardingCompleted ? null : { kind: 'welcome' },
  })
}

/** Clears everything that belongs to the account that signed out. */
function closeWorkspace() {
  set({
    connections: [],
    schemas: {},
    tabs: [],
    activeTabId: null,
    view: 'home',
    dialog: null,
    paletteOpen: false,
  })
}

const announced = new Set<string>()

/** Tells the user once when an update can be downloaded, and when it is ready. */
function onUpdateStatus(status: UpdateStatus) {
  if (status.state === 'available' && !announced.has(`available:${status.version}`)) {
    announced.add(`available:${status.version}`)
    toast(`NatureQuery ${status.version} is available`, {
      description: 'Download it now. It installs the next time you restart NatureQuery.',
      action: { label: 'Download', onClick: () => void api.updates.download().catch(() => {}) },
      duration: 20_000,
    })
  }
  if (status.state === 'ready' && !announced.has(`ready:${status.version}`)) {
    announced.add(`ready:${status.version}`)
    toast.success(`NatureQuery ${status.version} is ready`, {
      description: 'Restart to finish updating. Your open queries are kept.',
      action: { label: 'Restart now', onClick: () => void api.updates.install().catch(() => {}) },
      duration: Infinity,
    })
  }
}

/**
 * Signing in opens that account's workspace; signing out closes it and the
 * sign-in screen takes over the window. Errors such as an expired sign-in are
 * shown on that screen.
 */
function onAuthChanged(state: AuthState) {
  const before = signedInUserId()
  const after = state.status === 'signed-in' ? state.user.id : null
  if (before && before !== after) saveTabsNow(before)
  set({ auth: state })
  if (before === after) return
  closeWorkspace()
  if (after) void openWorkspace(after)
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
  const userId = signedInUserId()
  if (!userId) return
  const connections = await api.connections.list()
  if (signedInUserId() !== userId) return
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
  if (connection.type === 'firestore') return '{\n  "collection": "",\n  "limit": 50\n}'
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
    assistant: { status: 'idle' },
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
export function persistTabs() {
  clearTimeout(persistTimer)
  const userId = signedInUserId()
  if (userId) persistTimer = setTimeout(() => saveTabsNow(userId), 400)
}

/** Saves the open tabs for this account, so they come back at its next sign-in. */
function saveTabsNow(userId: string) {
  clearTimeout(persistTimer)
  const { tabs, activeTabId } = get()
  try {
    localStorage.setItem(
      tabsKey(userId),
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
}

function restoreTabs(userId: string) {
  const key = tabsKey(userId)
  try {
    // The first account to sign in after updating keeps the tabs that were open before.
    const earlier = localStorage.getItem(EARLIER_TABS_KEY)
    if (earlier !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, earlier)
      localStorage.removeItem(EARLIER_TABS_KEY)
    }
    const raw = localStorage.getItem(key)
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
        assistant: { status: 'idle' },
      }))
    const activeTabId = tabs.some((tab) => tab.id === saved.activeTabId)
      ? saved.activeTabId
      : (tabs[0]?.id ?? null)
    set({ tabs, activeTabId })
    const active = tabs.find((tab) => tab.id === activeTabId)
    if (active) void loadSchema(active.connectionId)
  } catch {
    localStorage.removeItem(key)
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

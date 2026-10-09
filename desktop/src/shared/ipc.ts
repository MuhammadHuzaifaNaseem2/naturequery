import type {
  AppInfo,
  AuthState,
  ConnectionInfo,
  ConnectionInput,
  Envelope,
  ExplainRequest,
  ExportOutcome,
  ExportRequest,
  FixRequest,
  GenerateRequest,
  GenerateResult,
  HistoryEntry,
  HistoryQuery,
  InsightsRequest,
  InsightsResult,
  MenuCommand,
  QueryRequest,
  QueryResult,
  SavedQuery,
  SavedQueryInput,
  SchemaSnapshot,
  Settings,
  TestResult,
  ThemeName,
  UpdateStatus,
} from './types'

/** Invoke channels. Every handler returns an Envelope. */
export const IPC = {
  appInfo: 'app:info',
  appOpenExternal: 'app:open-external',
  appOpenLogs: 'app:open-logs',
  appSetTheme: 'app:set-theme',
  appSampleConnection: 'app:sample-connection',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  connectionsList: 'connections:list',
  connectionsSave: 'connections:save',
  connectionsRemove: 'connections:remove',
  connectionsDuplicate: 'connections:duplicate',
  connectionsTest: 'connections:test',
  connectionsPickFile: 'connections:pick-file',
  dbSchema: 'db:schema',
  dbQuery: 'db:query',
  dbCancel: 'db:cancel',
  historyList: 'history:list',
  historyRemove: 'history:remove',
  historyClear: 'history:clear',
  savedList: 'saved:list',
  savedSave: 'saved:save',
  savedRemove: 'saved:remove',
  filesExport: 'files:export',
  clipboardWrite: 'clipboard:write',
  authState: 'auth:state',
  authSignIn: 'auth:sign-in',
  authSubmitCode: 'auth:submit-code',
  authCancel: 'auth:cancel',
  authSignOut: 'auth:sign-out',
  authOpenAccount: 'auth:open-account',
  aiGenerate: 'ai:generate',
  aiFix: 'ai:fix',
  aiExplain: 'ai:explain',
  aiInsights: 'ai:insights',
  updatesCheck: 'updates:check',
  updatesInstall: 'updates:install',
  updatesStatus: 'updates:status',
} as const

/** Main-to-renderer events. */
export const EVENTS = {
  menuCommand: 'event:menu-command',
  authChanged: 'event:auth-changed',
  updateStatus: 'event:update-status',
  connectionsChanged: 'event:connections-changed',
} as const

export type FileKind = 'sqlite' | 'service-account' | 'ssh-key' | 'ca-certificate'

/** Colors for the native window controls drawn over the custom title bar. */
export interface WindowChrome {
  background: string
  symbol: string
  dark: boolean
}

type Call<A extends unknown[], R> = (...args: A) => Promise<Envelope<R>>
type Listen<T> = (listener: (payload: T) => void) => () => void

/** Exposed on window.nq by the preload script. */
export interface NqBridge {
  platform: NodeJS.Platform
  app: {
    info: Call<[], AppInfo>
    openExternal: Call<[url: string], void>
    openLogs: Call<[], void>
    setTheme: Call<[theme: ThemeName, chrome: WindowChrome], void>
    sampleConnection: Call<[], ConnectionInfo>
    onMenuCommand: Listen<MenuCommand>
  }
  settings: {
    get: Call<[], Settings>
    update: Call<[patch: Partial<Settings>], Settings>
  }
  connections: {
    list: Call<[], ConnectionInfo[]>
    save: Call<[input: ConnectionInput], ConnectionInfo>
    remove: Call<[id: string], void>
    duplicate: Call<[id: string], ConnectionInfo>
    test: Call<[input: ConnectionInput], TestResult>
    pickFile: Call<[kind: FileKind], string | null>
    onChanged: Listen<void>
  }
  db: {
    schema: Call<[connectionId: string, refresh?: boolean], SchemaSnapshot>
    query: Call<[request: QueryRequest], QueryResult>
    cancel: Call<[queryId: string], void>
  }
  history: {
    list: Call<[query: HistoryQuery], HistoryEntry[]>
    remove: Call<[id: string], void>
    clear: Call<[], void>
  }
  saved: {
    list: Call<[], SavedQuery[]>
    save: Call<[input: SavedQueryInput], SavedQuery>
    remove: Call<[id: string], void>
  }
  files: {
    exportResult: Call<[request: ExportRequest], ExportOutcome>
  }
  clipboard: {
    write: Call<[text: string], void>
  }
  auth: {
    state: Call<[], AuthState>
    signIn: Call<[], void>
    submitCode: Call<[code: string], AuthState>
    cancel: Call<[], void>
    signOut: Call<[], void>
    openAccount: Call<[path?: string], void>
    onChanged: Listen<AuthState>
  }
  ai: {
    generate: Call<[request: GenerateRequest], GenerateResult>
    fix: Call<[request: FixRequest], GenerateResult>
    explain: Call<[request: ExplainRequest], { explanation: string }>
    insights: Call<[request: InsightsRequest], InsightsResult>
  }
  updates: {
    status: Call<[], UpdateStatus>
    check: Call<[], UpdateStatus>
    install: Call<[], void>
    onStatus: Listen<UpdateStatus>
  }
}

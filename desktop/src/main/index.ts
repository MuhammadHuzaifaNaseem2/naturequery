import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  nativeTheme,
  net,
  safeStorage,
  session,
  shell,
} from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { IPC, EVENTS, type FileKind } from '@shared/ipc'
import { DB_TYPE_INFO } from '@shared/db-types'
import { NqError } from '@shared/errors'
import type {
  AppInfo,
  AuthState,
  ConnectionConfig,
  ConnectionInfo,
  ConnectionSecrets,
  Envelope,
  ExportRequest,
  QueryRequest,
  SchemaSnapshot,
} from '@shared/types'
import { createAccount } from './account'
import { openAccountData, type AccountData } from './account-data'
import { createAi } from './ai'
import { createEngineHost } from './engine-host'
import { EXPORT_FILTERS, writeExport } from './exporter'
import { createIpc, passThrough } from './ipc'
import { logFilePath, logger } from './logger'
import { paths } from './paths'
import { registerAppScheme, serveRenderer, isTrustedAppUrl } from './protocol'
import { createSecretBox } from './secure-store'
import { createSettingsStore } from './settings'
import { createUpdater } from './updater'
import {
  accountPathSchema,
  authCodeSchema,
  clipboardTextSchema,
  connectionIdSchema,
  connectionInputSchema,
  explainRequestSchema,
  exportRequestSchema,
  externalUrlSchema,
  fileKindSchema,
  fixRequestSchema,
  generateRequestSchema,
  historyQuerySchema,
  insightsRequestSchema,
  parseInput,
  queryIdSchema,
  queryRequestSchema,
  recordIdSchema,
  savedQueryInputSchema,
  settingsPatchSchema,
  themeSchema,
  windowChromeSchema,
} from './validation'
import { applyChrome, createMainWindow, openExternalSafely, resolveInitialChrome } from './window'

const devServerUrl = !app.isPackaged ? process.env.NQ_DEV_SERVER_URL : undefined
/** Installed from the Microsoft Store (an MSIX package), which handles updates and links. */
const STORE = process.windowsStore === true
const API_BASE_URL =
  (!app.isPackaged && process.env.NATUREQUERY_API_URL) || 'https://naturequery.app'

// Development and automated tests can use a separate profile.
if (!app.isPackaged && process.env.NATUREQUERY_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.NATUREQUERY_USER_DATA))
}
app.setName('NatureQuery')
if (process.platform === 'win32') app.setAppUserModelId('app.naturequery.desktop')
registerAppScheme()

let mainWindow: BrowserWindow | null = null

// ─── naturequery:// links (browser sign-in) ─────────────────────────
const PROTOCOL = 'naturequery'
const queuedLinks: string[] = []
let openLink: ((url: string) => void) | null = null

function linkFromArgs(argv: string[]): string | undefined {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${PROTOCOL}://`))
}

function routeLink(url: string) {
  if (openLink) openLink(url)
  else queuedLinks.push(url)
}

/** Opens a page of the NatureQuery website in the browser. */
function openSite(url: string) {
  const target = new URL(url)
  if (target.origin !== new URL(API_BASE_URL).origin) {
    throw new NqError('VALIDATION', 'This link was blocked.')
  }
  // Automated tests of development builds record the page instead of opening a browser.
  if (!app.isPackaged && process.env.NQ_OPEN_EXTERNAL_LOG) {
    fs.appendFileSync(process.env.NQ_OPEN_EXTERNAL_LOG, `${target.toString()}\n`)
    return
  }
  return shell.openExternal(target.toString())
}

function unwrap<T>(envelope: Envelope<T>): T {
  if (envelope.ok) return envelope.value
  throw new NqError(envelope.error.code, envelope.error.message, {
    hint: envelope.error.hint,
    detail: envelope.error.detail,
  })
}

function focusWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function send(channel: string, payload?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function sampleConnection(): ConnectionInfo {
  return {
    id: 'sample',
    name: 'Acme Store (sample)',
    type: 'sqlite',
    sqlite: { path: paths.sampleDatabase() },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    savedSecrets: [],
  }
}

async function start() {
  logger.info(
    `Starting NatureQuery Desktop ${app.getVersion()} (${process.platform} ${process.arch})`
  )
  serveRenderer(paths.renderer())

  // The interface needs nothing from the browser beyond writing to the
  // clipboard. Camera, microphone, location and the rest stay blocked.
  const allowClipboard = (permission: string, url: string) =>
    (permission === 'clipboard-sanitized-write' || permission === 'clipboard-write') &&
    isTrustedAppUrl(url, devServerUrl)
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) =>
    callback(allowClipboard(permission, details.requestingUrl))
  )
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) =>
    allowClipboard(permission, origin)
  )
  session.defaultSession.on('will-download', (event) => event.preventDefault())

  const box = createSecretBox(safeStorage)
  const settings = createSettingsStore(paths.settings())
  const engine = createEngineHost(paths.engine())

  // ── The signed-in account's connections and history ────────────────
  // Nothing in the workspace is available until someone signs in. Signing
  // out closes it, ends every database connection and forgets loaded schemas.
  let data: AccountData | null = null
  let dataError: unknown = null
  // Schemas used for AI questions, kept from the last time each was loaded.
  const schemaCache = new Map<string, SchemaSnapshot>()

  function switchAccountData(state: AuthState) {
    const userId = state.status === 'signed-in' ? state.user.id : null
    if (data && data.userId === userId) return
    if (data) {
      data.close()
      data = null
      engine.closeAll()
      schemaCache.clear()
      logger.info('Closed the workspace of the account that signed out')
    }
    dataError = null
    if (!userId) return
    try {
      data = openAccountData({ root: paths.userData(), userId, box, log: logger })
      logger.info('Opened the workspace of the signed-in account')
    } catch (error) {
      dataError = error
      logger.error('Could not open the workspace of the signed-in account', error)
    }
  }

  function requireData(): AccountData {
    if (data) return data
    if (dataError) {
      throw new NqError('UNKNOWN', 'Your workspace on this computer could not be opened.', {
        hint: 'Restart NatureQuery. If it keeps happening, send the log file to support.',
        detail: (dataError as Error)?.message,
      })
    }
    throw new NqError('SIGNED_OUT', 'Sign in to NatureQuery to continue.')
  }

  function resolveConnection(id: string): { config: ConnectionConfig; secrets: ConnectionSecrets } {
    const { connections } = requireData()
    if (id === 'sample') {
      const { savedSecrets: _saved, ...config } = sampleConnection()
      return { config, secrets: {} }
    }
    return connections.resolve(id)
  }

  // The installer registers naturequery:// too; this repairs it if another app took it over.
  // Microsoft Store installs declare it in their package instead.
  if (app.isPackaged && !STORE) {
    app.setAsDefaultProtocolClient(PROTOCOL)
  } else if (process.env.NQ_REGISTER_PROTOCOL === '1') {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  }

  const account = createAccount({
    apiBaseUrl: API_BASE_URL,
    file: paths.account(),
    box,
    // Chromium's network stack uses the system proxy and the Windows certificate store.
    fetch: (url, init) => net.fetch(url, init),
    openExternal: openSite,
    // Switch workspaces before the window hears about the change.
    emit: (state) => {
      switchAccountData(state)
      send(EVENTS.authChanged, state)
    },
    device: { name: os.hostname(), platform: process.platform, appVersion: app.getVersion() },
    log: {
      info: (message) => logger.info(message),
      warn: (message, error) => logger.warn(message, error),
    },
  })
  openLink = (url) => {
    focusWindow()
    void account.handleCallback(url).catch((error) => logger.error('Sign-in link failed', error))
  }
  switchAccountData(account.state())
  for (const url of queuedLinks.splice(0)) openLink(url)
  if (account.isSignedIn()) {
    account.refreshProfile().catch((error) => logger.warn('Could not refresh the account', error))
  }

  async function schemaOf(connectionId: string): Promise<SchemaSnapshot> {
    const cached = schemaCache.get(connectionId)
    if (cached) return cached
    const { config, secrets } = resolveConnection(connectionId)
    const snapshot = unwrap(
      await engine.request({ kind: 'schema', config, secrets, timeoutMs: 120_000 }, 150_000)
    )
    schemaCache.set(connectionId, snapshot)
    return snapshot
  }
  const ai = createAi({
    account,
    typeOf: (connectionId) => resolveConnection(connectionId).config.type,
    schemaOf,
    shareRows: () => settings.get().shareSampleRowsForCharts,
  })

  const ipc = createIpc({ getWindow: () => mainWindow, devServerUrl })
  const { handle } = ipc

  // ── App ──────────────────────────────────────────────────────────────
  handle(
    IPC.appInfo,
    (): AppInfo => ({
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      packaged: app.isPackaged,
      store: STORE,
      electron: process.versions.electron,
      userDataPath: app.getPath('userData'),
      apiBaseUrl: API_BASE_URL,
    })
  )
  handle(IPC.appOpenExternal, (url) => openExternalSafely(parseInput(externalUrlSchema, url)))
  handle(IPC.appOpenLogs, () => {
    if (!STORE) return shell.showItemInFolder(logFilePath())
    // Store installs keep app data in a private folder that File Explorer
    // cannot open, so the logs are copied to Documents first.
    const source = path.dirname(logFilePath())
    const target = path.join(app.getPath('documents'), 'NatureQuery logs')
    fs.mkdirSync(target, { recursive: true })
    for (const name of fs.readdirSync(source)) {
      if (name.endsWith('.log')) fs.copyFileSync(path.join(source, name), path.join(target, name))
    }
    shell.showItemInFolder(path.join(target, path.basename(logFilePath())))
  })
  handle(IPC.appSetTheme, (theme, chrome) => {
    const name = parseInput(themeSchema, theme)
    const colors = parseInput(windowChromeSchema, chrome)
    nativeTheme.themeSource = name === 'system' ? 'system' : colors.dark ? 'dark' : 'light'
    if (mainWindow) applyChrome(mainWindow, colors)
  })
  handle(IPC.appSampleConnection, () => sampleConnection())

  // ── Settings ─────────────────────────────────────────────────────────
  handle(IPC.settingsGet, () => settings.get())
  handle(IPC.settingsUpdate, (patch) => settings.update(parseInput(settingsPatchSchema, patch)))

  // ── Connections ──────────────────────────────────────────────────────
  handle(IPC.connectionsList, () => requireData().connections.list())
  handle(IPC.connectionsSave, async (input) => {
    const saved = requireData().connections.save(parseInput(connectionInputSchema, input))
    schemaCache.delete(saved.id)
    await engine.request({ kind: 'release', connectionId: saved.id }, 10_000)
    send(EVENTS.connectionsChanged)
    return saved
  })
  handle(IPC.connectionsRemove, async (id) => {
    const connectionId = parseInput(connectionIdSchema, id)
    requireData().connections.remove(connectionId)
    schemaCache.delete(connectionId)
    await engine.request({ kind: 'release', connectionId }, 10_000)
    send(EVENTS.connectionsChanged)
  })
  handle(IPC.connectionsDuplicate, (id) => {
    const copy = requireData().connections.duplicate(parseInput(connectionIdSchema, id))
    send(EVENTS.connectionsChanged)
    return copy
  })
  handle(IPC.connectionsTest, async (input) => {
    const { config, secrets } = requireData().connections.preview(
      parseInput(connectionInputSchema, input)
    )
    return passThrough(
      await engine.request({ kind: 'test', config, secrets, timeoutMs: 45_000 }, 60_000)
    )
  })
  handle(IPC.connectionsPickFile, async (kind) => {
    const fileKind = parseInput(fileKindSchema, kind) as FileKind
    const filters: Record<FileKind, Electron.FileFilter[]> = {
      sqlite: [
        { name: 'SQLite database', extensions: ['db', 'sqlite', 'sqlite3', 'db3', 's3db', 'sl3'] },
        { name: 'All files', extensions: ['*'] },
      ],
      'service-account': [{ name: 'Service account key', extensions: ['json'] }],
      'ssh-key': [{ name: 'All files', extensions: ['*'] }],
      'ca-certificate': [
        { name: 'Certificate', extensions: ['pem', 'crt', 'cer'] },
        { name: 'All files', extensions: ['*'] },
      ],
      'private-key': [
        { name: 'Private key', extensions: ['p8', 'pem', 'key'] },
        { name: 'All files', extensions: ['*'] },
      ],
    }
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: filters[fileKind],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  // ── Database ─────────────────────────────────────────────────────────
  handle(IPC.dbSchema, async (id) => {
    const connectionId = parseInput(connectionIdSchema, id)
    const { config, secrets } = resolveConnection(connectionId)
    const envelope = await engine.request(
      { kind: 'schema', config, secrets, timeoutMs: 120_000 },
      150_000
    )
    if (envelope.ok) schemaCache.set(connectionId, envelope.value)
    return passThrough(envelope)
  })
  handle(IPC.dbQuery, async (raw) => {
    const request: QueryRequest = parseInput(queryRequestSchema, raw)
    // The account that ran the query keeps it in its history, even if it signs out meanwhile.
    const current = requireData()
    const { config, secrets } = resolveConnection(request.connectionId)
    const { rowLimit, queryTimeoutSeconds } = settings.get()
    const timeoutMs = queryTimeoutSeconds * 1000
    const envelope = await engine.request(
      {
        kind: 'query',
        config,
        secrets,
        text: request.text,
        queryId: request.queryId,
        rowLimit,
        timeoutMs,
      },
      timeoutMs + 30_000
    )
    if (request.source !== 'preview') {
      try {
        current.workspace.addHistory({
          connectionId: request.connectionId,
          connectionName: config.name,
          text: request.text,
          question: request.question,
          source: request.source,
          status: envelope.ok
            ? 'success'
            : envelope.error.code === 'CANCELED'
              ? 'canceled'
              : 'error',
          rowCount: envelope.ok ? envelope.value.rowCount : undefined,
          durationMs: envelope.ok ? envelope.value.durationMs : undefined,
          error: envelope.ok ? undefined : envelope.error.message,
        })
      } catch (error) {
        logger.warn('Could not record query history', error)
      }
    }
    if (envelope.ok && request.connectionId !== 'sample') {
      try {
        current.connections.touch(request.connectionId)
      } catch {
        // Last-used time is cosmetic.
      }
    }
    return passThrough(envelope)
  })
  handle(IPC.dbCancel, async (queryId) => {
    await engine.request({ kind: 'cancel', queryId: parseInput(queryIdSchema, queryId) }, 15_000)
  })

  // ── History and saved queries ────────────────────────────────────────
  handle(IPC.historyList, (query) =>
    requireData().workspace.listHistory(parseInput(historyQuerySchema, query ?? {}))
  )
  handle(IPC.historyRemove, (id) =>
    requireData().workspace.removeHistory(parseInput(recordIdSchema, id))
  )
  handle(IPC.historyClear, () => requireData().workspace.clearHistory())
  handle(IPC.savedList, () => requireData().workspace.listSaved())
  handle(IPC.savedSave, (input) =>
    requireData().workspace.saveQuery(parseInput(savedQueryInputSchema, input))
  )
  handle(IPC.savedRemove, (id) =>
    requireData().workspace.removeSaved(parseInput(recordIdSchema, id))
  )

  // ── Files and clipboard ──────────────────────────────────────────────
  handle(IPC.filesExport, async (raw) => {
    const request = parseInput(exportRequestSchema, raw) as ExportRequest
    const filter = EXPORT_FILTERS[request.format]
    const safeName = request.suggestedName.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100) || 'results'
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export results',
      defaultPath: path.join(app.getPath('documents'), `${safeName}.${filter.extensions[0]}`),
      filters: [filter],
    })
    if (result.canceled || !result.filePath) return { saved: false }
    try {
      await writeExport(request.format, result.filePath, request.columns, request.rows)
    } catch (error) {
      throw new NqError('UNKNOWN', 'The file could not be saved.', {
        hint: 'Check that the file is not open in another program and that you can write to that folder.',
        detail: (error as Error).message,
      })
    }
    return { saved: true, path: result.filePath }
  })
  handle(IPC.clipboardWrite, (text) => {
    clipboard.writeText(parseInput(clipboardTextSchema, text))
  })

  // ── Account and AI ───────────────────────────────────────────────────
  handle(IPC.authState, () => account.state())
  handle(IPC.authSignIn, () => account.signIn())
  handle(IPC.authSubmitCode, (code) => account.submitCode(parseInput(authCodeSchema, code)))
  handle(IPC.authCancel, () => account.cancel())
  handle(IPC.authSignOut, () => account.signOut())
  handle(IPC.authOpenAccount, (page) =>
    openSite(`${API_BASE_URL}${parseInput(accountPathSchema, page ?? undefined) ?? '/settings'}`)
  )
  handle(IPC.aiGenerate, (request) => ai.generate(parseInput(generateRequestSchema, request)))
  handle(IPC.aiFix, (request) => ai.fix(parseInput(fixRequestSchema, request)))
  handle(IPC.aiExplain, (request) => ai.explain(parseInput(explainRequestSchema, request)))
  handle(IPC.aiInsights, (request) => ai.insights(parseInput(insightsRequestSchema, request)))

  // ── Updates ──────────────────────────────────────────────────────────
  const updater = createUpdater({
    packaged: app.isPackaged,
    store: STORE,
    emit: (status) => send(EVENTS.updateStatus, status),
    automaticChecks: () => settings.get().checkForUpdates,
    logger,
  })
  handle(IPC.updatesStatus, () => updater.status())
  handle(IPC.updatesCheck, () => updater.check())
  handle(IPC.updatesDownload, () => updater.download())
  handle(IPC.updatesInstall, () => updater.install())

  const initial = resolveInitialChrome(settings.get().theme, nativeTheme.shouldUseDarkColors)
  const openWindow = () => {
    mainWindow = createMainWindow({
      chrome: initial,
      devServerUrl,
      onRendererGone: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        void dialog
          .showMessageBox(mainWindow, {
            type: 'error',
            title: 'NatureQuery',
            message: 'NatureQuery needs to reload the window.',
            detail:
              'Your connections and history are safe. Unsaved query text in open tabs may be lost.',
            buttons: ['Reload'],
          })
          .then(() => mainWindow?.reload())
      },
    })
    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }
  openWindow()
  updater.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow()
  })
  app.on('before-quit', () => {
    updater.stop()
    engine.stop()
    data?.close()
  })
  logger.info(`Supported database types: ${Object.keys(DB_TYPE_INFO).length}`)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  const initialLink = linkFromArgs(process.argv)
  if (initialLink) routeLink(initialLink)
  app.on('second-instance', (_event, argv) => {
    focusWindow()
    const link = linkFromArgs(argv)
    if (link) routeLink(link)
  })
  // macOS delivers links through open-url, possibly before the app is ready.
  app.on('open-url', (event, url) => {
    event.preventDefault()
    routeLink(url)
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  process.on('uncaughtException', (error) => logger.error('Uncaught exception', error))
  process.on('unhandledRejection', (error) => logger.error('Unhandled rejection', error))
  app
    .whenReady()
    .then(start)
    .catch((error) => {
      logger.error('NatureQuery failed to start', error)
      dialog.showErrorBox('NatureQuery could not start', String(error?.message ?? error))
      app.quit()
    })
}

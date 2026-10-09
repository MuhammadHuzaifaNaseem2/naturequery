import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  nativeTheme,
  safeStorage,
  session,
  shell,
} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { IPC, EVENTS, type FileKind } from '@shared/ipc'
import { DB_TYPE_INFO } from '@shared/db-types'
import { NqError } from '@shared/errors'
import type {
  AppInfo,
  ConnectionConfig,
  ConnectionInfo,
  ConnectionSecrets,
  ExportRequest,
  QueryRequest,
} from '@shared/types'
import { createConnectionStore } from './connections'
import { createEngineHost } from './engine-host'
import { EXPORT_FILTERS, writeExport } from './exporter'
import { createIpc, passThrough } from './ipc'
import { logFilePath, logger } from './logger'
import { paths } from './paths'
import { registerAppScheme, serveRenderer, isTrustedAppUrl } from './protocol'
import { createSecretBox } from './secure-store'
import { createSettingsStore } from './settings'
import {
  clipboardTextSchema,
  connectionIdSchema,
  connectionInputSchema,
  exportRequestSchema,
  externalUrlSchema,
  fileKindSchema,
  historyQuerySchema,
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
import { openWorkspaceDb, type WorkspaceDb } from './workspace-db'

const devServerUrl = !app.isPackaged ? process.env.NQ_DEV_SERVER_URL : undefined
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

function focusWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function send(channel: string, payload?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function openWorkspaceDbSafely(): WorkspaceDb {
  const file = paths.workspaceDb()
  try {
    return openWorkspaceDb(file)
  } catch (error) {
    // A damaged history file must not stop the app from starting.
    logger.error('Workspace database could not be opened; starting a fresh one', error)
    const backup = `${file}.damaged-${Date.now()}`
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(file + suffix)) fs.renameSync(file + suffix, backup + suffix)
    }
    return openWorkspaceDb(file)
  }
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
  const connections = createConnectionStore({
    file: paths.connections(),
    legacyFile: paths.legacyConnections(),
    box,
  })
  try {
    const migrated = connections.migrateLegacy()
    if (migrated) logger.info(`Imported ${migrated} connection(s) from an earlier desktop version`)
  } catch (error) {
    logger.error('Could not import connections from an earlier version', error)
  }
  const settings = createSettingsStore(paths.settings())
  const workspace = openWorkspaceDbSafely()
  const engine = createEngineHost(paths.engine())

  function resolveConnection(id: string): { config: ConnectionConfig; secrets: ConnectionSecrets } {
    if (id === 'sample') {
      const { savedSecrets: _saved, ...config } = sampleConnection()
      return { config, secrets: {} }
    }
    return connections.resolve(id)
  }

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
      electron: process.versions.electron,
      userDataPath: app.getPath('userData'),
      apiBaseUrl: API_BASE_URL,
    })
  )
  handle(IPC.appOpenExternal, (url) => openExternalSafely(parseInput(externalUrlSchema, url)))
  handle(IPC.appOpenLogs, () => {
    shell.showItemInFolder(logFilePath())
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
  handle(IPC.connectionsList, () => connections.list())
  handle(IPC.connectionsSave, async (input) => {
    const saved = connections.save(parseInput(connectionInputSchema, input))
    await engine.request({ kind: 'release', connectionId: saved.id }, 10_000)
    send(EVENTS.connectionsChanged)
    return saved
  })
  handle(IPC.connectionsRemove, async (id) => {
    const connectionId = parseInput(connectionIdSchema, id)
    connections.remove(connectionId)
    await engine.request({ kind: 'release', connectionId }, 10_000)
    send(EVENTS.connectionsChanged)
  })
  handle(IPC.connectionsDuplicate, (id) => {
    const copy = connections.duplicate(parseInput(connectionIdSchema, id))
    send(EVENTS.connectionsChanged)
    return copy
  })
  handle(IPC.connectionsTest, async (input) => {
    const { config, secrets } = connections.preview(parseInput(connectionInputSchema, input))
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
    const { config, secrets } = resolveConnection(parseInput(connectionIdSchema, id))
    return passThrough(
      await engine.request({ kind: 'schema', config, secrets, timeoutMs: 120_000 }, 150_000)
    )
  })
  handle(IPC.dbQuery, async (raw) => {
    const request: QueryRequest = parseInput(queryRequestSchema, raw)
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
        workspace.addHistory({
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
        connections.touch(request.connectionId)
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
    workspace.listHistory(parseInput(historyQuerySchema, query ?? {}))
  )
  handle(IPC.historyRemove, (id) => workspace.removeHistory(parseInput(recordIdSchema, id)))
  handle(IPC.historyClear, () => workspace.clearHistory())
  handle(IPC.savedList, () => workspace.listSaved())
  handle(IPC.savedSave, (input) => workspace.saveQuery(parseInput(savedQueryInputSchema, input)))
  handle(IPC.savedRemove, (id) => workspace.removeSaved(parseInput(recordIdSchema, id)))

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

  // ── Account and AI (connected in the next milestone) ─────────────────
  const signedOut = () => {
    throw new NqError('SIGNED_OUT', 'Sign in to NatureQuery to use AI features.', {
      hint: 'Your local SQL workspace keeps working without an account.',
    })
  }
  handle(IPC.authState, () => ({ status: 'signed-out' }))
  handle(IPC.authSignIn, signedOut)
  handle(IPC.authSubmitCode, signedOut)
  handle(IPC.authCancel, () => undefined)
  handle(IPC.authSignOut, () => undefined)
  handle(IPC.authOpenAccount, () => openExternalSafely(`${API_BASE_URL}/settings`))
  handle(IPC.aiGenerate, signedOut)
  handle(IPC.aiFix, signedOut)
  handle(IPC.aiExplain, signedOut)
  handle(IPC.aiInsights, signedOut)

  // ── Updates (connected with release packaging) ───────────────────────
  const updatesDisabled = () => ({
    state: 'disabled' as const,
    reason: app.isPackaged
      ? 'Updates are not configured for this build.'
      : 'Development builds do not update.',
  })
  handle(IPC.updatesStatus, updatesDisabled)
  handle(IPC.updatesCheck, updatesDisabled)
  handle(IPC.updatesInstall, () => undefined)

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow()
  })
  app.on('before-quit', () => {
    engine.stop()
    try {
      workspace.close()
    } catch {
      // Already closed.
    }
  })
  logger.info(`Supported database types: ${Object.keys(DB_TYPE_INFO).length}`)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => focusWindow())
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

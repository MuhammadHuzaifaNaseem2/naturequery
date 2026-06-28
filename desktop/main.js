// NatureQuery Desktop — Electron main process
//
// This is the heart of the desktop app's superpower: it runs on the user's
// own machine, so it can reach databases on localhost or inside a private
// company network that the cloud website (naturequery.app) can never touch.
//
// The renderer (UI) never talks to a database directly. It sends a request
// over a secure bridge (see preload.js) and THIS process does the actual
// connecting, using the same logic the web app already uses on the server.

const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const path = require('path')

// The hosted web app. The desktop window loads the real NatureQuery product,
// so users get every feature with no duplication.
const WEB_APP_URL = process.env.NATUREQUERY_URL || 'https://naturequery.app'

// Set NATUREQUERY_LOAD=test to open the local-database test screen on start.
const LOAD_TARGET = process.env.NATUREQUERY_LOAD || 'app'

let mainWindow = null

function loadApp() {
  if (mainWindow) mainWindow.loadURL(WEB_APP_URL)
}

function loadLocalDatabases() {
  if (mainWindow) mainWindow.loadFile(path.join(__dirname, 'renderer', 'local.html'))
}

function loadLocalDbTest() {
  if (mainWindow) mainWindow.loadFile(path.join(__dirname, 'renderer', 'welcome.html'))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0d1117',
    title: 'NatureQuery',
    webPreferences: {
      // Security best practices: the renderer cannot touch Node directly.
      // It can only use the small, explicit API we expose in preload.js.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (LOAD_TARGET === 'test') {
    loadLocalDbTest()
  } else if (LOAD_TARGET === 'local') {
    loadLocalDatabases()
  } else {
    loadApp()
  }

  // Open external links (e.g. docs, pricing) in the user's real browser,
  // not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Native application menu. Keeps the real product front-and-centre while still
// giving easy access to the local-database test screen and the usual controls.
function buildMenu() {
  const template = [
    {
      label: 'NatureQuery',
      submenu: [
        { label: 'Open NatureQuery', click: loadApp },
        { label: 'Local Databases', click: loadLocalDatabases },
        { label: 'Local Database Test', click: loadLocalDbTest },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── Local database bridge ───────────────────────────────────────────────
//
// These handlers run in Node, on the user's machine. This is what lets the
// desktop app connect to local/internal databases. The driver logic lives in
// engine/db-drivers.cjs and mirrors the web app's drivers. It supports
// PostgreSQL, MySQL/MariaDB, and SQL Server today; more are added there.

const { createDriver } = require('./engine/db-drivers.cjs')

// Turn raw errors into friendly messages. A missing database package means
// that database type is not bundled in the desktop app yet.
function friendlyError(err) {
  const msg = err && err.message ? err.message : String(err)
  if (err && err.code === 'MODULE_NOT_FOUND') {
    return 'This database type is not available in the desktop app yet.'
  }
  return msg
}

// Open a driver, run something with it, and always close it.
async function withDriver(creds, fn) {
  const driver = createDriver(creds)
  try {
    return await fn(driver)
  } finally {
    await driver.close().catch(() => {})
  }
}

// Test that we can reach and authenticate against the database.
ipcMain.handle('db:test', async (_event, creds) => {
  try {
    await withDriver(creds, (d) => d.testConnection())
    return { ok: true }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
})

// Run a query and return the rows (capped to a safe maximum in the engine).
ipcMain.handle('db:query', async (_event, creds, sql) => {
  try {
    const result = await withDriver(creds, (d) => d.executeQuery(sql))
    return { ok: true, ...result }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
})

// Read the database structure (tables and columns) for the AI prompt.
ipcMain.handle('db:schema', async (_event, creds) => {
  try {
    const schema = await withDriver(creds, (d) => d.fetchSchema())
    return { ok: true, schema }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
})

// ─── Saved local connections ──────────────────────────────────────────────
//
// These operate by connection id. Credentials (including the password) stay in
// the main process; the renderer only ever sees connection metadata.

const store = require('./store.cjs')

ipcMain.handle('localdb:list', () => store.list())
ipcMain.handle('localdb:save', (_event, input) => store.save(input))
ipcMain.handle('localdb:remove', (_event, id) => store.remove(id))

async function withSavedConnection(id, fn) {
  const creds = store.credsFor(id)
  if (!creds) return { ok: false, error: 'Connection not found' }
  try {
    const value = await withDriver(creds, fn)
    return { ok: true, value }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

ipcMain.handle('localdb:test', async (_event, id) => {
  const res = await withSavedConnection(id, (d) => d.testConnection())
  return res.ok ? { ok: true } : res
})

ipcMain.handle('localdb:schema', async (_event, id) => {
  const res = await withSavedConnection(id, (d) => d.fetchSchema())
  return res.ok ? { ok: true, schema: res.value } : res
})

ipcMain.handle('localdb:query', async (_event, id, sql) => {
  const res = await withSavedConnection(id, (d) => d.executeQuery(sql))
  return res.ok ? { ok: true, ...res.value } : res
})

// ─── App lifecycle ───────────────────────────────────────────────────────

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // On macOS apps usually stay open until the user quits explicitly.
  if (process.platform !== 'darwin') app.quit()
})

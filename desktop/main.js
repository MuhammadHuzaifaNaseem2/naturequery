// NatureQuery Desktop — Electron main process
//
// This is the heart of the desktop app's superpower: it runs on the user's
// own machine, so it can reach databases on localhost or inside a private
// company network that the cloud website (naturequery.app) can never touch.
//
// The renderer (UI) never talks to a database directly. It sends a request
// over a secure bridge (see preload.js) and THIS process does the actual
// connecting, using the same logic the web app already uses on the server.

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')

// The hosted web app. In production the desktop window loads the real
// NatureQuery product, so users get every feature with no duplication.
const WEB_APP_URL = process.env.NATUREQUERY_URL || 'https://naturequery.app'

// For the proof-of-concept we open a local welcome screen first that proves
// local-database access works. Set NATUREQUERY_LOAD=web to skip straight to
// the hosted app instead.
const LOAD_TARGET = process.env.NATUREQUERY_LOAD || 'welcome'

let mainWindow = null

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

  if (LOAD_TARGET === 'web') {
    mainWindow.loadURL(WEB_APP_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'welcome.html'))
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

// ─── App lifecycle ───────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // On macOS apps usually stay open until the user quits explicitly.
  if (process.platform !== 'darwin') app.quit()
})

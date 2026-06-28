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
// desktop app connect to local/internal databases. Postgres is wired up
// first as the proof; the other drivers follow the same shape and will be
// ported from the web app's src/lib/db-drivers.ts.

const { Pool } = require('pg')

function isLocalHost(host) {
  return ['localhost', '127.0.0.1', '::1'].includes(host)
}

function makePgPool(creds) {
  return new Pool({
    host: creds.host,
    port: Number(creds.port) || 5432,
    database: creds.database,
    user: creds.user,
    password: creds.password,
    // Local databases generally don't use SSL; remote ones do.
    ssl: isLocalHost(creds.host) ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
  })
}

// Test that we can actually reach and authenticate against the database.
ipcMain.handle('db:test', async (_event, creds) => {
  const pool = makePgPool(creds)
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  } finally {
    await pool.end().catch(() => {})
  }
})

// Run a read-only query and return the rows. (Write-protection and the full
// safety blocklist from the web app will be ported in the next step.)
ipcMain.handle('db:query', async (_event, creds, sql) => {
  const pool = makePgPool(creds)
  try {
    const result = await pool.query(sql)
    return {
      ok: true,
      rows: result.rows,
      fields: result.fields.map((f) => f.name),
      rowCount: result.rowCount,
    }
  } catch (err) {
    return { ok: false, error: err.message }
  } finally {
    await pool.end().catch(() => {})
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

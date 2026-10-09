// NatureQuery Desktop: local workspace, hosted AI workspace, and a narrow database bridge.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { readFileSync } = require('node:fs')
const { zoomAction, applyZoom } = require('./zoom.cjs')
const {
  createPolicy,
  validateConnection,
  validateId,
  validateSql,
  isOAuthRedirect,
} = require('./policy.cjs')
const { createDriver } = require('./engine/db-drivers.cjs')
const store = require('./store.cjs')
const { autoUpdater } = require('electron-updater')

const WEB_APP_URL = (!app.isPackaged && process.env.NATUREQUERY_URL) || 'https://naturequery.app'
const RENDERER_DIR = path.join(__dirname, 'renderer')
const policy = createPolicy(WEB_APP_URL, RENDERER_DIR)
// Pass bundled, non-secret styling to the sandboxed preload before any paint.
const authPresentation = Buffer.from(JSON.stringify({
  origins: ['https://naturequery.app', 'https://www.naturequery.app', new URL(WEB_APP_URL).origin],
  css: ['hosted-auth.css', 'hosted-workspace.css']
    .map((file) => readFileSync(path.join(RENDERER_DIR, file), 'utf8')).join('\n'),
})).toString('base64')
let mainWindow = null
let loadingTimer = null
let updateCheck = false
let updateReady = false
let oauthNoticePending = false

// Tests and development never need to touch a user's saved connections or session.
if (!app.isPackaged && process.env.NATUREQUERY_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.NATUREQUERY_USER_DATA))
}
app.setName('NatureQuery')
if (process.platform === 'win32') app.setAppUserModelId('app.naturequery.desktop')

function loadLocalDatabases() {
  clearTimeout(loadingTimer)
  return mainWindow.loadFile(path.join(RENDERER_DIR, 'local.html')).catch(() => {})
}
function showOffline() {
  clearTimeout(loadingTimer)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(RENDERER_DIR, 'offline.html')).catch(() => {})
  }
}
function loadApp() {
  clearTimeout(loadingTimer)
  const target = new URL('/dashboard', WEB_APP_URL).href
  loadingTimer = setTimeout(() => {
    if (!mainWindow?.isDestroyed() && mainWindow.webContents.isLoadingMainFrame()) {
      mainWindow.webContents.stop()
      showOffline()
    }
  }, 30000)
  mainWindow.loadURL(target).catch(showOffline)
}
function assertTrustedSender(event, localOnly = false) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw new Error('Untrusted desktop request.')
  const url = event.senderFrame.url
  if (!policy.isTrusted(url) || (localOnly && !policy.isLocal(url)))
    throw new Error('This action is only available in the local workspace.')
}
async function openExternal(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return
    await shell.openExternal(parsed.href)
  } catch {
    /* Invalid URLs must not reach the operating system. */
  }
}
function handleExternalNavigation(url) {
  if (!isOAuthRedirect(url)) {
    openExternal(url)
    return
  }
  if (oauthNoticePending) return
  oauthNoticePending = true
  // OAuth in a system browser cannot transfer its session into this window.
  // Reload the form so a provider click cannot leave its button spinning forever.
  const loginUrl = new URL('/login?callbackUrl=%2Fdashboard', WEB_APP_URL).href
  setImmediate(async () => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) return
      await mainWindow.loadURL(loginUrl).catch(showOffline)
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Sign in to NatureQuery Desktop',
        message: 'Use your email and password in the desktop app.',
        detail:
          'Google and GitHub sign-in currently work in a web browser, but that browser session cannot sign in the desktop app.',
        buttons: ['Continue with email', 'Open web sign-in'],
        defaultId: 0,
        cancelId: 0,
      })
      if (response === 1) openExternal(loginUrl)
    } finally {
      oauthNoticePending = false
    }
  })
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 860,
    minHeight: 620,
    title: 'NatureQuery',
    backgroundColor: '#1b1c22',
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--naturequery-auth-presentation=${authPresentation}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  // Recognize keyboard-layout and numpad variants before web editors can
  // consume them. preventDefault also suppresses duplicate menu accelerators.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const action = zoomAction(input)
    if (!action) return
    event.preventDefault()
    applyZoom(mainWindow.webContents, action)
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    handleExternalNavigation(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (policy.isTrusted(url)) return
    event.preventDefault()
    handleExternalNavigation(url)
  })
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!policy.isTrusted(url)) {
      event.preventDefault()
      handleExternalNavigation(url)
    }
  })
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())
  mainWindow.webContents.on('did-finish-load', () => {
    clearTimeout(loadingTimer)
  })
  mainWindow.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !policy.isLocal(url)) showOffline()
  })
  mainWindow.webContents.on('render-process-gone', showOffline)
  mainWindow.on('closed', () => {
    clearTimeout(loadingTimer)
    mainWindow = null
  })
  loadLocalDatabases()
}
async function checkForUpdates(manual = true) {
  if (!app.isPackaged)
    return {
      ok: true,
      message: 'You are running a development build. Installed builds can check for updates.',
    }
  if (updateCheck) return { ok: true, message: 'An update check is already in progress.' }
  updateCheck = true
  try {
    if (updateReady) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update ready',
        message: 'Restart NatureQuery to install the downloaded update?',
        detail: 'Finish any running queries before restarting.',
        buttons: ['Restart and install', 'Later'],
        defaultId: 1,
        cancelId: 1,
      })
      if (response === 0) autoUpdater.quitAndInstall()
      return { ok: true, message: 'The update is ready when you are.' }
    }
    const result = await autoUpdater.checkForUpdates()
    if (!result || !result.isUpdateAvailable) return { ok: true, message: 'You are up to date.' }
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'NatureQuery update',
      message: 'Version ' + result.updateInfo.version + ' is available.',
      buttons: ['Download update', 'Later'],
      defaultId: 1,
      cancelId: 1,
    })
    if (response === 0) {
      await autoUpdater.downloadUpdate()
      updateReady = true
      return {
        ok: true,
        message: 'Update downloaded. Use Check for updates to restart when you are ready.',
      }
    }
    return { ok: true, message: 'Update postponed.' }
  } catch {
    const message =
      'The update service is unavailable. You can keep using this version and try again later.'
    if (!manual) return { ok: false, message }
    return { ok: false, message }
  } finally {
    updateCheck = false
  }
}
function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'NatureQuery',
        submenu: [
          { label: 'Desktop home', accelerator: 'CmdOrCtrl+Shift+H', click: loadLocalDatabases },
          { label: 'Open AI workspace', accelerator: 'CmdOrCtrl+Shift+A', click: loadApp },
          { type: 'separator' },
          {
            label: 'Check for updates…',
            click: async () => {
              const result = await checkForUpdates()
              dialog.showMessageBox(mainWindow, { type: 'info', message: result.message })
            },
          },
          {
            label: 'About NatureQuery',
            click: () =>
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About NatureQuery',
                message: 'NatureQuery Desktop ' + app.getVersion(),
                detail:
                  'Local SQL workspace and connected AI analysis.\nPasswords are encrypted on this computer. AI features require an internet connection.',
              }),
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => applyZoom(mainWindow.webContents, 'reset') },
          { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => applyZoom(mainWindow.webContents, 'in') },
          { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => applyZoom(mainWindow.webContents, 'out') },
          { role: 'togglefullscreen' },
          ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
        ],
      },
      {
        label: 'Help',
        submenu: [
          { label: 'Help center', click: () => openExternal('https://naturequery.app/faq') },
          {
            label: 'Contact support',
            click: () => openExternal('https://naturequery.app/contact'),
          },
        ],
      },
    ])
  )
}
function friendlyError(error) {
  if (error?.code === 'ECONNREFUSED')
    return 'Could not reach the database. Check that it is running and that the host and port are correct.'
  if (error?.code === 'ENOTFOUND')
    return 'That database host could not be found. Check the hostname or your network connection.'
  if (['ETIMEDOUT', 'ETIMEOUT'].includes(error?.code))
    return 'The database took too long to respond. Check your VPN, network, and database access rules.'
  if (['28P01', 'ER_ACCESS_DENIED_ERROR', 'ELOGIN'].includes(error?.code))
    return 'The database rejected these credentials. Check your username and password.'
  return error?.message || 'Something went wrong. Please try again.'
}
async function withDriver(creds, operation) {
  const driver = createDriver(creds)
  try {
    return await operation(driver)
  } finally {
    await driver.close().catch(() => {})
  }
}
async function savedOperation(id, operation) {
  validateId(id)
  const creds = store.credsFor(id)
  if (!creds) throw new Error('Connection not found. Choose another connection.')
  return withDriver(creds, operation)
}
// All handlers validate both the origin and the top-level frame. Local-only
// credential entry never accepts requests from hosted pages or embedded frames.
function handle(name, localOnly, operation, wrapped = true) {
  ipcMain.handle(name, async (event, ...args) => {
    assertTrustedSender(event, localOnly)
    try {
      return await operation(...args)
    } catch (error) {
      if (!wrapped) throw new Error(friendlyError(error))
      return { ok: false, error: friendlyError(error) }
    }
  })
}
handle('app:info', true, () => ({
  version: app.getVersion(),
  platform: process.platform,
  packaged: app.isPackaged,
}))
handle('app:open-workspace', true, () => {
  setImmediate(loadApp)
  return { ok: true }
})
handle('app:home', false, () => {
  setImmediate(loadLocalDatabases)
  return { ok: true }
})
handle('app:updates', true, () => checkForUpdates())
handle('app:help', true, () => {
  openExternal('https://naturequery.app/contact')
  return { ok: true }
})
handle('app:export-csv', true, async (csv) => {
  if (typeof csv !== 'string' || Buffer.byteLength(csv) > 10 * 1024 * 1024)
    throw new Error('The export is too large.')
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export query results',
    defaultPath: 'naturequery-results.csv',
    filters: [{ name: 'CSV spreadsheet', extensions: ['csv'] }],
  })
  if (result.canceled || !result.filePath) return { ok: true, canceled: true }
  await fs.writeFile(result.filePath, '\ufeff' + csv, 'utf8')
  return { ok: true }
})
handle('localdb:open-manager', false, () => {
  setImmediate(loadLocalDatabases)
  return { ok: true }
})
handle('localdb:list', false, () => store.list(), false)
handle('localdb:save', true, (input) => store.save(validateConnection(input, true)), false)
handle('localdb:remove', false, async (id) => {
  validateId(id)
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Remove saved connection?',
    message: 'Remove this connection from NatureQuery?',
    detail: 'Your database and its data will not be deleted.',
    buttons: ['Cancel', 'Remove connection'],
    defaultId: 0,
    cancelId: 0,
  })
  return response === 1 ? store.remove(id) : { ok: true, canceled: true }
})
handle('db:test', true, async (input) => {
  const creds = validateConnection(input, true)
  if (creds.id && creds.password === undefined) {
    const saved = store.credsFor(creds.id)
    if (!saved) throw new Error('Connection no longer exists.')
    creds.password = saved.password
  }
  await withDriver(creds, (driver) => driver.testConnection())
  return { ok: true }
})
handle('localdb:test', false, async (id) => {
  await savedOperation(id, (driver) => driver.testConnection())
  return { ok: true }
})
handle('localdb:schema', false, async (id) => ({
  ok: true,
  schema: await savedOperation(id, (driver) => driver.fetchSchema()),
}))
handle('localdb:query', false, async (id, sql) => {
  validateSql(sql)
  return { ok: true, ...(await savedOperation(id, (driver) => driver.executeQuery(sql))) }
})

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.on('error', () => {}) // A missing release must not crash the app.

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    session.defaultSession.setPermissionCheckHandler(() => false)
    buildMenu()
    createWindow()
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow()
    })
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

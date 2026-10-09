import { app, BrowserWindow, screen, shell } from 'electron'
import type { Rectangle } from 'electron'
import path from 'node:path'
import type { WindowChrome } from '@shared/ipc'
import type { ThemeName } from '@shared/types'
import { readJsonFile, writeJsonFile } from './json-file'
import { logger } from './logger'
import { paths } from './paths'
import { APP_ORIGIN, isTrustedAppUrl } from './protocol'
import { applyZoom, zoomAction } from './zoom'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const DEFAULT_STATE: WindowState = { width: 1440, height: 900, maximized: false }
export const TITLE_BAR_HEIGHT = 40

/** Title bar colors used before the interface loads, to avoid a flash. */
const INITIAL_CHROME: Record<Exclude<ThemeName, 'system'>, WindowChrome> = {
  light: { background: '#eceff3', symbol: '#2b3340', dark: false },
  dark: { background: '#060a14', symbol: '#d6dbe4', dark: true },
  dim: { background: '#141b24', symbol: '#d8dee8', dark: true },
  forest: { background: '#0a1310', symbol: '#d9e8e0', dark: true },
}

function visible(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapX =
      Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
      Math.max(bounds.x, workArea.x)
    const overlapY =
      Math.min(bounds.y + bounds.height, workArea.y + workArea.height) -
      Math.max(bounds.y, workArea.y)
    return overlapX >= 120 && overlapY >= 80
  })
}

function loadState(): WindowState {
  try {
    const saved = readJsonFile<Partial<WindowState>>(paths.windowState(), {}, 'window position')
    const state = { ...DEFAULT_STATE, ...saved }
    state.width = Math.max(960, Math.min(state.width, 10000))
    state.height = Math.max(600, Math.min(state.height, 10000))
    if (state.x !== undefined && state.y !== undefined && !visible(state as Rectangle)) {
      delete state.x
      delete state.y
    }
    return state
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function openExternalSafely(raw: string): void {
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') void shell.openExternal(url.href)
  } catch {
    // Malformed links are ignored rather than handed to the operating system.
  }
}

export function resolveInitialChrome(theme: ThemeName, systemDark: boolean): WindowChrome {
  if (theme === 'system') return systemDark ? INITIAL_CHROME.dim : INITIAL_CHROME.light
  return INITIAL_CHROME[theme]
}

export function createMainWindow(options: {
  chrome: WindowChrome
  devServerUrl?: string
  onRendererGone: () => void
}): BrowserWindow {
  const state = loadState()
  const isMac = process.platform === 'darwin'
  const window = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'NatureQuery',
    backgroundColor: options.chrome.background,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 14, y: 13 } : undefined,
    titleBarOverlay: isMac
      ? undefined
      : {
          color: options.chrome.background,
          symbolColor: options.chrome.symbol,
          height: TITLE_BAR_HEIGHT,
        },
    icon: app.isPackaged ? undefined : path.join(paths.resources(), '..', 'build', 'icon.png'),
    webPreferences: {
      preload: paths.preload(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged || process.env.NQ_ENABLE_DEVTOOLS === '1',
    },
  })

  if (state.maximized) window.maximize()
  window.once('ready-to-show', () => window.show())

  // Persist size and position, ignoring maximized and full-screen bounds.
  let saveTimer: NodeJS.Timeout | undefined
  const saveState = () => {
    if (window.isDestroyed()) return
    const bounds = window.getNormalBounds()
    try {
      writeJsonFile(paths.windowState(), {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized: window.isMaximized(),
      } satisfies WindowState)
    } catch (error) {
      logger.warn('Could not save window position', error)
    }
  }
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveState, 600)
  }
  window.on('resize', scheduleSave)
  window.on('move', scheduleSave)
  window.on('maximize', scheduleSave)
  window.on('unmaximize', scheduleSave)
  window.on('close', () => {
    clearTimeout(saveTimer)
    saveState()
  })

  const contents = window.webContents
  // Only the bundled interface may load in this window. Links open in the browser.
  contents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url, options.devServerUrl)) return
    event.preventDefault()
    openExternalSafely(url)
  })
  contents.on('will-redirect', (event, url) => {
    if (isTrustedAppUrl(url, options.devServerUrl)) return
    event.preventDefault()
  })
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.on('before-input-event', (event, input) => {
    const action = zoomAction(input)
    if (action) {
      event.preventDefault()
      applyZoom(contents, action)
      return
    }
    const devToolsShortcut =
      input.type === 'keyDown' &&
      (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))
    if (devToolsShortcut && (!app.isPackaged || process.env.NQ_ENABLE_DEVTOOLS === '1')) {
      contents.toggleDevTools()
    }
  })
  contents.on('render-process-gone', (_event, details) => {
    logger.error('Renderer process gone', details)
    if (details.reason !== 'clean-exit') options.onRendererGone()
  })
  contents.on('unresponsive', () => logger.warn('Window became unresponsive'))
  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) logger.error('Interface failed to load', { code, description, url })
  })

  void window.loadURL(options.devServerUrl ?? `${APP_ORIGIN}/index.html`)
  return window
}

export function applyChrome(window: BrowserWindow, chrome: WindowChrome): void {
  window.setBackgroundColor(chrome.background)
  if (process.platform !== 'darwin') {
    window.setTitleBarOverlay({
      color: chrome.background,
      symbolColor: chrome.symbol,
      height: TITLE_BAR_HEIGHT,
    })
  }
}

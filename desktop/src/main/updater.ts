import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'

/**
 * Updates come from the GitHub releases in the publish settings. The app
 * checks on its own (when allowed in Settings), but downloads only after the
 * user agrees, and installs on "Restart and update" or when the app quits.
 */

const FIRST_CHECK_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface UpdaterOptions {
  packaged: boolean
  /** Installed from the Microsoft Store, which updates the app itself. */
  store?: boolean
  emit: (status: UpdateStatus) => void
  automaticChecks: () => boolean
  logger: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
}

export function plainNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
  const text = Array.isArray(notes)
    ? notes.map((entry) => entry.note ?? '').join('\n')
    : (notes ?? '')
  const plain = text
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return plain ? plain.slice(0, 2000) : undefined
}

export function friendlyError(error: unknown): string | null {
  const message = String((error as Error)?.message ?? error)
  // No release has been published yet: nothing to update to.
  if (/No published versions|Unable to find latest version|HttpError: 404/i.test(message))
    return null
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_|EAI_AGAIN|socket hang up/i.test(message)) {
    return 'Could not check for updates. Check your internet connection and try again.'
  }
  if (/sha512 checksum mismatch|signature/i.test(message)) {
    return 'The update download could not be verified, so it was not installed. Try again later.'
  }
  return 'Could not check for updates. Try again later.'
}

export function createUpdater(options: UpdaterOptions) {
  // Only the installer from GitHub releases updates itself.
  const selfUpdating = options.packaged && !options.store
  let status: UpdateStatus = selfUpdating
    ? { state: 'idle' }
    : {
        state: 'disabled',
        reason: options.store
          ? 'The Microsoft Store installs updates for you.'
          : 'Development builds do not update.',
      }
  let timer: NodeJS.Timeout | undefined

  function set(next: UpdateStatus) {
    status = next
    options.emit(next)
  }

  if (selfUpdating) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = options.logger
    autoUpdater.on('checking-for-update', () => set({ state: 'checking' }))
    autoUpdater.on('update-not-available', () =>
      set({ state: 'unavailable', checkedAt: new Date().toISOString() })
    )
    autoUpdater.on('update-available', (info) =>
      set({ state: 'available', version: info.version, notes: plainNotes(info.releaseNotes) })
    )
    autoUpdater.on('download-progress', (progress) => {
      const version =
        status.state === 'downloading' || status.state === 'available' ? status.version : ''
      set({ state: 'downloading', version, percent: Math.round(progress.percent) })
    })
    autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
    autoUpdater.on('error', (error) => {
      options.logger.warn('Update check failed', error)
      const message = friendlyError(error)
      set(
        message
          ? { state: 'error', message }
          : { state: 'unavailable', checkedAt: new Date().toISOString() }
      )
    })
  }

  async function check(): Promise<UpdateStatus> {
    if (!selfUpdating) return status
    if (status.state === 'downloading' || status.state === 'ready') return status
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      // Reported through the 'error' event.
    }
    return status
  }

  return {
    status: () => status,
    check,

    async download(): Promise<UpdateStatus> {
      if (status.state !== 'available') return status
      set({ state: 'downloading', version: status.version, percent: 0 })
      try {
        await autoUpdater.downloadUpdate()
      } catch {
        // Reported through the 'error' event.
      }
      return status
    },

    install(): void {
      if (status.state === 'ready') autoUpdater.quitAndInstall(false, true)
    },

    /** Checks shortly after start and then every few hours, while allowed in Settings. */
    start(): void {
      if (!selfUpdating) return
      const tick = () => {
        if (options.automaticChecks()) void check()
      }
      setTimeout(tick, FIRST_CHECK_DELAY_MS)
      timer = setInterval(tick, CHECK_INTERVAL_MS)
    },

    stop(): void {
      if (timer) clearInterval(timer)
    },
  }
}

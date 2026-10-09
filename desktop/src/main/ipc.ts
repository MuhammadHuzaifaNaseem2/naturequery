import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { fail, NqError, ok, toAppError } from '@shared/errors'
import type { Envelope } from '@shared/types'
import { logger } from './logger'
import { isTrustedAppUrl } from './protocol'

export interface IpcOptions {
  getWindow: () => BrowserWindow | null
  devServerUrl?: string
}

/**
 * Registers invoke handlers that accept requests only from the app's own
 * window, top frame and origin, and always answer with an Envelope.
 */
export function createIpc(options: IpcOptions) {
  function assertSender(event: IpcMainInvokeEvent) {
    const window = options.getWindow()
    const frame = event.senderFrame
    if (
      !window ||
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      !frame ||
      frame !== event.sender.mainFrame ||
      !isTrustedAppUrl(frame.url, options.devServerUrl)
    ) {
      throw new NqError('VALIDATION', 'This request was blocked.')
    }
  }

  function handle(channel: string, handler: (...args: unknown[]) => unknown): void {
    ipcMain.handle(channel, async (event, ...args): Promise<Envelope<unknown>> => {
      try {
        assertSender(event)
        const value = await handler(...args)
        // Handlers that already produce an Envelope (engine results) pass through.
        if (isEnvelope(value)) return value
        return ok(value)
      } catch (error) {
        if (!(error instanceof NqError)) logger.error(`IPC ${channel} failed`, error)
        return fail(toAppError(error))
      }
    })
  }

  return { handle }
}

const ENVELOPE = Symbol.for('nq.envelope')

/** Marks an engine result so the IPC layer forwards it unchanged. */
export function passThrough<T>(envelope: Envelope<T>): Envelope<T> {
  Object.defineProperty(envelope, ENVELOPE, { value: true, enumerable: false })
  return envelope
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return (
    !!value && typeof value === 'object' && (value as Record<symbol, unknown>)[ENVELOPE] === true
  )
}

import type { NqBridge } from '@shared/ipc'
import type { AppError, Envelope, ErrorCode } from '@shared/types'

declare global {
  interface Window {
    nq: NqBridge
  }
}

/** Error thrown by the client, carrying a user-facing message and hint. */
export class ClientError extends Error {
  readonly code: ErrorCode
  readonly hint?: string
  readonly detail?: string

  constructor(error: AppError) {
    super(error.message)
    this.name = 'ClientError'
    this.code = error.code
    this.hint = error.hint
    this.detail = error.detail
  }

  toAppError(): AppError {
    return { code: this.code, message: this.message, hint: this.hint, detail: this.detail }
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof ClientError) return error.toAppError()
  return {
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
    detail: error instanceof Error ? error.message : String(error),
  }
}

type Unwrapped<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<Envelope<infer R>>
    ? (...args: A) => Promise<R>
    : T[K]
}

async function unwrap<T>(pending: Promise<Envelope<T>>): Promise<T> {
  const envelope = await pending
  if (envelope.ok) return envelope.value
  throw new ClientError(envelope.error)
}

function wrapGroup<G extends object>(group: G): Unwrapped<G> {
  const wrapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(group)) {
    wrapped[key] =
      typeof value === 'function' && !key.startsWith('on')
        ? (...args: unknown[]) =>
            unwrap((value as (...a: unknown[]) => Promise<Envelope<unknown>>)(...args))
        : value
  }
  return wrapped as Unwrapped<G>
}

const bridge = window.nq

/** Promise-based API: resolves with the value, rejects with ClientError. */
export const api = {
  platform: bridge.platform,
  app: wrapGroup(bridge.app),
  settings: wrapGroup(bridge.settings),
  connections: wrapGroup(bridge.connections),
  db: wrapGroup(bridge.db),
  history: wrapGroup(bridge.history),
  saved: wrapGroup(bridge.saved),
  files: wrapGroup(bridge.files),
  clipboard: wrapGroup(bridge.clipboard),
  auth: wrapGroup(bridge.auth),
  ai: wrapGroup(bridge.ai),
  updates: wrapGroup(bridge.updates),
}

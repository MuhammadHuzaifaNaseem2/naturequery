import type { AppError, Envelope, ErrorCode } from './types'

/** An error that carries a user-facing message and an optional next step. */
export class NqError extends Error {
  readonly code: ErrorCode
  readonly hint?: string
  readonly detail?: string

  constructor(code: ErrorCode, message: string, options: { hint?: string; detail?: string } = {}) {
    super(message)
    this.name = 'NqError'
    this.code = code
    this.hint = options.hint
    this.detail = options.detail
  }

  toJSON(): AppError {
    return { code: this.code, message: this.message, hint: this.hint, detail: this.detail }
  }
}

export function isAppError(value: unknown): value is AppError {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as AppError).code === 'string' &&
    typeof (value as AppError).message === 'string'
  )
}

export function ok<T>(value: T): Envelope<T> {
  return { ok: true, value }
}

export function fail(error: AppError): Envelope<never> {
  return { ok: false, error }
}

export function toAppError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): AppError {
  if (error instanceof NqError) return error.toJSON()
  if (isAppError(error)) return error
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return { code: 'UNKNOWN', message: fallback, detail: message || undefined }
}

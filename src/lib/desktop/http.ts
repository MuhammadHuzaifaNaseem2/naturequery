import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { getClientIp, rateLimitAsync } from '@/lib/rate-limit'
import { authenticateAccessToken, type DesktopPrincipal } from './sessions'
import { bearerToken } from './tokens'

/**
 * Responses for the NatureQuery Desktop API. Every error has a stable `error`
 * code for the app and a `message` written for the person using it.
 */

const NO_STORE = { 'Cache-Control': 'no-store' }

export function desktopJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export function desktopError(
  status: number,
  error: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    { error, message, ...extra },
    { status, headers: { ...NO_STORE, ...headers } }
  )
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

/** Parses and validates a JSON body, refusing bodies over maxBytes. */
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 1_000_000
): Promise<T | NextResponse> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes) {
    return desktopError(413, 'too_large', 'This request is too large.')
  }
  let text: string
  try {
    text = await request.text()
  } catch {
    return desktopError(400, 'invalid_request', 'The request could not be read.')
  }
  if (text.length > maxBytes) return desktopError(413, 'too_large', 'This request is too large.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return desktopError(400, 'invalid_request', 'The request is not valid JSON.')
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return desktopError(400, 'invalid_request', `${issue?.message ?? 'Invalid request'}${where}.`)
  }
  return parsed.data
}

function rateLimited(retryAfterSeconds: number): NextResponse {
  const seconds = Math.max(1, retryAfterSeconds)
  return desktopError(
    429,
    'rate_limited',
    `Too many requests. Try again in ${seconds} seconds.`,
    { retryAfter: seconds },
    { 'Retry-After': String(seconds) }
  )
}

/** Rate limit by client IP, for endpoints used before signing in. */
export async function limitByIp(
  request: Request,
  name: string,
  maxRequests: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const result = await rateLimitAsync(`desktop:${name}:${getClientIp(request)}`, {
    maxRequests,
    windowSeconds,
  })
  return result.allowed ? null : rateLimited(result.retryAfterSeconds)
}

/** Requires a valid desktop access token, then applies a per-user rate limit. */
export async function requireDesktopUser(
  request: Request,
  limit: { name: string; maxRequests: number; windowSeconds: number }
): Promise<DesktopPrincipal | NextResponse> {
  const token = bearerToken(request.headers.get('authorization'))
  const principal = token ? await authenticateAccessToken(token) : null
  if (!principal) {
    return desktopError(
      401,
      'invalid_token',
      'Your sign-in has expired. Sign in to NatureQuery Desktop again.',
      {},
      { 'WWW-Authenticate': 'Bearer error="invalid_token"' }
    )
  }
  const result = await rateLimitAsync(`desktop:${limit.name}:${principal.userId}`, {
    maxRequests: limit.maxRequests,
    windowSeconds: limit.windowSeconds,
  })
  if (!result.allowed) return rateLimited(result.retryAfterSeconds)
  return principal
}

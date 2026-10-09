import crypto from 'node:crypto'

/**
 * Token helpers for NatureQuery Desktop sign-in.
 *
 * The desktop app signs in through the browser (OAuth 2.0 authorization code
 * flow with PKCE). Tokens are random, carry a recognizable prefix so leaked
 * values are easy to spot, and are stored only as SHA-256 hashes.
 */

export const ACCESS_TOKEN_PREFIX = 'nqd_at_'
export const REFRESH_TOKEN_PREFIX = 'nqd_rt_'
export const AUTH_CODE_PREFIX = 'nqd_code_'

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
export const AUTH_CODE_TTL_MS = 5 * 60 * 1000

/** RFC 7636: 43 to 128 characters from the unreserved set. */
const PKCE_VALUE = /^[A-Za-z0-9._~-]{43,128}$/

export function randomToken(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidCodeChallenge(challenge: string): boolean {
  // An S256 challenge is the base64url SHA-256 of the verifier: 43 characters.
  return /^[A-Za-z0-9_-]{43}$/.test(challenge)
}

/** Checks a PKCE verifier against the S256 challenge sent when the code was created. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!PKCE_VALUE.test(verifier) || !isValidCodeChallenge(challenge)) return false
  const computed = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url')
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Reads "Authorization: Bearer nqd_at_..." and returns the token, if well formed. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '')
  const token = match?.[1]
  return token && token.startsWith(ACCESS_TOKEN_PREFIX) && token.length < 200 ? token : null
}

/** Short, readable device names only; anything else is dropped. */
export function cleanDeviceName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return cleaned ? cleaned.slice(0, 80) : null
}

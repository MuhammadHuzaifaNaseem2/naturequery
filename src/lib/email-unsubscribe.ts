import { createHmac, timingSafeEqual } from 'crypto'

// Signed with the app secret, so the link in an email can turn off that person's
// weekly summary without signing in, and nobody can make a link for someone else.
const PURPOSE = 'weekly-summary-email'

function secret(): string | null {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || null
}

function sign(userId: string, key: string): string {
  return createHmac('sha256', key).update(`${PURPOSE}:${userId}`).digest('base64url')
}

/** Null when the app has no secret; then no summary email should go out. */
export function weeklySummaryUnsubscribeToken(userId: string): string | null {
  const key = secret()
  return key ? `${userId}.${sign(userId, key)}` : null
}

/** The account a token belongs to, or null when it was not made by this app. */
export function readWeeklySummaryUnsubscribeToken(token: unknown): string | null {
  const key = secret()
  if (!key || typeof token !== 'string' || token.length > 300) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const given = Buffer.from(token.slice(dot + 1))
  const expected = Buffer.from(sign(userId, key))
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null
}

export function weeklySummaryUnsubscribeUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, '')}/email/unsubscribe?t=${encodeURIComponent(token)}`
}

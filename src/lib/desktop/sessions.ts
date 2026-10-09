import { prisma } from '@/lib/prisma'
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_MS,
  AUTH_CODE_PREFIX,
  AUTH_CODE_TTL_MS,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_MS,
  hashToken,
  randomToken,
  verifyPkce,
} from './tokens'

/** Why a token request was refused. Shown to the desktop app as an OAuth error. */
export class DesktopAuthError extends Error {
  constructor(
    readonly code: 'invalid_grant' | 'invalid_request' | 'invalid_token',
    message: string
  ) {
    super(message)
  }
}

export interface DesktopTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: string; email: string; name: string | null; image: string | null }
}

export interface DeviceInfo {
  deviceName?: string | null
  platform?: string | null
  appVersion?: string | null
}

const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  image: true,
  passwordChangedAt: true,
} as const

// lastUsedAt is refreshed at most this often, to avoid a write on every request.
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000

function newTokenSet(now: number) {
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX)
  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX)
  return {
    accessToken,
    refreshToken,
    data: {
      accessTokenHash: hashToken(accessToken),
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
      refreshTokenHash: hashToken(refreshToken),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    },
  }
}

/** A password change signs out every desktop session created before it. */
function outdatedByPasswordChange(
  user: { passwordChangedAt: Date | null },
  session: { createdAt: Date }
): boolean {
  return !!user.passwordChangedAt && user.passwordChangedAt > session.createdAt
}

/** Called from the browser after the signed-in user approves the desktop app. */
export async function createAuthCode(
  userId: string,
  codeChallenge: string,
  deviceName: string | null
): Promise<string> {
  const code = randomToken(AUTH_CODE_PREFIX)
  await prisma.desktopAuthCode.create({
    data: {
      codeHash: hashToken(code),
      codeChallenge,
      userId,
      deviceName,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  })
  // Housekeeping: codes are single use and short lived.
  await prisma.desktopAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => {})
  return code
}

/** Exchanges a one-time code and its PKCE verifier for desktop tokens. */
export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
  device: DeviceInfo
): Promise<DesktopTokens> {
  const record = await prisma.desktopAuthCode.findUnique({
    where: { codeHash: hashToken(code) },
    include: { user: { select: USER_FIELDS } },
  })
  const invalid = new DesktopAuthError(
    'invalid_grant',
    'This sign-in code is not valid. Start signing in again from the desktop app.'
  )
  if (!record) throw invalid
  if (record.usedAt) throw invalid
  if (record.expiresAt.getTime() < Date.now()) {
    throw new DesktopAuthError(
      'invalid_grant',
      'This sign-in code has expired. Start signing in again from the desktop app.'
    )
  }
  if (!verifyPkce(codeVerifier, record.codeChallenge)) throw invalid

  // Mark the code used only if nobody else did first (codes are single use).
  const claimed = await prisma.desktopAuthCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) throw invalid

  const tokens = newTokenSet(Date.now())
  await prisma.desktopSession.create({
    data: {
      ...tokens.data,
      userId: record.userId,
      deviceName: device.deviceName ?? record.deviceName,
      platform: device.platform ?? null,
      appVersion: device.appVersion ?? null,
    },
  })
  const { passwordChangedAt: _ignored, ...user } = record.user
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    user,
  }
}

/**
 * A refresh retried this soon with the token it replaced is treated as the
 * same app retrying after a lost response, not as a stolen token.
 */
const REFRESH_RETRY_GRACE_MS = 60 * 1000

/** Issues new tokens for a refresh token. Each refresh token works once. */
export async function refreshDesktopSession(
  refreshToken: string,
  device: DeviceInfo
): Promise<DesktopTokens> {
  const tokenHash = hashToken(refreshToken)
  const signedOut = new DesktopAuthError(
    'invalid_grant',
    'You were signed out of NatureQuery Desktop. Sign in again.'
  )

  let session = await prisma.desktopSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { user: { select: USER_FIELDS } },
  })
  // The token matched the current one, or the one it replaced (retry or theft).
  let matched: 'refreshTokenHash' | 'previousRefreshTokenHash' = 'refreshTokenHash'
  if (!session) {
    session = await prisma.desktopSession.findUnique({
      where: { previousRefreshTokenHash: tokenHash },
      include: { user: { select: USER_FIELDS } },
    })
    if (!session) throw signedOut
    const retry =
      !session.revokedAt &&
      !!session.refreshedAt &&
      Date.now() - session.refreshedAt.getTime() < REFRESH_RETRY_GRACE_MS
    if (!retry) {
      // An old refresh token used again means a copy of it was taken: end the session.
      await revokeDesktopSession(session.id)
      throw signedOut
    }
    matched = 'previousRefreshTokenHash'
  }
  if (session.revokedAt || session.refreshExpiresAt.getTime() < Date.now()) throw signedOut
  if (outdatedByPasswordChange(session.user, session)) throw signedOut

  const tokens = newTokenSet(Date.now())
  const rotated = await prisma.desktopSession.updateMany({
    // Only rotate if no concurrent refresh already did.
    where: { id: session.id, [matched]: tokenHash, revokedAt: null },
    data: {
      ...tokens.data,
      previousRefreshTokenHash: tokenHash,
      refreshedAt: new Date(),
      lastUsedAt: new Date(),
      ...(device.appVersion ? { appVersion: device.appVersion } : {}),
    },
  })
  if (rotated.count !== 1) throw signedOut

  const { passwordChangedAt: _ignored, ...user } = session.user
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    user,
  }
}

export interface DesktopPrincipal {
  userId: string
  sessionId: string
}

/** Resolves an access token to its user, or null when it is not valid. */
export async function authenticateAccessToken(
  accessToken: string
): Promise<DesktopPrincipal | null> {
  const session = await prisma.desktopSession.findUnique({
    where: { accessTokenHash: hashToken(accessToken) },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      accessExpiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      user: { select: { passwordChangedAt: true } },
    },
  })
  if (!session || session.revokedAt) return null
  if (session.accessExpiresAt.getTime() < Date.now()) return null
  if (outdatedByPasswordChange(session.user, session)) return null

  if (Date.now() - session.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.desktopSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {})
  }
  return { userId: session.userId, sessionId: session.id }
}

export async function revokeDesktopSession(sessionId: string): Promise<void> {
  await prisma.desktopSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Signs out with a refresh token, for apps whose access token already expired. */
export async function revokeByRefreshToken(refreshToken: string): Promise<void> {
  await prisma.desktopSession.updateMany({
    where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function listDesktopSessions(userId: string) {
  return prisma.desktopSession.findMany({
    where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    select: {
      id: true,
      deviceName: true,
      platform: true,
      appVersion: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  })
}

/** Signs out one of the user's own desktop sessions (from the website's settings). */
export async function revokeOwnDesktopSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.desktopSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count === 1
}

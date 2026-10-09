import { z } from 'zod'
import { desktopPlanUsage } from '@/lib/desktop/account'
import { desktopError, desktopJson, isResponse, limitByIp, readJson } from '@/lib/desktop/http'
import {
  DesktopAuthError,
  exchangeAuthCode,
  refreshDesktopSession,
  type DesktopTokens,
} from '@/lib/desktop/sessions'
import { AUTH_CODE_PREFIX, REFRESH_TOKEN_PREFIX, cleanDeviceName } from '@/lib/desktop/tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const device = {
  device_name: z.string().max(200).optional(),
  platform: z.enum(['win32', 'darwin', 'linux']).optional(),
  app_version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/)
    .optional(),
}

const bodySchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().startsWith(AUTH_CODE_PREFIX).max(200),
    code_verifier: z.string().min(43).max(128),
    ...device,
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().startsWith(REFRESH_TOKEN_PREFIX).max(200),
    ...device,
  }),
])

/**
 * OAuth 2.0 token endpoint for NatureQuery Desktop: exchanges a one-time
 * sign-in code (with PKCE), or rotates a refresh token.
 */
export async function POST(request: Request) {
  const limited = await limitByIp(request, 'token', 30, 60)
  if (limited) return limited

  const body = await readJson(request, bodySchema, 8_000)
  if (isResponse(body)) return body

  const info = {
    deviceName: cleanDeviceName(body.device_name),
    platform: body.platform ?? null,
    appVersion: body.app_version ?? null,
  }
  let tokens: DesktopTokens
  try {
    tokens =
      body.grant_type === 'authorization_code'
        ? await exchangeAuthCode(body.code, body.code_verifier, info)
        : await refreshDesktopSession(body.refresh_token, info)
  } catch (error) {
    if (error instanceof DesktopAuthError) return desktopError(400, error.code, error.message)
    console.error('[desktop-token] failed:', error)
    return desktopError(500, 'server_error', 'Signing in failed. Try again in a moment.')
  }

  return desktopJson({
    token_type: 'Bearer',
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_in: tokens.expiresIn,
    user: tokens.user,
    plan: await desktopPlanUsage(tokens.user.id).catch(() => undefined),
  })
}

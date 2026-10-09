'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import { rateLimitAsync } from '@/lib/rate-limit'
import { createAuthCode } from '@/lib/desktop/sessions'
import { cleanDeviceName, isValidCodeChallenge } from '@/lib/desktop/tokens'

export type ApproveResult = { ok: true; code: string } | { ok: false; error: string }

/** Creates the one-time code that signs NatureQuery Desktop in as the current user. */
export async function approveDesktopSignIn(
  codeChallenge: string,
  deviceName?: string
): Promise<ApproveResult> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { ok: false, error: 'Your session has expired. Sign in again.' }
  if (typeof codeChallenge !== 'string' || !isValidCodeChallenge(codeChallenge)) {
    return { ok: false, error: 'This sign-in link is not valid. Start again from the desktop app.' }
  }

  const limit = await rateLimitAsync(`desktop:approve:${userId}`, {
    maxRequests: 10,
    windowSeconds: 60,
  })
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    }
  }

  const device = cleanDeviceName(deviceName)
  const code = await createAuthCode(userId, codeChallenge, device)

  const requestHeaders = await headers()
  await writeImmutableAuditLog({
    userId,
    action: 'DESKTOP_SIGN_IN_APPROVED',
    resource: 'desktopSession',
    metadata: { deviceName: device },
    ipAddress: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: requestHeaders.get('user-agent'),
  }).catch((error) => console.error('[desktop-authorize] audit log failed:', error))

  return { ok: true, code }
}

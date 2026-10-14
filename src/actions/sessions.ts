'use server'

import { auth } from '@/lib/auth'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import { revokeAllDesktopSessions } from '@/lib/desktop/sessions'
import { prisma } from '@/lib/prisma'
import { rateLimitAsync } from '@/lib/rate-limit'

/**
 * "Sign out of all devices": ends every browser session and every NatureQuery
 * Desktop session of the current user, including the one asking. It moves the
 * account's sign-out line (lib/session-revocation.ts): other browsers are signed
 * out at their next check, within about a minute; desktop installs at once. API
 * keys are separate and keep working.
 */
export async function signOutEverywhere(): Promise<{ ok: boolean }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { ok: false }

  const limit = await rateLimitAsync(`sign_out_everywhere:${userId}`, {
    maxRequests: 5,
    windowSeconds: 300,
  })
  if (!limit.allowed) return { ok: false }

  await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: new Date() } })
  const desktopSessions = await revokeAllDesktopSessions(userId)

  await writeImmutableAuditLog({
    userId,
    action: 'SIGNED_OUT_EVERYWHERE',
    resource: 'user',
    resourceId: userId,
    metadata: { desktopSessions },
  }).catch((error) => console.error('[sessions] audit log failed:', error))

  return { ok: true }
}

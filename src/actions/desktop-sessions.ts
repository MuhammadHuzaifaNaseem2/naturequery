'use server'

import { auth } from '@/lib/auth'
import { writeImmutableAuditLog } from '@/lib/audit-immutable'
import { revokeOwnDesktopSession } from '@/lib/desktop/sessions'

/** Signs out one of the current user's NatureQuery Desktop installs. */
export async function revokeMyDesktopSession(sessionId: string): Promise<{ ok: boolean }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId || typeof sessionId !== 'string' || !/^[a-z0-9]{10,40}$/.test(sessionId)) {
    return { ok: false }
  }
  const ok = await revokeOwnDesktopSession(userId, sessionId)
  if (ok) {
    await writeImmutableAuditLog({
      userId,
      action: 'DESKTOP_SESSION_REVOKED',
      resource: 'desktopSession',
      resourceId: sessionId,
    }).catch((error) => console.error('[desktop-sessions] audit log failed:', error))
  }
  return { ok }
}

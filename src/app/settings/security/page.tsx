import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listDesktopSessions } from '@/lib/desktop/sessions'
import SecurityClient from './SecurityClient'

export const metadata = { title: 'Security Settings' }

export default async function SecurityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Resolve 2FA status server-side so the client doesn't flash "Disabled"
  // for ~500ms while an initial /api/auth/2fa/status fetch completes.
  const [user, desktopSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
    listDesktopSessions(session.user.id),
  ])

  return (
    <SecurityClient
      initialTwoFactorEnabled={user?.twoFactorEnabled ?? false}
      desktopSessions={desktopSessions.map((desktop) => ({
        id: desktop.id,
        deviceName: desktop.deviceName,
        platform: desktop.platform,
        appVersion: desktop.appVersion,
        lastUsedAt: desktop.lastUsedAt.toISOString(),
      }))}
    />
  )
}

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listDesktopSessions } from '@/lib/desktop/sessions'
import SettingsClient from './SettingsClient'

export const metadata = { title: 'Settings | NatureQuery' }

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Resolve 2FA status server-side so the Security tab never flashes "Disabled".
  const [user, desktopSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
    listDesktopSessions(session.user.id),
  ])

  return (
    <SettingsClient
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

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SettingsClient from './SettingsClient'

export const metadata = { title: 'Settings — NatureQuery' }

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Resolve 2FA status server-side so the Security tab never flashes "Disabled".
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  })

  return <SettingsClient initialTwoFactorEnabled={user?.twoFactorEnabled ?? false} />
}

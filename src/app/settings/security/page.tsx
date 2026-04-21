import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SecurityClient from './SecurityClient'

export const metadata = { title: 'Security Settings — NatureQuery' }

export default async function SecurityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Resolve 2FA status server-side so the client doesn't flash "Disabled"
  // for ~500ms while an initial /api/auth/2fa/status fetch completes.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  })

  return <SecurityClient initialTwoFactorEnabled={user?.twoFactorEnabled ?? false} />
}

'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Whether the Monday summary email is on, and whether this account's plan includes summaries. */
export async function getWeeklySummaryEmail(): Promise<{
  success: boolean
  enabled?: boolean
  included?: boolean
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { weeklySummaryEmail: true, subscription: { select: { plan: true, status: true } } },
  })
  if (!user) return { success: false, error: 'User not found' }

  const plan = user.subscription
  return {
    success: true,
    enabled: user.weeklySummaryEmail,
    included: plan?.status === 'ACTIVE' && (plan.plan === 'PRO' || plan.plan === 'ENTERPRISE'),
  }
}

export async function setWeeklySummaryEmail(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { weeklySummaryEmail: enabled === true },
  })
  return { success: true }
}

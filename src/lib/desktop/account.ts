import { prisma } from '@/lib/prisma'
import { checkPlanLimits } from '@/lib/plan-limits'

export interface DesktopPlanUsage {
  planName: string
  /** -1 means unlimited. */
  queryLimit: number
  queriesUsed: number
  /** When the monthly allowance starts over. */
  periodEndsAt: string
}

function startOfMonth(now = new Date()): Date {
  const start = new Date(now)
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  return start
}

/** The user's plan and how many AI questions they have used this month. */
export async function desktopPlanUsage(userId: string): Promise<DesktopPlanUsage> {
  const check = await checkPlanLimits(userId, 'QUERY')
  const since = startOfMonth()
  // Unlimited plans report 0 used; count anyway so the app can show activity.
  const used =
    check.limit === -1
      ? await prisma.usageRecord.count({
          where: { userId, action: 'QUERY', createdAt: { gte: since } },
        })
      : check.current
  const next = new Date(since)
  next.setMonth(next.getMonth() + 1)
  return {
    planName: check.planName,
    queryLimit: check.limit,
    queriesUsed: used,
    periodEndsAt: next.toISOString(),
  }
}

export async function desktopUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true },
  })
}

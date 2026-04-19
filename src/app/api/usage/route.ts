import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANS, type PlanKey } from '@/lib/stripe'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Admin gets unlimited everything
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (dbUser?.role === 'ADMIN') {
      return NextResponse.json({
        plan: 'ENTERPRISE',
        usage: {
          queries: { current: 0, limit: -1 },
          connections: { current: 0, limit: -1 },
          teamMembers: { current: 0, limit: -1 },
        },
      })
    }

    // Get or create subscription
    let sub = await prisma.subscription.findUnique({ where: { userId } })
    if (!sub) {
      sub = await prisma.subscription.create({
        data: { userId, plan: 'FREE', status: 'ACTIVE' },
      })
    }

    const plan = PLANS[sub.plan as PlanKey]

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [queryCount, connectionCount, teamMemberCount] = await Promise.all([
      prisma.usageRecord.count({
        where: { userId, action: 'QUERY', createdAt: { gte: startOfMonth } },
      }),
      prisma.databaseConnection.count({ where: { userId } }),
      (async () => {
        const ownedTeams = await prisma.teamMember.findMany({
          where: { userId, role: 'OWNER' },
          select: { teamId: true },
        })
        const teamIds = ownedTeams.map((t) => t.teamId)
        if (teamIds.length === 0) return 0
        return prisma.teamMember.count({
          where: {
            teamId: { in: teamIds },
            userId: { not: userId },
          },
        })
      })(),
    ])

    return NextResponse.json({
      plan: sub.plan,
      usage: {
        queries: { current: queryCount, limit: plan.limits.queriesPerMonth },
        connections: { current: connectionCount, limit: plan.limits.connections },
        teamMembers: { current: teamMemberCount, limit: plan.limits.teamMembers },
      },
    })
  } catch (error) {
    console.error('GET /api/usage error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}

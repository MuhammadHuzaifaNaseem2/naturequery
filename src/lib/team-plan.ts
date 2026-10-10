import { effectiveSubscriptionPlan } from '@/lib/billing-lifecycle'
import { PLANS, type PlanKey } from '@/lib/lemonsqueezy'
import { prisma } from '@/lib/prisma'

/** Higher is better. */
export const PLAN_RANK: Record<PlanKey, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 }

export interface TeamPlan {
  plan: PlanKey
  teamId: string
  teamName: string
}

/**
 * Whether a member holds one of the owner's seats. A plan covers the first
 * `seats` people the owner invited, counted once each across all the owner's
 * teams; -1 means every member.
 */
export function holdsSeat(userId: string, membersInOrder: string[], seats: number): boolean {
  if (seats === -1) return true
  return [...new Set(membersInOrder)].slice(0, Math.max(0, seats)).includes(userId)
}

async function membersInSeatOrder(ownerId: string): Promise<string[]> {
  const owned = await prisma.teamMember.findMany({
    where: { userId: ownerId, role: 'OWNER', status: 'ACCEPTED' },
    select: { teamId: true },
  })
  if (owned.length === 0) return []
  const members = await prisma.teamMember.findMany({
    where: {
      teamId: { in: owned.map((team) => team.teamId) },
      status: 'ACCEPTED',
      userId: { not: ownerId },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { userId: true },
  })
  return members.map((member) => member.userId)
}

/**
 * The best paid plan a user gets from the teams they have joined: the team
 * owner's own plan, while the user holds one of its seats. Only owners' own
 * subscriptions count, so a covered member cannot pass the plan on.
 */
export async function teamPlanFor(userId: string, now = new Date()): Promise<TeamPlan | null> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId, status: 'ACCEPTED', role: { not: 'OWNER' } },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          members: {
            where: { role: 'OWNER', status: 'ACCEPTED' },
            select: { userId: true, user: { select: { subscription: true } } },
          },
        },
      },
    },
  })

  let best: TeamPlan | null = null
  for (const { team } of memberships) {
    for (const owner of team.members) {
      const subscription = owner.user.subscription
      if (!subscription) continue
      const plan = effectiveSubscriptionPlan(subscription, now) as PlanKey
      if (plan === 'FREE' || (best && PLAN_RANK[plan] <= PLAN_RANK[best.plan])) continue
      const seats = PLANS[plan].limits.teamMembers
      if (!holdsSeat(userId, await membersInSeatOrder(owner.userId), seats)) continue
      best = { plan, teamId: team.id, teamName: team.name }
    }
  }
  return best
}

/** The team plan when it is better than the user's own plan, otherwise null. */
export async function betterTeamPlan(
  userId: string,
  ownPlan: PlanKey,
  now = new Date()
): Promise<TeamPlan | null> {
  if (ownPlan === 'ENTERPRISE') return null
  const team = await teamPlanFor(userId, now)
  return team && PLAN_RANK[team.plan] > PLAN_RANK[ownPlan] ? team : null
}

'use server'

import { prisma } from '@/lib/prisma'
import { PLANS, type PlanKey } from '@/lib/lemonsqueezy'
import { effectiveSubscriptionPlan } from '@/lib/billing-lifecycle'
import { betterTeamPlan } from '@/lib/team-plan'

export type LimitedAction =
  | 'QUERY'
  | 'CONNECTION_ADD'
  | 'TEAM_INVITE'
  | 'TEAM_CREATE'
  | 'SAVE_QUERY'
  | 'DASHBOARD_WIDGET'
  | 'SCHEDULED_QUERY'
  | 'API_KEY'
  | 'SHARE_QUERY'

export interface LimitCheckResult {
  allowed: boolean
  current: number
  limit: number // -1 means unlimited
  planName: string
  /** Set when the plan comes from a team the user has joined. */
  teamName?: string
}

export async function checkPlanLimits(
  userId: string,
  action: LimitedAction
): Promise<LimitCheckResult> {
  // Admins have unlimited access to everything
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') {
    return { allowed: true, current: 0, limit: -1, planName: 'Admin' }
  }

  const applied = await appliedPlan(userId, action)
  const result = await limitFor(userId, action, PLANS[applied.plan])
  return applied.teamName ? { ...result, teamName: applied.teamName } : result
}

/** The user's own plan from their subscription (FREE by default). */
async function ownPlan(userId: string): Promise<PlanKey> {
  let sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { userId, plan: 'FREE', status: 'ACTIVE' },
    })
  }
  if (sub.status === 'TRIALING' && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date()) {
    // Trial expired — downgrade to FREE in database
    await prisma.subscription.update({
      where: { userId },
      data: { plan: 'FREE', status: 'ACTIVE', trialEndsAt: null },
    })
    return 'FREE'
  }
  // Cancelled subscriptions retain plan benefits until the paid period ends;
  // PAST_DUE, INCOMPLETE and expired CANCELED subscriptions get FREE limits.
  return effectiveSubscriptionPlan(sub) as PlanKey
}

/** Creating teams and inviting people depend on the user's own plan. */
const OWN_PLAN_ONLY: ReadonlySet<LimitedAction> = new Set(['TEAM_CREATE', 'TEAM_INVITE'])

/** The plan whose limits apply: the user's own, or a better one from a team they joined. */
async function appliedPlan(
  userId: string,
  action: LimitedAction
): Promise<{ plan: PlanKey; teamName?: string }> {
  const own = await ownPlan(userId)
  if (OWN_PLAN_ONLY.has(action)) return { plan: own }
  const team = await betterTeamPlan(userId, own)
  return team ? { plan: team.plan, teamName: team.teamName } : { plan: own }
}

async function limitFor(
  userId: string,
  action: LimitedAction,
  plan: (typeof PLANS)[PlanKey]
): Promise<LimitCheckResult> {
  switch (action) {
    case 'QUERY': {
      const limit = plan.limits.queriesPerMonth
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const count = await prisma.usageRecord.count({
        where: {
          userId,
          action: 'QUERY',
          createdAt: { gte: startOfMonth },
        },
      })

      return { allowed: count < limit, current: count, limit, planName: plan.name }
    }

    case 'CONNECTION_ADD': {
      const limit = plan.limits.connections
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }

      const count = await prisma.databaseConnection.count({ where: { userId } })
      return { allowed: count < limit, current: count, limit, planName: plan.name }
    }

    case 'TEAM_INVITE': {
      const limit = plan.limits.teamMembers
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }
      if (limit === 0) return { allowed: false, current: 0, limit: 0, planName: plan.name }

      // Count members across all teams the user owns (excluding the owner)
      const ownedTeams = await prisma.teamMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { teamId: true },
      })
      const teamIds = ownedTeams.map((t) => t.teamId)

      const memberCount =
        teamIds.length > 0
          ? await prisma.teamMember.count({
              where: {
                teamId: { in: teamIds },
                userId: { not: userId },
              },
            })
          : 0

      return { allowed: memberCount < limit, current: memberCount, limit, planName: plan.name }
    }

    case 'TEAM_CREATE': {
      // Team creation requires at least PRO (teamMembers > 0)
      const limit = plan.limits.teamMembers
      if (limit === 0) return { allowed: false, current: 0, limit: 0, planName: plan.name }
      return { allowed: true, current: 0, limit, planName: plan.name }
    }

    case 'SAVE_QUERY': {
      const limit = plan.limits.savedQueries
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }

      const count = await prisma.savedQuery.count({
        where: { userId, isTemplate: false },
      })
      return { allowed: count < limit, current: count, limit, planName: plan.name }
    }

    case 'DASHBOARD_WIDGET': {
      const limit = plan.limits.dashboardWidgets
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }
      if (limit === 0) return { allowed: false, current: 0, limit: 0, planName: plan.name }

      const count = await prisma.dashboardWidget.count({ where: { userId } })
      return { allowed: count < limit, current: count, limit, planName: plan.name }
    }

    case 'SCHEDULED_QUERY': {
      const limit = plan.limits.scheduledQueries
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }
      if (limit === 0) return { allowed: false, current: 0, limit: 0, planName: plan.name }

      const count = await prisma.scheduledQuery.count({ where: { userId } })
      return { allowed: count < limit, current: count, limit, planName: plan.name }
    }

    case 'API_KEY': {
      const limit = plan.limits.apiKeys as number
      if (limit === -1) return { allowed: true, current: 0, limit: -1, planName: plan.name }
      if (limit === 0) return { allowed: false, current: 0, limit: 0, planName: plan.name }

      const count = await prisma.apiKey.count({ where: { userId } })
      return { allowed: count < limit, current: count, limit, planName: plan.name }
    }

    case 'SHARE_QUERY': {
      // Sharing requires PRO or above (apiKeys > 0 is a proxy; use dashboardWidgets limit instead)
      // We allow sharing on PRO+ only — free users get a clear upgrade prompt
      const limit = plan.limits.dashboardWidgets
      if (limit === 0) return { allowed: false, current: 0, limit: 0, planName: plan.name }
      return { allowed: true, current: 0, limit, planName: plan.name }
    }
  }
}

export async function recordUsage(userId: string, action: LimitedAction) {
  await prisma.usageRecord.create({
    data: { userId, action },
  })
}

/**
 * Atomically check the QUERY limit and record usage in a single transaction.
 * Returns { allowed: true } if within quota (and records the usage),
 * or { allowed: false, current, limit } if over quota (no record created).
 */
export async function checkAndRecordQuery(userId: string): Promise<LimitCheckResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role === 'ADMIN') {
    await prisma.usageRecord.create({ data: { userId, action: 'QUERY' } })
    return { allowed: true, current: 0, limit: -1, planName: 'Admin' }
  }

  const { plan: planKey, teamName } = await appliedPlan(userId, 'QUERY')
  const plan = PLANS[planKey]
  const limit = plan.limits.queriesPerMonth
  if (limit === -1) {
    await prisma.usageRecord.create({ data: { userId, action: 'QUERY' } })
    return { allowed: true, current: 0, limit: -1, planName: plan.name, teamName }
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Use serializable transaction to prevent race conditions
  return prisma.$transaction(async (tx) => {
    const count = await tx.usageRecord.count({
      where: { userId, action: 'QUERY', createdAt: { gte: startOfMonth } },
    })
    if (count >= limit) {
      return { allowed: false, current: count, limit, planName: plan.name, teamName }
    }
    await tx.usageRecord.create({ data: { userId, action: 'QUERY' } })
    return { allowed: true, current: count + 1, limit, planName: plan.name, teamName }
  })
}

/**
 * After recording a QUERY, check whether the user has crossed the 80% or 100%
 * threshold for their monthly quota and fire a single in-app notification.
 * Deduplicates via a marker in the notification metadata so the same alert
 * is not created more than once per calendar month.
 */
export async function maybeNotifyQueryThreshold(userId: string): Promise<void> {
  try {
    const check = await checkPlanLimits(userId, 'QUERY')
    if (check.limit === -1) return // unlimited plan — no threshold

    const pct = Math.round((check.current / check.limit) * 100)

    // Determine which threshold we've crossed (highest takes priority)
    let threshold: 100 | 80 | 50 | null = null
    if (check.current >= check.limit) threshold = 100
    else if (pct >= 80) threshold = 80
    else if (pct >= 50) threshold = 50
    if (!threshold) return

    // Dedup key: one notification per threshold per calendar month
    const monthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
    const dedupKey = `query_threshold_${threshold}_${monthKey}`

    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'threshold_alert',
        metadata: { path: ['dedupKey'], equals: dedupKey },
      },
    })
    if (existing) return // already notified this month

    const { title, message } =
      threshold === 100
        ? {
            title: 'Monthly query limit reached',
            message: `You've used all ${check.limit} queries on the Free plan this month. Upgrade to Pro for unlimited queries.`,
          }
        : threshold === 80
          ? {
              title: `${pct}% of monthly queries used`,
              message: `You've run ${check.current} of ${check.limit} queries this month. You're close to the limit — upgrade before you run out.`,
            }
          : {
              title: 'Halfway through your monthly queries',
              message: `You've used ${check.current} of ${check.limit} queries this month. Upgrade to Pro for unlimited queries.`,
            }

    await prisma.notification.create({
      data: {
        userId,
        type: 'threshold_alert',
        title,
        message,
        metadata: { dedupKey, threshold, current: check.current, limit: check.limit } as any,
      },
    })
  } catch {
    // Never let notification errors break the main query flow
  }
}

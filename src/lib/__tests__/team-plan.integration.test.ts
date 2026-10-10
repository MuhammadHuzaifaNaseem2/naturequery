// @vitest-environment node
import crypto from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A team owner's paid plan covers the team's members, within the plan's seats.
 * Runs against a disposable PostgreSQL database, like the desktop sign-in
 * tests: NQ_WEB_IT=1 and a DATABASE_URL on localhost (never production).
 */
const enabled =
  process.env.NQ_WEB_IT === '1' && /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')

const session = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth', () => ({
  auth: async () => (session.userId ? { user: { id: session.userId, role: 'USER' } } : null),
}))
vi.mock('@/actions/onboarding-checklist', () => ({ updateChecklistItem: async () => ({}) }))

describe.skipIf(!enabled)('team plans', async () => {
  const { prisma } = await import('@/lib/prisma')
  const { checkPlanLimits, checkAndRecordQuery } = await import('@/lib/plan-limits')
  const { inviteTeamMember } = await import('@/actions/team')
  const { getUserSubscription } = await import('@/actions/billing')
  const { desktopPlanUsage } = await import('@/lib/desktop/account')

  const run = crypto.randomUUID().slice(0, 8)
  const userIds: string[] = []
  const teamIds: string[] = []

  async function user(name: string, plan?: 'PRO' | 'ENTERPRISE') {
    const created = await prisma.user.create({
      data: { email: `team-plan-${run}-${name}@example.com`, name },
    })
    userIds.push(created.id)
    await prisma.subscription.create({
      data: { userId: created.id, plan: plan ?? 'FREE', status: 'ACTIVE' },
    })
    return created.id
  }

  async function team(name: string, ownerId: string) {
    const created = await prisma.team.create({
      data: {
        name,
        slug: `${name.toLowerCase()}-${run}`,
        members: { create: { userId: ownerId, role: 'OWNER', status: 'ACCEPTED' } },
      },
    })
    teamIds.push(created.id)
    return created.id
  }

  async function join(teamId: string, userId: string, status: 'ACCEPTED' | 'PENDING' = 'ACCEPTED') {
    await prisma.teamMember.create({ data: { teamId, userId, role: 'MEMBER', status } })
  }

  let owner = ''
  let acme = ''

  beforeAll(async () => {
    owner = await user('owner', 'PRO')
    acme = await team('Acme', owner)
  })

  beforeEach(async () => {
    session.userId = ''
    await prisma.subscription.update({
      where: { userId: owner },
      data: { plan: 'PRO', status: 'ACTIVE', currentPeriodEnd: null },
    })
  })

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    await prisma.$disconnect()
  })

  it('gives accepted members the owner’s plan, with the team’s name', async () => {
    const member = await user('member')
    await join(acme, member)
    expect(await checkPlanLimits(member, 'QUERY')).toMatchObject({
      allowed: true,
      limit: -1,
      planName: 'Pro',
      teamName: 'Acme',
    })
    expect(await checkAndRecordQuery(member)).toMatchObject({ limit: -1, teamName: 'Acme' })
    expect(await desktopPlanUsage(member)).toMatchObject({
      planName: 'Pro',
      queryLimit: -1,
      teamName: 'Acme',
    })

    session.userId = member
    const billing = await getUserSubscription()
    expect(billing.plan).toBe('FREE')
    expect(billing.teamPlan).toEqual({ teamName: 'Acme', planName: 'Pro' })
    expect(billing.effectiveLimits.queriesPerMonth).toBe(-1)
    expect(billing.effectiveLimits.teamMembers).toBe(0)
  })

  it('does not cover pending invites', async () => {
    const pending = await user('pending')
    await join(acme, pending, 'PENDING')
    const check = await checkPlanLimits(pending, 'QUERY')
    expect(check).toMatchObject({ limit: 50, planName: 'Free' })
    expect(check.teamName).toBeUndefined()
  })

  it('stops covering members when the owner’s payment lapses, but not after a cancellation', async () => {
    const member = await user('lapse')
    await join(acme, member)
    await prisma.subscription.update({ where: { userId: owner }, data: { status: 'PAST_DUE' } })
    expect(await checkPlanLimits(member, 'QUERY')).toMatchObject({ limit: 50, planName: 'Free' })

    await prisma.subscription.update({
      where: { userId: owner },
      data: { status: 'CANCELED', currentPeriodEnd: new Date(Date.now() + 86_400_000) },
    })
    expect(await checkPlanLimits(member, 'QUERY')).toMatchObject({ limit: -1, teamName: 'Acme' })
  })

  it('keeps team management on the member’s own plan, so the plan is not passed on', async () => {
    const member = await user('passer')
    await join(acme, member)
    expect((await checkPlanLimits(member, 'TEAM_CREATE')).allowed).toBe(false)

    const own = await team('Side', member)
    const friend = await user('friend')
    await join(own, friend)
    expect(await checkPlanLimits(friend, 'QUERY')).toMatchObject({ limit: 50, planName: 'Free' })
  })

  it('covers only as many members as the plan has seats', async () => {
    const seatsOwner = await user('seats', 'PRO')
    const seats = await team('Seats', seatsOwner)
    const members: string[] = []
    for (let i = 0; i < 6; i++) {
      const id = await user(`seat${i}`)
      await join(seats, id)
      members.push(id)
    }
    expect(await checkPlanLimits(members[4], 'QUERY')).toMatchObject({ limit: -1 })
    expect(await checkPlanLimits(members[5], 'QUERY')).toMatchObject({ limit: 50 })

    await prisma.subscription.update({
      where: { userId: seatsOwner },
      data: { plan: 'ENTERPRISE' },
    })
    expect(await checkPlanLimits(members[5], 'QUERY')).toMatchObject({
      limit: -1,
      planName: 'Enterprise',
    })
  })

  it('counts seats against the owner’s plan when an admin invites', async () => {
    const freeOwner = await user('freeowner')
    const freeTeam = await team('Freebies', freeOwner)
    const admin = await user('admin', 'ENTERPRISE')
    await prisma.teamMember.create({
      data: { teamId: freeTeam, userId: admin, role: 'ADMIN', status: 'ACCEPTED' },
    })
    const invitee = await user('invitee')

    session.userId = admin
    const result = await inviteTeamMember(freeTeam, `team-plan-${run}-invitee@example.com`)
    expect(result).toMatchObject({ success: false })
    expect(result.error).toContain("team owner's plan")
    expect(await prisma.teamMember.count({ where: { teamId: freeTeam, userId: invitee } })).toBe(0)

    session.userId = owner
    const invited = await inviteTeamMember(acme, `team-plan-${run}-invitee@example.com`)
    expect(invited).toMatchObject({ success: true })
  })
})

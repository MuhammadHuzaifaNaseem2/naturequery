import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  subscription: vi.fn(),
  update: vi.fn(),
  member: vi.fn(),
  memberUpdate: vi.fn(),
  memberDelete: vi.fn(),
  provider: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'user-a', role: 'USER' } }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.user },
    subscription: { findUnique: mocks.subscription, update: mocks.update },
    teamMember: {
      findUnique: mocks.member,
      update: mocks.memberUpdate,
      delete: mocks.memberDelete,
    },
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('@/lib/lemonsqueezy', () => ({
  setupLemonSqueezy: vi.fn(),
  isLemonSqueezyEnabled: () => true,
  PLANS: {},
}))
vi.mock('@lemonsqueezy/lemonsqueezy.js', () => ({ getSubscription: mocks.provider }))
vi.mock('@/lib/plan-limits', () => ({ checkPlanLimits: vi.fn() }))
vi.mock('@/actions/onboarding-checklist', () => ({ updateChecklistItem: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimitAsync: vi.fn() }))
import { syncBySubscriptionId } from '@/actions/billing'
import { requireTeamPermission } from '@/lib/permissions'
import { updateMemberRole, removeTeamMember } from '@/actions/team'
const teamId = 'cl000000000000000000000001'
const memberId = 'cl000000000000000000000002'
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('LEMONSQUEEZY_STORE_ID', 'store')
  vi.stubEnv('LEMONSQUEEZY_PRO_VARIANT_ID', 'pro')
  mocks.user.mockResolvedValue({ email: 'a@example.invalid', emailVerified: new Date() })
  mocks.subscription.mockResolvedValue(null)
  mocks.provider.mockResolvedValue({
    data: {
      data: {
        id: 'sub',
        attributes: {
          store_id: 'store',
          customer_id: 'customer',
          user_email: 'a@example.invalid',
          variant_id: 'pro',
          status: 'active',
          created_at: '2026-09-14T09:00:00.000Z',
          updated_at: '2026-09-14T10:00:00.000Z',
          renews_at: '2026-10-14T10:00:00.000Z',
        },
      },
    },
  })
})
afterEach(() => vi.unstubAllEnvs())
describe('Subscription ownership', () => {
  it('rejects another customer subscription without changing billing', async () => {
    mocks.user.mockResolvedValue({ email: 'b@example.invalid', emailVerified: new Date() })
    await expect(syncBySubscriptionId('sub')).rejects.toThrow('ownership')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects unverified account emails', async () => {
    mocks.user.mockResolvedValue({ email: 'a@example.invalid', emailVerified: null })
    await expect(syncBySubscriptionId('sub')).rejects.toThrow('ownership')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects subscriptions already bound to another account', async () => {
    mocks.subscription.mockResolvedValue({ userId: 'user-b' })
    await expect(syncBySubscriptionId('sub')).rejects.toThrow('another account')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects a provider customer that differs from the linked customer', async () => {
    mocks.subscription.mockResolvedValue({ userId: 'user-a', stripeCustomerId: 'other-customer' })
    await expect(syncBySubscriptionId('sub')).rejects.toThrow('ownership')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('accepts matching verified owner and configured plan', async () => {
    await syncBySubscriptionId('sub')
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-a' },
        data: expect.objectContaining({
          plan: 'PRO',
          currentPeriodStart: new Date('2026-09-14T09:00:00.000Z'),
        }),
      })
    )
  })
})
describe('Team access', () => {
  it('rejects pending members', async () => {
    mocks.member.mockResolvedValue({ teamId, role: 'ADMIN', status: 'PENDING' })
    await expect(requireTeamPermission(teamId, 'query:execute')).rejects.toThrow('Forbidden')
  })
  it('rejects viewer query execution', async () => {
    mocks.member.mockResolvedValue({ teamId, role: 'VIEWER', status: 'ACCEPTED' })
    await expect(requireTeamPermission(teamId, 'query:execute')).rejects.toThrow('Forbidden')
  })
  it('allows accepted member query execution', async () => {
    mocks.member.mockResolvedValue({ teamId, role: 'MEMBER', status: 'ACCEPTED' })
    await expect(requireTeamPermission(teamId, 'query:execute')).resolves.toMatchObject({ teamId })
  })
  it('prevents cross-team role changes', async () => {
    mocks.member
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACCEPTED' })
      .mockResolvedValueOnce({ teamId: 'other-team', role: 'MEMBER' })
    expect((await updateMemberRole(teamId, memberId, 'ADMIN')).success).toBe(false)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })
  it('prevents cross-team removal even for self', async () => {
    mocks.member.mockResolvedValue({ teamId: 'other-team', userId: 'user-a', role: 'MEMBER' })
    expect((await removeTeamMember(teamId, memberId)).success).toBe(false)
    expect(mocks.memberDelete).not.toHaveBeenCalled()
  })
  it('prevents owner self-removal', async () => {
    mocks.member.mockResolvedValue({ teamId, userId: 'user-a', role: 'OWNER' })
    expect((await removeTeamMember(teamId, memberId)).success).toBe(false)
    expect(mocks.memberDelete).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  verifyPassword: vi.fn(),
  billingEnabled: vi.fn(),
  providerGet: vi.fn(),
  providerCancel: vi.fn(),
  userFind: vi.fn(),
  subscriptionFind: vi.fn(),
  transaction: vi.fn(),
  deleteMany: vi.fn(),
  userDelete: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/encryption', () => ({ verifyPassword: mocks.verifyPassword }))
vi.mock('@/lib/lemonsqueezy', () => ({
  isLemonSqueezyEnabled: mocks.billingEnabled,
  setupLemonSqueezy: vi.fn(),
}))
vi.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
  getSubscription: mocks.providerGet,
  cancelSubscription: mocks.providerCancel,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFind, delete: mocks.userDelete },
    subscription: { findUnique: mocks.subscriptionFind, deleteMany: mocks.deleteMany },
    auditLog: { deleteMany: mocks.deleteMany },
    queryHistory: { deleteMany: mocks.deleteMany },
    savedQuery: { deleteMany: mocks.deleteMany },
    dashboardWidget: { deleteMany: mocks.deleteMany },
    scheduledQuery: { deleteMany: mocks.deleteMany },
    databaseConnection: { deleteMany: mocks.deleteMany },
    apiKey: { deleteMany: mocks.deleteMany },
    usageRecord: { deleteMany: mocks.deleteMany },
    verificationToken: { deleteMany: mocks.deleteMany },
    passwordResetToken: { deleteMany: mocks.deleteMany },
    $transaction: mocks.transaction,
  },
}))

import { DELETE } from '@/app/api/account/delete/route'

function request() {
  return new Request('http://localhost/api/account/delete', {
    method: 'DELETE',
    body: JSON.stringify({ password: 'correct-password' }),
    headers: { 'content-type': 'application/json' },
  })
}

function providerAttributes(overrides: Record<string, unknown> = {}) {
  return {
    store_id: 'store-1',
    customer_id: 'customer-1',
    user_email: 'owner@example.com',
    status: 'active',
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env.LEMONSQUEEZY_STORE_ID = 'store-1'
  mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.verifyPassword.mockResolvedValue(true)
  mocks.billingEnabled.mockReturnValue(true)
  mocks.userFind.mockResolvedValue({
    id: 'user-1',
    email: 'owner@example.com',
    emailVerified: new Date(),
    password: 'password-hash',
  })
  mocks.subscriptionFind.mockResolvedValue({
    stripeSubscriptionId: 'subscription-1',
    stripeCustomerId: 'customer-1',
  })
  mocks.providerGet.mockResolvedValue({
    data: { data: { id: 'subscription-1', attributes: providerAttributes() } },
  })
  mocks.providerCancel.mockResolvedValue({ data: { data: { id: 'subscription-1' } } })
  mocks.deleteMany.mockResolvedValue({ count: 0 })
  mocks.userDelete.mockResolvedValue({ id: 'user-1' })
  mocks.transaction.mockResolvedValue([])
})

describe('account deletion with provider billing', () => {
  it('cancels an active provider subscription before deleting local data', async () => {
    const response = await DELETE(request())
    expect(response.status).toBe(200)
    expect(mocks.providerCancel).toHaveBeenCalledWith('subscription-1')
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.providerCancel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.transaction.mock.invocationCallOrder[0]
    )
  })

  it('keeps the account when provider cancellation fails', async () => {
    mocks.providerCancel.mockResolvedValue({ error: { message: 'provider unavailable' } })
    const response = await DELETE(request())
    expect(response.status).toBe(502)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('keeps the account when billing ownership cannot be verified', async () => {
    mocks.providerGet.mockResolvedValue({
      data: {
        data: { id: 'subscription-1', attributes: providerAttributes({ customer_id: 'other' }) },
      },
    })
    const response = await DELETE(request())
    expect(response.status).toBe(409)
    expect(mocks.providerCancel).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('deletes without another cancellation when the provider is already cancelled', async () => {
    mocks.providerGet.mockResolvedValue({
      data: {
        data: { id: 'subscription-1', attributes: providerAttributes({ status: 'cancelled' }) },
      },
    })
    const response = await DELETE(request())
    expect(response.status).toBe(200)
    expect(mocks.providerCancel).not.toHaveBeenCalled()
    expect(mocks.transaction).toHaveBeenCalledOnce()
  })

  it('deletes a user who has no linked provider subscription', async () => {
    mocks.subscriptionFind.mockResolvedValue(null)
    const response = await DELETE(request())
    expect(response.status).toBe(200)
    expect(mocks.providerGet).not.toHaveBeenCalled()
    expect(mocks.providerCancel).not.toHaveBeenCalled()
    expect(mocks.transaction).toHaveBeenCalledOnce()
  })
})

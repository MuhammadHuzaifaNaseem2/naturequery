import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  eventCreate: vi.fn(),
  eventFind: vi.fn(),
  eventUpdateMany: vi.fn(),
  eventUpdate: vi.fn(),
  subscriptionFind: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  subscriptionUpsert: vi.fn(),
  userFind: vi.fn(),
  auditCreate: vi.fn(),
  getSubscription: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    billingWebhookEvent: {
      create: mocks.eventCreate,
      findUnique: mocks.eventFind,
      updateMany: mocks.eventUpdateMany,
      update: mocks.eventUpdate,
    },
    subscription: {
      findUnique: mocks.subscriptionFind,
      updateMany: mocks.subscriptionUpdateMany,
      upsert: mocks.subscriptionUpsert,
    },
    user: { findUnique: mocks.userFind },
    auditLog: { create: mocks.auditCreate },
  },
}))
vi.mock('@/lib/lemonsqueezy', () => ({ setupLemonSqueezy: vi.fn() }))
vi.mock('@lemonsqueezy/lemonsqueezy.js', () => ({
  getSubscription: mocks.getSubscription,
}))

import { POST } from '@/app/api/webhooks/lemonsqueezy/route'

function subscriptionAttributes(overrides: Record<string, unknown> = {}) {
  return {
    store_id: 'store-1',
    customer_id: 'customer-1',
    user_email: 'owner@example.com',
    variant_id: 'variant-pro',
    status: 'active',
    created_at: '2026-09-14T09:00:00.000Z',
    updated_at: '2026-09-14T10:00:00.000Z',
    renews_at: '2026-10-14T10:00:00.000Z',
    ends_at: null,
    trial_ends_at: null,
    cancelled: false,
    ...overrides,
  }
}

function payload(
  eventName: string,
  attributes: Record<string, unknown> = subscriptionAttributes(),
  data = { type: 'subscriptions', id: 'subscription-1' }
) {
  return {
    meta: { event_name: eventName, custom_data: { user_id: 'user-1' } },
    data: { ...data, attributes },
  }
}

function signedRequest(value: object, signature = '') {
  const body = JSON.stringify(value)
  const validSignature = crypto
    .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return new Request('http://localhost/api/webhooks/lemonsqueezy', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-signature': signature || validSignature,
      'x-event-name': (value as { meta: { event_name: string } }).meta.event_name,
    },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'webhook-secret'
  process.env.LEMONSQUEEZY_STORE_ID = 'store-1'
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = 'variant-pro'
  mocks.eventCreate.mockResolvedValue({ id: 'event-1' })
  mocks.eventUpdate.mockResolvedValue({})
  mocks.subscriptionFind.mockResolvedValue({
    id: 'local-subscription',
    userId: 'user-1',
    stripeCustomerId: 'customer-1',
    user: { email: 'owner@example.com', emailVerified: new Date() },
  })
  mocks.subscriptionUpdateMany.mockResolvedValue({ count: 1 })
  mocks.auditCreate.mockResolvedValue({})
})

afterEach(() => vi.unstubAllEnvs())

describe('Lemon Squeezy webhook processing', () => {
  it('rejects invalid signatures before storing the payload', async () => {
    const response = await POST(
      signedRequest(payload('subscription_updated'), '0'.repeat(64)) as never
    )
    expect(response.status).toBe(400)
    expect(mocks.eventCreate).not.toHaveBeenCalled()
  })

  it('retains the paid plan for a cancelled subscription until ends_at', async () => {
    const response = await POST(
      signedRequest(
        payload(
          'subscription_cancelled',
          subscriptionAttributes({
            status: 'cancelled',
            cancelled: true,
            renews_at: null,
            ends_at: '2026-10-14T10:00:00.000Z',
          })
        )
      ) as never
    )
    expect(response.status).toBe(200)
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { providerUpdatedAt: null },
            { providerUpdatedAt: { lt: new Date('2026-09-14T10:00:00.000Z') } },
          ],
        }),
        data: expect.objectContaining({
          plan: 'PRO',
          status: 'CANCELED',
          currentPeriodStart: new Date('2026-09-14T09:00:00.000Z'),
          currentPeriodEnd: new Date('2026-10-14T10:00:00.000Z'),
        }),
      })
    )
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })

  it('stores the provider start time when linking a subscription for the first time', async () => {
    mocks.subscriptionFind.mockResolvedValue(null)
    mocks.userFind.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      emailVerified: new Date(),
    })
    mocks.subscriptionUpsert.mockResolvedValue({})

    const response = await POST(signedRequest(payload('subscription_created')) as never)

    expect(response.status).toBe(200)
    expect(mocks.subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          currentPeriodStart: new Date('2026-09-14T09:00:00.000Z'),
        }),
      })
    )
  })

  it('uses the invoice subscription_id and refreshes canonical state for payment events', async () => {
    mocks.getSubscription.mockResolvedValue({
      data: {
        data: { id: 'subscription-1', attributes: subscriptionAttributes({ status: 'past_due' }) },
      },
    })
    const invoice = payload(
      'subscription_payment_failed',
      { store_id: 'store-1', subscription_id: 'subscription-1' },
      { type: 'subscription-invoices', id: 'invoice-77' }
    )
    const response = await POST(signedRequest(invoice) as never)
    expect(response.status).toBe(200)
    expect(mocks.getSubscription).toHaveBeenCalledWith('subscription-1')
    expect(mocks.subscriptionFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeSubscriptionId: 'subscription-1' } })
    )
    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAST_DUE' }) })
    )
  })

  it('acknowledges completed duplicate deliveries without applying them again', async () => {
    mocks.eventCreate.mockRejectedValue(new Error('unique constraint'))
    mocks.eventFind.mockResolvedValue({ id: 'event-1', status: 'COMPLETED' })
    const response = await POST(signedRequest(payload('subscription_updated')) as never)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ duplicate: true })
    expect(mocks.subscriptionUpdateMany).not.toHaveBeenCalled()
  })

  it('records stale provider events but does not overwrite newer state or audit a change', async () => {
    mocks.subscriptionUpdateMany.mockResolvedValue({ count: 0 })
    const response = await POST(signedRequest(payload('subscription_updated')) as never)
    expect(response.status).toBe(200)
    expect(mocks.auditCreate).not.toHaveBeenCalled()
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })

  it('fails safely when the provider customer differs from the linked subscription', async () => {
    const response = await POST(
      signedRequest(
        payload('subscription_updated', subscriptionAttributes({ customer_id: 'attacker' }))
      ) as never
    )
    expect(response.status).toBe(500)
    expect(mocks.subscriptionUpdateMany).not.toHaveBeenCalled()
    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    )
  })
})

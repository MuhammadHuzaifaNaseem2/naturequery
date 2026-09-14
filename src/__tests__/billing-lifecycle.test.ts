import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertBillingIdentity,
  effectiveSubscriptionPlan,
  subscriptionIdForEvent,
  subscriptionLifecycleUpdate,
} from '@/lib/billing-lifecycle'

const verifiedUser = { email: 'owner@example.com', emailVerified: new Date() }

function attributes(overrides: Record<string, unknown> = {}) {
  return {
    store_id: 'store-1',
    customer_id: 'customer-1',
    user_email: 'owner@example.com',
    variant_id: 'variant-pro',
    status: 'active',
    updated_at: '2026-09-14T10:00:00.000Z',
    renews_at: '2026-10-14T10:00:00.000Z',
    ends_at: null,
    trial_ends_at: null,
    cancelled: false,
    ...overrides,
  }
}

beforeEach(() => {
  process.env.LEMONSQUEEZY_STORE_ID = 'store-1'
  process.env.LEMONSQUEEZY_PRO_VARIANT_ID = 'variant-pro'
  process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID = 'variant-enterprise'
})

afterEach(() => {
  delete process.env.LEMONSQUEEZY_STORE_ID
  delete process.env.LEMONSQUEEZY_PRO_VARIANT_ID
  delete process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID
})

describe('billing event identity', () => {
  it('uses an invoice subscription_id for payment events', () => {
    expect(
      subscriptionIdForEvent('subscription_payment_failed', 'subscription-invoices', 'invoice-9', {
        subscription_id: 42,
      })
    ).toBe('42')
  })

  it('rejects a payment event with the wrong resource type', () => {
    expect(() =>
      subscriptionIdForEvent('subscription_payment_success', 'subscriptions', 'invoice-9', {
        subscription_id: 42,
      })
    ).toThrow('subscription invoice')
  })

  it('requires the configured store and verified billing identity', () => {
    expect(() => assertBillingIdentity(attributes(), verifiedUser, 'customer-1')).not.toThrow()
    expect(() =>
      assertBillingIdentity(attributes({ customer_id: 'other' }), verifiedUser, 'customer-1')
    ).toThrow('identity')
    expect(() =>
      assertBillingIdentity(attributes(), { ...verifiedUser, emailVerified: null }, 'customer-1')
    ).toThrow('verified account email')
  })
})

describe('subscription lifecycle mapping', () => {
  it('keeps paid access through the cancellation grace period', () => {
    const result = subscriptionLifecycleUpdate(
      attributes({
        status: 'cancelled',
        cancelled: true,
        renews_at: null,
        ends_at: '2026-10-14T10:00:00.000Z',
      })
    )
    expect(result.data).toMatchObject({
      plan: 'PRO',
      status: 'CANCELED',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-10-14T10:00:00.000Z'),
    })
  })

  it('revokes paid access when the provider marks it expired', () => {
    expect(subscriptionLifecycleUpdate(attributes({ status: 'expired' })).data).toMatchObject({
      plan: 'FREE',
      status: 'CANCELED',
    })
  })

  it.each([
    ['past_due', 'PAST_DUE', 'PRO'],
    ['on_trial', 'TRIALING', 'PRO'],
    ['paused', 'INCOMPLETE', 'FREE'],
    ['future_provider_status', 'INCOMPLETE', 'FREE'],
  ])('maps %s to a safe local state', (providerStatus, status, plan) => {
    expect(subscriptionLifecycleUpdate(attributes({ status: providerStatus })).data).toMatchObject({
      status,
      plan,
    })
  })

  it('rejects unknown variants and malformed provider timestamps', () => {
    expect(() => subscriptionLifecycleUpdate(attributes({ variant_id: 'unknown' }))).toThrow(
      'unrecognized'
    )
    expect(() => subscriptionLifecycleUpdate(attributes({ updated_at: 'not-a-date' }))).toThrow(
      'Invalid updated_at'
    )
  })
})

describe('effective subscription entitlements', () => {
  const future = new Date('2026-10-14T10:00:00.000Z')
  const past = new Date('2026-08-14T10:00:00.000Z')
  const now = new Date('2026-09-14T10:00:00.000Z')

  it('keeps access for active, current trial, and cancellation grace states', () => {
    expect(
      effectiveSubscriptionPlan(
        { plan: 'PRO', status: 'ACTIVE', currentPeriodEnd: null, trialEndsAt: null },
        now
      )
    ).toBe('PRO')
    expect(
      effectiveSubscriptionPlan(
        { plan: 'PRO', status: 'TRIALING', currentPeriodEnd: null, trialEndsAt: future },
        now
      )
    ).toBe('PRO')
    expect(
      effectiveSubscriptionPlan(
        { plan: 'PRO', status: 'CANCELED', currentPeriodEnd: future, trialEndsAt: null },
        now
      )
    ).toBe('PRO')
  })

  it.each([
    ['PAST_DUE', future, null],
    ['INCOMPLETE', future, null],
    ['CANCELED', past, null],
    ['TRIALING', null, past],
  ] as const)('uses free entitlements for %s without current access', (status, period, trial) => {
    expect(
      effectiveSubscriptionPlan(
        { plan: 'PRO', status, currentPeriodEnd: period, trialEndsAt: trial },
        now
      )
    ).toBe('FREE')
  })
})

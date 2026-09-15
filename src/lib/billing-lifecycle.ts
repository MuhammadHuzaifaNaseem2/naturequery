import type { Prisma, SubscriptionPlan, SubscriptionStatus } from '@prisma/client'

export const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_plan_changed',
])

export const PAYMENT_EVENTS = new Set([
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_recovered',
])

function requiredDate(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`Missing ${field} in subscription payload`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${field} in subscription payload`)
  return date
}

function optionalDate(value: unknown) {
  if (value == null) return null
  if (typeof value !== 'string') throw new Error('Invalid subscription date')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid subscription date')
  return date
}

export function planFromLemonSqueezyVariant(variantId: string): SubscriptionPlan | null {
  if (process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID === variantId) return 'ENTERPRISE'
  if (process.env.LEMONSQUEEZY_PRO_VARIANT_ID === variantId) return 'PRO'
  return null
}

export function subscriptionIdForEvent(
  eventName: string,
  resourceType: string,
  resourceId: string,
  attributes: Record<string, unknown>
) {
  if (PAYMENT_EVENTS.has(eventName)) {
    if (resourceType !== 'subscription-invoices') {
      throw new Error('Payment webhook must contain a subscription invoice')
    }
    const subscriptionId = String(attributes.subscription_id ?? '')
    if (!subscriptionId) throw new Error('Payment webhook is missing subscription_id')
    return subscriptionId
  }
  if (SUBSCRIPTION_EVENTS.has(eventName)) {
    if (resourceType !== 'subscriptions' || !resourceId) {
      throw new Error('Subscription webhook contains the wrong resource type')
    }
    return resourceId
  }
  return null
}

export function assertLemonSqueezyStore(attributes: Record<string, unknown>) {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  if (!storeId || String(attributes.store_id ?? '') !== storeId) {
    throw new Error('Webhook does not belong to the configured Lemon Squeezy store')
  }
}

export function assertBillingIdentity(
  attributes: Record<string, unknown>,
  user: { email: string | null; emailVerified: Date | null },
  expectedCustomerId?: string | null
) {
  assertLemonSqueezyStore(attributes)
  const providerEmail = String(attributes.user_email ?? '')
    .trim()
    .toLowerCase()
  if (!user.emailVerified || !user.email || providerEmail !== user.email.trim().toLowerCase()) {
    throw new Error('Subscription customer does not match the verified account email')
  }
  const providerCustomerId = String(attributes.customer_id ?? '')
  if (!providerCustomerId || (expectedCustomerId && providerCustomerId !== expectedCustomerId)) {
    throw new Error('Subscription customer identity does not match the linked account')
  }
}

export interface SubscriptionLifecycleUpdate {
  providerUpdatedAt: Date
  data: Prisma.SubscriptionUpdateInput
}

export function effectiveSubscriptionPlan(
  subscription: {
    plan: SubscriptionPlan
    status: SubscriptionStatus
    currentPeriodEnd: Date | null
    trialEndsAt: Date | null
  },
  now = new Date()
): SubscriptionPlan {
  if (subscription.status === 'ACTIVE') return subscription.plan
  if (subscription.status === 'TRIALING') {
    return !subscription.trialEndsAt || subscription.trialEndsAt > now ? subscription.plan : 'FREE'
  }
  if (
    subscription.status === 'CANCELED' &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > now
  ) {
    return subscription.plan
  }
  return 'FREE'
}

export function subscriptionLifecycleUpdate(
  attributes: Record<string, unknown>
): SubscriptionLifecycleUpdate {
  const variantId = String(attributes.variant_id ?? '')
  const plan = planFromLemonSqueezyVariant(variantId)
  if (!plan) throw new Error('Webhook contains an unrecognized subscription variant')

  const providerStatus = String(attributes.status ?? '')
  const currentPeriodStart = requiredDate(attributes.created_at, 'created_at')
  const providerUpdatedAt = requiredDate(attributes.updated_at, 'updated_at')
  const renewsAt = optionalDate(attributes.renews_at)
  const endsAt = optionalDate(attributes.ends_at)
  const trialEndsAt = optionalDate(attributes.trial_ends_at)
  let status: SubscriptionStatus
  let effectivePlan: SubscriptionPlan = plan
  let cancelAtPeriodEnd = Boolean(attributes.cancelled)
  let currentPeriodEnd = renewsAt

  switch (providerStatus) {
    case 'active':
      status = 'ACTIVE'
      break
    case 'on_trial':
      status = 'TRIALING'
      break
    case 'cancelled':
      status = 'CANCELED'
      cancelAtPeriodEnd = true
      currentPeriodEnd = endsAt
      if (!endsAt) throw new Error('Cancelled subscription is missing ends_at')
      break
    case 'expired':
      status = 'CANCELED'
      effectivePlan = 'FREE'
      cancelAtPeriodEnd = true
      currentPeriodEnd = endsAt
      break
    case 'past_due':
    case 'unpaid':
      status = 'PAST_DUE'
      break
    case 'paused':
      status = 'INCOMPLETE'
      effectivePlan = 'FREE'
      break
    default:
      status = 'INCOMPLETE'
      effectivePlan = 'FREE'
  }

  return {
    providerUpdatedAt,
    data: {
      plan: effectivePlan,
      status,
      stripeCustomerId: String(attributes.customer_id ?? ''),
      stripePriceId: variantId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      trialEndsAt,
      providerUpdatedAt,
    },
  }
}

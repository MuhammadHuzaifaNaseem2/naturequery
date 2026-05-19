'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setupLemonSqueezy, isLemonSqueezyEnabled, PLANS, type PlanKey } from '@/lib/lemonsqueezy'
import {
  createCheckout,
  getSubscription,
  cancelSubscription as lsCancelSubscription,
} from '@lemonsqueezy/lemonsqueezy.js'

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user
}

async function getOrCreateSubscription(userId: string) {
  let sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { userId, plan: 'FREE', status: 'ACTIVE' },
    })
  }
  return sub
}

export async function getUserSubscription() {
  const user = await requireUser()
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })

  if (dbUser?.role === 'ADMIN') {
    return {
      plan: 'ENTERPRISE' as PlanKey,
      planName: 'Admin (Unlimited)',
      status: 'ACTIVE',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      limits: PLANS['ENTERPRISE'].limits,
      billingEnabled: isLemonSqueezyEnabled(),
    }
  }

  const sub = await getOrCreateSubscription(user.id!)

  let effectivePlan = sub.plan as PlanKey
  if (sub.status === 'TRIALING' && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date()) {
    await prisma.subscription.update({
      where: { userId: user.id! },
      data: { plan: 'FREE', status: 'ACTIVE', trialEndsAt: null },
    })
    effectivePlan = 'FREE'
  }

  const plan = PLANS[effectivePlan]
  return {
    plan: effectivePlan,
    planName: sub.status === 'TRIALING' ? `${plan.name} (Trial)` : plan.name,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    limits: plan.limits,
    billingEnabled: isLemonSqueezyEnabled(),
  }
}

export async function createCheckoutSession(planKey: 'PRO' | 'ENTERPRISE') {
  if (!isLemonSqueezyEnabled()) throw new Error('Billing is not configured')

  setupLemonSqueezy()

  const user = await requireUser()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  })
  const plan = PLANS[planKey]

  if (!plan.lsVariantId) {
    throw new Error(`Lemon Squeezy variant ID not configured for ${planKey} plan`)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { data, error } = await createCheckout(
    process.env.LEMONSQUEEZY_STORE_ID!,
    plan.lsVariantId,
    {
      checkoutData: {
        email: dbUser?.email ?? undefined,
        name: dbUser?.name ?? undefined,
        custom: {
          user_id: user.id,
          plan: planKey,
        },
      },
      productOptions: {
        redirectUrl: `${appUrl}/settings?tab=billing&status=success`,
      },
    }
  )

  if (error) throw new Error(error.message)

  return { url: data?.data?.attributes?.url ?? null }
}

export async function createBillingPortalSession() {
  if (!isLemonSqueezyEnabled()) throw new Error('Billing is not configured')

  setupLemonSqueezy()

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id)

  // stripeSubscriptionId stores the Lemon Squeezy subscription ID
  if (!sub.stripeSubscriptionId) {
    throw new Error('No active subscription found. Subscribe to a plan first.')
  }

  const { data, error } = await getSubscription(sub.stripeSubscriptionId)
  if (error) throw new Error(error.message)

  const portalUrl = data?.data?.attributes?.urls?.customer_portal
  if (!portalUrl) throw new Error('Could not retrieve billing portal URL.')

  return { url: portalUrl }
}

export async function cancelSubscription() {
  if (!isLemonSqueezyEnabled()) throw new Error('Billing is not configured')

  setupLemonSqueezy()

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id)

  if (!sub.stripeSubscriptionId) {
    throw new Error('No active subscription to cancel')
  }

  const { error } = await lsCancelSubscription(sub.stripeSubscriptionId)
  if (error) throw new Error(error.message)

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { cancelAtPeriodEnd: true },
  })

  return { success: true }
}

/**
 * Sync subscription state from Lemon Squeezy. Called after checkout redirect
 * to ensure the user sees their paid plan immediately if the webhook already fired.
 */
export async function syncSubscriptionFromLS() {
  if (!isLemonSqueezyEnabled()) return

  setupLemonSqueezy()

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id!)

  if (!sub.stripeSubscriptionId) return

  try {
    const { data, error } = await getSubscription(sub.stripeSubscriptionId)
    if (error || !data?.data) return

    const attrs = data.data.attributes
    const variantId = String(attrs.variant_id)
    const proId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID
    const entId = process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID

    let plan: 'FREE' | 'PRO' | 'ENTERPRISE' | null = null
    if (entId && variantId === entId) plan = 'ENTERPRISE'
    else if (proId && variantId === proId) plan = 'PRO'

    const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE'> =
      {
        active: 'ACTIVE',
        on_trial: 'TRIALING',
        past_due: 'PAST_DUE',
        unpaid: 'PAST_DUE',
        cancelled: 'CANCELED',
        expired: 'CANCELED',
        paused: 'ACTIVE',
      }

    await prisma.subscription.update({
      where: { userId: user.id! },
      data: {
        ...(plan ? { plan } : {}),
        status: statusMap[attrs.status] ?? 'ACTIVE',
        stripePriceId: variantId,
        currentPeriodEnd: attrs.renews_at ? new Date(attrs.renews_at) : undefined,
        cancelAtPeriodEnd: attrs.cancelled,
      },
    })
  } catch (err) {
    console.error('[billing] Failed to sync subscription from Lemon Squeezy:', err)
  }
}

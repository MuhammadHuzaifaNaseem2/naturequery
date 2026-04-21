'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, isStripeEnabled, PLANS, type PlanKey } from '@/lib/stripe'

// ---------- helpers ----------

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

// ---------- public actions ----------

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
      stripeEnabled: isStripeEnabled(),
    }
  }

  const sub = await getOrCreateSubscription(user.id!)

  // Check if trial expired and auto-downgrade
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
    stripeEnabled: isStripeEnabled(),
  }
}

export async function createCheckoutSession(planKey: 'PRO' | 'ENTERPRISE') {
  if (!isStripeEnabled()) throw new Error('Billing is not configured')

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id)
  const plan = PLANS[planKey]

  if (!plan.stripePriceId) {
    throw new Error(`Stripe price ID not configured for ${planKey} plan`)
  }

  // Create or reuse Stripe customer
  let customerId = sub.stripeCustomerId
  if (!customerId) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    const customer = await stripe.customers.create({
      email: dbUser?.email ?? undefined,
      name: dbUser?.name ?? undefined,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/settings?tab=billing&status=success`,
    cancel_url: `${appUrl}/settings?tab=billing&status=canceled`,
    subscription_data: {
      metadata: { userId: user.id, plan: planKey },
    },
  })

  return { url: session.url }
}

export async function createBillingPortalSession() {
  if (!isStripeEnabled()) throw new Error('Billing is not configured')

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id)

  if (!sub.stripeCustomerId) {
    throw new Error('No billing account found. Subscribe to a plan first.')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/settings?tab=billing`,
  })

  return { url: session.url }
}

export async function cancelSubscription() {
  if (!isStripeEnabled()) throw new Error('Billing is not configured')

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id)

  if (!sub.stripeSubscriptionId) {
    throw new Error('No active subscription to cancel')
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { cancelAtPeriodEnd: true },
  })

  return { success: true }
}

/**
 * Sync subscription state from Stripe. Called after checkout redirect
 * to ensure the user sees their paid plan immediately, even if the
 * webhook hasn't fired yet.
 */
export async function syncSubscriptionFromStripe() {
  if (!isStripeEnabled()) return

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id!)

  if (!sub.stripeCustomerId) return

  try {
    // Fetch the latest subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: 'all',
      limit: 1,
    })

    const stripeSub = subscriptions.data[0]
    if (!stripeSub) return

    const firstItem = stripeSub.items.data[0]
    const priceId = firstItem?.price?.id
    const proId = process.env.STRIPE_PRO_PRICE_ID
    const entId = process.env.STRIPE_ENTERPRISE_PRICE_ID
    let plan: 'FREE' | 'PRO' | 'ENTERPRISE' | null
    if (!priceId) {
      plan = 'FREE'
    } else if (entId && priceId === entId) {
      plan = 'ENTERPRISE'
    } else if (proId && priceId === proId) {
      plan = 'PRO'
    } else {
      console.error(
        `[CRITICAL] Stripe priceId "${priceId}" does not match STRIPE_PRO_PRICE_ID ` +
          `or STRIPE_ENTERPRISE_PRICE_ID. Leaving plan unchanged.`
      )
      plan = null
    }

    const statusMap: Record<
      string,
      'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE'
    > = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      trialing: 'TRIALING',
      incomplete: 'INCOMPLETE',
    }

    // Stripe v20+: period fields are on item, not subscription root
    const periodStart = firstItem?.current_period_start
    const periodEnd = firstItem?.current_period_end

    await prisma.subscription.update({
      where: { userId: user.id! },
      data: {
        // Only overwrite plan when we recognize the price — otherwise leave
        // existing value to avoid downgrading a paying customer on misconfig.
        ...(plan ? { plan } : {}),
        status: statusMap[stripeSub.status] ?? 'ACTIVE',
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId || null,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    })
  } catch (error) {
    console.error('[billing] Failed to sync subscription from Stripe:', error)
  }
}

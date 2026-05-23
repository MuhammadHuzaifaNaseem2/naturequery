'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setupLemonSqueezy, isLemonSqueezyEnabled, PLANS, type PlanKey } from '@/lib/lemonsqueezy'
import {
  createCheckout,
  getSubscription,
  listSubscriptions,
  listSubscriptionInvoices,
  cancelSubscription as lsCancelSubscription,
  updateSubscription,
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
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    limits: plan.limits,
    billingEnabled: isLemonSqueezyEnabled(),
    subscriptionId: sub.stripeSubscriptionId ?? null,
  }
}

export async function createCheckoutSession(planKey: 'PRO' | 'ENTERPRISE') {
  if (!isLemonSqueezyEnabled()) return { url: null, error: 'Billing is not configured' }

  setupLemonSqueezy()

  const user = await requireUser()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true },
  })
  const plan = PLANS[planKey]

  if (!plan.lsVariantId) {
    return { url: null, error: `Variant ID not configured for ${planKey}. Contact support.` }
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

  if (error) return { url: null, error: error.message }

  return { url: data?.data?.attributes?.url ?? null, error: null }
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

export async function resumeSubscription() {
  if (!isLemonSqueezyEnabled()) throw new Error('Billing is not configured')

  setupLemonSqueezy()

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id)

  if (!sub.stripeSubscriptionId) {
    throw new Error('No subscription to resume')
  }

  const { error } = await updateSubscription(sub.stripeSubscriptionId, { cancelled: false })
  if (error) throw new Error(error.message)

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { cancelAtPeriodEnd: false },
  })

  return { success: true }
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

const LS_STATUS_MAP: Record<
  string,
  'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE'
> = {
  active: 'ACTIVE',
  on_trial: 'TRIALING',
  past_due: 'PAST_DUE',
  unpaid: 'PAST_DUE',
  cancelled: 'CANCELED',
  expired: 'CANCELED',
  paused: 'ACTIVE',
}

function resolvePlan(variantId: string): 'PRO' | 'ENTERPRISE' | null {
  const proId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID
  const entId = process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID
  if (entId && variantId === entId) return 'ENTERPRISE'
  if (proId && variantId === proId) return 'PRO'
  return null
}

async function applyLSSubscription(userId: string, subId: string, attrs: Record<string, unknown>) {
  const variantId = String(attrs.variant_id ?? '')
  const plan = resolvePlan(variantId)
  const status = LS_STATUS_MAP[String(attrs.status ?? 'active')] ?? 'ACTIVE'
  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at as string) : undefined
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at as string) : undefined

  await prisma.subscription.update({
    where: { userId },
    data: {
      stripeSubscriptionId: subId,
      stripeCustomerId: String(attrs.customer_id ?? ''),
      stripePriceId: variantId,
      ...(plan ? { plan } : {}),
      status,
      currentPeriodEnd: renewsAt ?? endsAt,
      cancelAtPeriodEnd: Boolean(attrs.cancelled),
    },
  })
}

/**
 * Sync subscription state from Lemon Squeezy. Called after checkout redirect
 * to ensure the user sees their new plan without waiting for the webhook.
 * Falls back to listing subscriptions by email if no stored subscription ID.
 */
export async function syncSubscriptionFromLS() {
  if (!isLemonSqueezyEnabled()) return

  setupLemonSqueezy()

  const user = await requireUser()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id! },
    select: { email: true },
  })
  const sub = await getOrCreateSubscription(user.id!)

  try {
    // Try stored subscription ID first
    if (sub.stripeSubscriptionId) {
      const { data, error } = await getSubscription(sub.stripeSubscriptionId)
      if (!error && data?.data) {
        await applyLSSubscription(
          user.id!,
          String(data.data.id),
          data.data.attributes as Record<string, unknown>
        )
        return
      }
    }

    // Fall back: find subscription by user email in this store
    if (!dbUser?.email) return
    const storeId = process.env.LEMONSQUEEZY_STORE_ID ?? ''

    // Try email + store filter first, then email only
    for (const filter of [{ storeId, userEmail: dbUser.email }, { userEmail: dbUser.email }]) {
      const { data: list, error: listError } = await listSubscriptions({ filter })
      if (listError) {
        console.error('[billing] listSubscriptions error:', listError)
        continue
      }
      const subs = (list?.data ?? []) as Array<{
        id: string | number
        attributes: Record<string, unknown>
      }>
      if (!subs.length) continue

      const active =
        subs.find((s) =>
          ['active', 'on_trial', 'past_due'].includes(String(s.attributes.status))
        ) ?? subs[0]
      await applyLSSubscription(user.id!, String(active.id), active.attributes)
      return
    }
  } catch (err) {
    console.error('[billing] Failed to sync subscription from Lemon Squeezy:', err)
  }
}

/**
 * Sync subscription from a specific LS subscription ID entered manually by the user.
 * Used when webhook and auto-discovery both fail.
 */
export async function syncBySubscriptionId(subscriptionId: string) {
  if (!isLemonSqueezyEnabled()) throw new Error('Billing not configured')
  if (!subscriptionId.trim()) throw new Error('Subscription ID is required')

  setupLemonSqueezy()

  const user = await requireUser()
  const { data, error } = await getSubscription(subscriptionId.trim())

  if (error) throw new Error(`Lemon Squeezy error: ${error.message}`)
  if (!data?.data) throw new Error('Subscription not found in Lemon Squeezy')

  const attrs = data.data.attributes as Record<string, unknown>

  // Verify this subscription belongs to the current user's store
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  if (storeId && String(attrs.store_id) !== String(storeId)) {
    throw new Error('This subscription ID does not belong to your store')
  }

  await applyLSSubscription(user.id!, String(data.data.id), attrs)
}

export interface InvoiceItem {
  id: string
  date: string
  amount: string
  total: number
  status: string
  invoiceUrl: string | null
}

export interface PaymentMethod {
  brand: string
  lastFour: string
}

export interface BillingDetails {
  invoices: InvoiceItem[]
  paymentMethod: PaymentMethod | null
  updatePaymentUrl: string | null
}

/**
 * Fetch invoices and payment method info from Lemon Squeezy for the current user.
 */
export async function getBillingDetails(): Promise<BillingDetails> {
  const empty: BillingDetails = { invoices: [], paymentMethod: null, updatePaymentUrl: null }
  if (!isLemonSqueezyEnabled()) return empty

  setupLemonSqueezy()

  const user = await requireUser()
  const sub = await getOrCreateSubscription(user.id!)
  if (!sub.stripeSubscriptionId) return empty

  try {
    const [subRes, invRes] = await Promise.all([
      getSubscription(sub.stripeSubscriptionId),
      listSubscriptionInvoices({ filter: { subscriptionId: sub.stripeSubscriptionId } }),
    ])

    const attrs = subRes.data?.data?.attributes as Record<string, unknown> | undefined
    const paymentMethod = attrs?.card_last_four
      ? { brand: String(attrs.card_brand ?? ''), lastFour: String(attrs.card_last_four) }
      : null
    const updatePaymentUrl =
      (attrs?.urls as Record<string, string> | undefined)?.update_payment_method ?? null

    const invoices: InvoiceItem[] = (
      (invRes.data?.data ?? []) as Array<{
        id: string | number
        attributes: Record<string, unknown>
      }>
    ).map((inv) => ({
      id: String(inv.id),
      date: String(inv.attributes.created_at ?? ''),
      amount: String(inv.attributes.total_formatted ?? ''),
      total: Number(inv.attributes.total ?? 0),
      status: String(inv.attributes.status ?? ''),
      invoiceUrl:
        (inv.attributes.urls as { invoice_url?: string } | undefined)?.invoice_url ?? null,
    }))

    return { invoices, paymentMethod, updatePaymentUrl }
  } catch {
    return empty
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { stripe, isStripeEnabled } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client'
import type Stripe from 'stripe'

function mapStatus(stripeStatus: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    trialing: 'TRIALING',
    incomplete: 'INCOMPLETE',
  }
  return map[stripeStatus] ?? 'ACTIVE'
}

function planFromPriceId(priceId: string): SubscriptionPlan | null {
  if (!priceId) return 'FREE'
  const proId = process.env.STRIPE_PRO_PRICE_ID
  const entId = process.env.STRIPE_ENTERPRISE_PRICE_ID
  if (entId && priceId === entId) return 'ENTERPRISE'
  if (proId && priceId === proId) return 'PRO'
  // Unknown priceId — likely a misconfigured env var. Do NOT silently
  // downgrade a paying customer to FREE; return null so the caller skips
  // the plan write and surfaces the issue loudly.
  console.error(
    `[CRITICAL] Stripe priceId "${priceId}" does not match STRIPE_PRO_PRICE_ID ` +
      `or STRIPE_ENTERPRISE_PRICE_ID. Check Vercel env vars. Skipping plan update.`
  )
  return null
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata?.userId ??
    (
      await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
        select: { userId: true },
      })
    )?.userId

  if (!userId) {
    console.error('[stripe webhook] No userId for subscription', subscription.id)
    return
  }

  const firstItem = subscription.items.data[0]
  const priceId = firstItem?.price?.id ?? ''

  // In Stripe v20+, billing period is on the subscription item
  const periodStart = firstItem?.current_period_start
  const periodEnd = firstItem?.current_period_end

  const resolvedPlan = planFromPriceId(priceId)

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      // Only overwrite plan when we recognize the price — otherwise leave
      // existing value to avoid downgrading a paying customer on misconfig.
      ...(resolvedPlan ? { plan: resolvedPlan } : {}),
      status: mapStatus(subscription.status),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      userId,
      stripeCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan: resolvedPlan ?? 'FREE',
      status: mapStatus(subscription.status),
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SUBSCRIPTION_UPDATED',
      resource: 'subscription',
      resourceId: subscription.id,
      metadata: {
        plan: resolvedPlan ?? 'UNKNOWN',
        status: subscription.status,
      },
    },
  })
}

export async function POST(request: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error(
      '[CRITICAL] STRIPE_WEBHOOK_SECRET is not configured. ' +
        'Billing webhook events are NOT being processed. ' +
        'Subscription changes, payment failures, and cancellations will be silently dropped.'
    )
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionEvent(event.data.object as Stripe.Subscription)
      break

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subDetails = invoice.parent?.subscription_details
      const subId = subDetails
        ? typeof subDetails.subscription === 'string'
          ? subDetails.subscription
          : subDetails.subscription?.id
        : undefined
      if (subId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: 'PAST_DUE' },
        })
        // Log failed payment for admin visibility
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subId } })
        if (sub?.userId) {
          await prisma.auditLog.create({
            data: {
              userId: sub.userId,
              action: 'PAYMENT_FAILED',
              resource: 'subscription',
              resourceId: subId,
              metadata: { invoiceId: invoice.id, amount: invoice.amount_due },
            },
          })
        }
      }
      break
    }

    case 'invoice.payment_succeeded': {
      // Payment succeeded — ensure subscription is ACTIVE and reset usage if new billing period
      const invoice = event.data.object as Stripe.Invoice
      const subDetails = invoice.parent?.subscription_details
      const subId = subDetails
        ? typeof subDetails.subscription === 'string'
          ? subDetails.subscription
          : subDetails.subscription?.id
        : undefined
      if (subId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: 'ACTIVE' },
        })
      }
      break
    }

    case 'payment_intent.payment_failed': {
      // 3D Secure or card decline — log for visibility
      const pi = event.data.object as Stripe.PaymentIntent
      console.warn('[stripe webhook] PaymentIntent failed:', pi.id, pi.last_payment_error?.message)
      break
    }

    case 'customer.subscription.trial_will_end': {
      // Trial ending soon — log so admin/emails can be triggered later
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId
      if (userId) {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'TRIAL_ENDING_SOON',
            resource: 'subscription',
            resourceId: sub.id,
            metadata: { trialEnd: sub.trial_end },
          },
        })
      }
      break
    }

    case 'charge.refunded':
    case 'charge.dispute.created': {
      // Log disputes so admin can investigate
      console.warn('[stripe webhook] Charge event:', event.type, event.data.object)
      break
    }

    default:
      // Unhandled event type — ignore
      break
  }

  return NextResponse.json({ received: true })
}

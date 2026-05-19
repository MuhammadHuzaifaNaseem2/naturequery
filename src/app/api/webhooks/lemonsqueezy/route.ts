import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client'

function mapStatus(lsStatus: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: 'ACTIVE',
    on_trial: 'TRIALING',
    past_due: 'PAST_DUE',
    unpaid: 'PAST_DUE',
    cancelled: 'CANCELED',
    expired: 'CANCELED',
    paused: 'ACTIVE',
  }
  return map[lsStatus] ?? 'ACTIVE'
}

function planFromVariantId(variantId: string): SubscriptionPlan | null {
  const proId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID
  const entId = process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID
  if (entId && variantId === entId) return 'ENTERPRISE'
  if (proId && variantId === proId) return 'PRO'
  console.error(
    `[CRITICAL] Lemon Squeezy variantId "${variantId}" does not match PRO or ENTERPRISE variant IDs. Check Vercel env vars.`
  )
  return null
}

export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[ls webhook] LEMONSQUEEZY_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing x-signature header' }, { status: 400 })
  }

  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (hash !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = (payload.meta as Record<string, unknown>)?.event_name as string
  const customData = (payload.meta as Record<string, unknown>)?.custom_data as
    | Record<string, string>
    | undefined
  const data = (payload.data as Record<string, unknown>)?.attributes as Record<string, unknown>
  const subscriptionId = String((payload.data as Record<string, unknown>)?.id ?? '')

  const userId = customData?.user_id

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed': {
      if (!userId) {
        console.error('[ls webhook] No user_id in custom_data for event', eventName, subscriptionId)
        break
      }

      const variantId = String(data?.variant_id ?? '')
      const resolvedPlan = planFromVariantId(variantId)
      const status = mapStatus(String(data?.status ?? 'active'))
      const customerId = String(data?.customer_id ?? '')
      const renewsAt = data?.renews_at ? new Date(data.renews_at as string) : undefined
      const endsAt = data?.ends_at ? new Date(data.ends_at as string) : undefined
      const cancelled = Boolean(data?.cancelled)

      await prisma.subscription.upsert({
        where: { userId },
        update: {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          stripePriceId: variantId,
          ...(resolvedPlan ? { plan: resolvedPlan } : {}),
          status,
          currentPeriodEnd: renewsAt ?? endsAt,
          cancelAtPeriodEnd: cancelled,
        },
        create: {
          userId,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          stripePriceId: variantId,
          plan: resolvedPlan ?? 'FREE',
          status,
          currentPeriodEnd: renewsAt ?? endsAt,
          cancelAtPeriodEnd: cancelled,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SUBSCRIPTION_UPDATED',
          resource: 'subscription',
          resourceId: subscriptionId,
          metadata: { plan: resolvedPlan ?? 'UNKNOWN', status, event: eventName },
        },
      })
      break
    }

    case 'subscription_cancelled':
    case 'subscription_expired': {
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      })
      if (sub) {
        await prisma.subscription.update({
          where: { userId: sub.userId },
          data: {
            status: 'CANCELED',
            plan: 'FREE',
            cancelAtPeriodEnd: true,
          },
        })
        await prisma.auditLog.create({
          data: {
            userId: sub.userId,
            action: 'SUBSCRIPTION_UPDATED',
            resource: 'subscription',
            resourceId: subscriptionId,
            metadata: { event: eventName },
          },
        })
      }
      break
    }

    case 'subscription_payment_failed': {
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      })
      if (sub) {
        await prisma.subscription.update({
          where: { userId: sub.userId },
          data: { status: 'PAST_DUE' },
        })
        await prisma.auditLog.create({
          data: {
            userId: sub.userId,
            action: 'PAYMENT_FAILED',
            resource: 'subscription',
            resourceId: subscriptionId,
            metadata: { event: eventName },
          },
        })
      }
      break
    }

    case 'subscription_payment_success':
    case 'subscription_payment_recovered': {
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      })
      if (sub) {
        await prisma.subscription.update({
          where: { userId: sub.userId },
          data: { status: 'ACTIVE' },
        })
      }
      break
    }

    default:
      // Unhandled event — ignore silently
      break
  }

  return NextResponse.json({ received: true })
}

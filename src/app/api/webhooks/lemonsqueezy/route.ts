import crypto from 'crypto'
import { getSubscription } from '@lemonsqueezy/lemonsqueezy.js'
import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setupLemonSqueezy } from '@/lib/lemonsqueezy'
import {
  PAYMENT_EVENTS,
  SUBSCRIPTION_EVENTS,
  assertBillingIdentity,
  assertLemonSqueezyStore,
  subscriptionIdForEvent,
  subscriptionLifecycleUpdate,
} from '@/lib/billing-lifecycle'

type WebhookPayload = {
  meta: { event_name: string; custom_data?: Record<string, string> }
  data: { type: string; id: string | number; attributes: Record<string, unknown> }
}

function validSignature(rawBody: string, signature: string, secret: string) {
  if (!/^[a-f\d]{64}$/i.test(signature)) return false
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'))
  const actual = Buffer.from(signature.toLowerCase())
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function parsePayload(rawBody: string): WebhookPayload {
  let value: unknown
  try {
    value = JSON.parse(rawBody)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (!value || typeof value !== 'object') throw new Error('Invalid webhook payload')
  const payload = value as Partial<WebhookPayload>
  if (
    !payload.meta ||
    typeof payload.meta.event_name !== 'string' ||
    !payload.data ||
    typeof payload.data.type !== 'string' ||
    !['string', 'number'].includes(typeof payload.data.id) ||
    !payload.data.attributes ||
    typeof payload.data.attributes !== 'object'
  ) {
    throw new Error('Invalid webhook payload')
  }
  return payload as WebhookPayload
}

async function claimEvent(
  deduplicationKey: string,
  payload: WebhookPayload,
  subscriptionId: string
) {
  try {
    const event = await prisma.billingWebhookEvent.create({
      data: {
        deduplicationKey,
        eventName: payload.meta.event_name,
        resourceType: payload.data.type,
        resourceId: String(payload.data.id),
        subscriptionId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    return { id: event.id, process: true }
  } catch {
    const existing = await prisma.billingWebhookEvent.findUnique({
      where: { deduplicationKey },
      select: { id: true, status: true },
    })
    if (!existing) throw new Error('Could not persist billing webhook')
    if (existing.status === 'COMPLETED') return { id: existing.id, process: false }
    if (existing.status === 'PROCESSING') throw new Error('Billing webhook is already processing')
    const claimed = await prisma.billingWebhookEvent.updateMany({
      where: { id: existing.id, status: 'FAILED' },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    })
    if (claimed.count !== 1) throw new Error('Billing webhook retry could not be claimed')
    return { id: existing.id, process: true }
  }
}

async function canonicalSubscription(payload: WebhookPayload, subscriptionId: string) {
  if (!PAYMENT_EVENTS.has(payload.meta.event_name)) return payload.data.attributes
  assertLemonSqueezyStore(payload.data.attributes)
  setupLemonSqueezy()
  const response = await getSubscription(subscriptionId)
  if (response.error || !response.data?.data) {
    throw new Error('Could not retrieve the subscription for this payment event')
  }
  if (String(response.data.data.id) !== subscriptionId) {
    throw new Error('Payment event resolved to the wrong subscription')
  }
  return response.data.data.attributes as unknown as Record<string, unknown>
}

async function applySubscription(
  payload: WebhookPayload,
  subscriptionId: string,
  attributes: Record<string, unknown>,
  deduplicationKey: string
) {
  assertLemonSqueezyStore(attributes)
  const linked = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: { select: { email: true, emailVerified: true } } },
  })
  const customUserId = payload.meta.custom_data?.user_id
  if (linked && customUserId && linked.userId !== customUserId) {
    throw new Error('Webhook user does not match the linked subscription')
  }

  let userId = linked?.userId
  let user = linked?.user
  if (!userId) {
    if (!SUBSCRIPTION_EVENTS.has(payload.meta.event_name) || !customUserId) {
      throw new Error('Subscription is not linked to an account')
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: customUserId },
      select: { id: true, email: true, emailVerified: true },
    })
    if (!dbUser) throw new Error('Webhook account does not exist')
    userId = dbUser.id
    user = dbUser
  }

  if (!user) throw new Error('Subscription account identity is unavailable')
  assertBillingIdentity(attributes, user, linked?.stripeCustomerId)
  const lifecycle = subscriptionLifecycleUpdate(attributes)
  let applied = false
  if (linked) {
    const result = await prisma.subscription.updateMany({
      where: {
        id: linked.id,
        OR: [
          { providerUpdatedAt: null },
          { providerUpdatedAt: { lt: lifecycle.providerUpdatedAt } },
        ],
      },
      data: lifecycle.data,
    })
    applied = result.count === 1
  } else {
    const conflict = await prisma.subscription.findUnique({ where: { userId } })
    if (conflict?.stripeSubscriptionId && conflict.stripeSubscriptionId !== subscriptionId) {
      throw new Error('Account is already linked to another subscription')
    }
    await prisma.subscription.upsert({
      where: { userId },
      update: { ...lifecycle.data, stripeSubscriptionId: subscriptionId },
      create: {
        userId,
        stripeSubscriptionId: subscriptionId,
        plan: lifecycle.data.plan as 'FREE' | 'PRO' | 'ENTERPRISE',
        status: lifecycle.data.status as
          | 'ACTIVE'
          | 'PAST_DUE'
          | 'CANCELED'
          | 'TRIALING'
          | 'INCOMPLETE',
        stripeCustomerId: String(attributes.customer_id),
        stripePriceId: String(attributes.variant_id),
        currentPeriodStart: lifecycle.data.currentPeriodStart as Date,
        currentPeriodEnd: lifecycle.data.currentPeriodEnd as Date | null,
        cancelAtPeriodEnd: Boolean(lifecycle.data.cancelAtPeriodEnd),
        trialEndsAt: lifecycle.data.trialEndsAt as Date | null,
        providerUpdatedAt: lifecycle.providerUpdatedAt,
      },
    })
    applied = true
  }

  if (applied) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SUBSCRIPTION_UPDATED',
        resource: 'subscription',
        resourceId: subscriptionId,
        metadata: {
          event: payload.meta.event_name,
          deduplicationKey,
          providerUpdatedAt: lifecycle.providerUpdatedAt.toISOString(),
        },
      },
    })
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })

  const rawBody = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  if (!validSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let payload: WebhookPayload
  try {
    payload = parsePayload(rawBody)
    const headerEvent = request.headers.get('x-event-name')
    if (headerEvent && headerEvent !== payload.meta.event_name) {
      throw new Error('Webhook event header does not match the payload')
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid webhook payload' },
      { status: 400 }
    )
  }

  const eventName = payload.meta.event_name
  if (!SUBSCRIPTION_EVENTS.has(eventName) && !PAYMENT_EVENTS.has(eventName)) {
    return NextResponse.json({ received: true, ignored: true })
  }

  let eventId: string | undefined
  const deduplicationKey = crypto.createHash('sha256').update(rawBody).digest('hex')
  try {
    const subscriptionId = subscriptionIdForEvent(
      eventName,
      payload.data.type,
      String(payload.data.id),
      payload.data.attributes
    )!
    const claim = await claimEvent(deduplicationKey, payload, subscriptionId)
    eventId = claim.id
    if (!claim.process) return NextResponse.json({ received: true, duplicate: true })

    const attributes = await canonicalSubscription(payload, subscriptionId)
    await applySubscription(payload, subscriptionId, attributes, deduplicationKey)
    await prisma.billingWebhookEvent.update({
      where: { id: eventId },
      data: { status: 'COMPLETED', processedAt: new Date(), lastError: null },
    })
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    if (eventId) {
      await prisma.billingWebhookEvent
        .update({
          where: { id: eventId },
          data: { status: 'FAILED', lastError: message.slice(0, 500) },
        })
        .catch(() => {})
    }
    console.error('[ls webhook] Processing failed:', message)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

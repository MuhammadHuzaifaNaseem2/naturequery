import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/encryption'
import { cancelSubscription, getSubscription } from '@lemonsqueezy/lemonsqueezy.js'
import { isLemonSqueezyEnabled, setupLemonSqueezy } from '@/lib/lemonsqueezy'
import { assertBillingIdentity } from '@/lib/billing-lifecycle'

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Require password confirmation for safety
  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.password) {
    return NextResponse.json({ error: 'Password confirmation is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // OAuth users may not have a password — allow deletion without password check
  if (user.password) {
    const isPasswordValid = await verifyPassword(body.password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId } })
  if (subscription?.stripeSubscriptionId) {
    if (!isLemonSqueezyEnabled()) {
      return NextResponse.json(
        {
          error:
            'Billing is temporarily unavailable. Contact support before deleting this account.',
        },
        { status: 503 }
      )
    }
    setupLemonSqueezy()
    const provider = await getSubscription(subscription.stripeSubscriptionId)
    if (provider.error || !provider.data?.data) {
      return NextResponse.json(
        {
          error: 'Could not verify the active billing subscription. Your account was not deleted.',
        },
        { status: 502 }
      )
    }
    const attributes = provider.data.data.attributes as unknown as Record<string, unknown>
    try {
      assertBillingIdentity(attributes, user, subscription.stripeCustomerId)
    } catch {
      return NextResponse.json(
        { error: 'Billing ownership could not be verified. Your account was not deleted.' },
        { status: 409 }
      )
    }
    if (!['cancelled', 'expired'].includes(String(attributes.status))) {
      const cancelled = await cancelSubscription(subscription.stripeSubscriptionId)
      if (cancelled.error || !cancelled.data?.data) {
        return NextResponse.json(
          { error: 'Could not stop subscription renewal. Your account was not deleted.' },
          { status: 502 }
        )
      }
    }
  }

  // Provider renewal is stopped before local billing records and account data are removed.
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.queryHistory.deleteMany({ where: { userId } }),
    prisma.savedQuery.deleteMany({ where: { userId } }),
    prisma.dashboardWidget.deleteMany({ where: { userId } }),
    prisma.scheduledQuery.deleteMany({ where: { userId } }),
    prisma.databaseConnection.deleteMany({ where: { userId } }),
    prisma.subscription.deleteMany({ where: { userId } }),
    prisma.apiKey.deleteMany({ where: { userId } }),
    prisma.usageRecord.deleteMany({ where: { userId } }),
    // OAuth users may have null email — skip token cleanup if so
    ...(user.email
      ? [
          prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
          prisma.passwordResetToken.deleteMany({ where: { email: user.email } }),
        ]
      : []),
    prisma.user.delete({ where: { id: userId } }),
  ])

  return NextResponse.json({ success: true })
}

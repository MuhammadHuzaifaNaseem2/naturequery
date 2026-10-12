import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readWeeklySummaryUnsubscribeToken } from '@/lib/email-unsubscribe'

/**
 * POST /api/email/unsubscribe?t=<token>
 *
 * Turns off the weekly summary email for the account the signed token belongs to.
 * Mail apps post here for their own one-click "unsubscribe" (RFC 8058), and the page at
 * /email/unsubscribe posts here when someone confirms. Only POST changes anything, so
 * link scanners that open every URL in an email can't unsubscribe people.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') ?? ''
  const userId = readWeeklySummaryUnsubscribeToken(token)
  const form = await request.formData().catch(() => null)
  const fromPage = form?.get('from') === 'page'

  if (!userId) {
    if (fromPage) {
      return NextResponse.redirect(new URL('/email/unsubscribe', request.url), 303)
    }
    return NextResponse.json({ error: 'This unsubscribe link is not valid.' }, { status: 400 })
  }

  await prisma.user.updateMany({ where: { id: userId }, data: { weeklySummaryEmail: false } })

  if (fromPage) {
    const done = new URL('/email/unsubscribe', request.url)
    done.searchParams.set('t', token)
    done.searchParams.set('done', '1')
    return NextResponse.redirect(done, 303)
  }
  return new NextResponse('Unsubscribed from the weekly summary.', { status: 200 })
}

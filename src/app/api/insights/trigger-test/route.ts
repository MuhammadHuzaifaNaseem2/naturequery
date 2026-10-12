/**
 * POST /api/insights/trigger-test
 *
 * Writes a summary for the signed-in user now, the same way the nightly job does
 * (src/lib/nightly-insights.ts), without the email. It appears at once on
 * /dashboard/insights.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimitAsync } from '@/lib/rate-limit'
import { generateInsight } from '@/lib/nightly-insights'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Each summary is an AI call; a few an hour is plenty for "write one now".
  const limit = await rateLimitAsync(`insight-now:${session.user.id}`, {
    maxRequests: 5,
    windowSeconds: 3600,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'You have written several summaries this hour. Try again later.' },
      { status: 429 }
    )
  }

  try {
    const { narrative, metrics } = await generateInsight(session.user.id, { email: false })
    return NextResponse.json({ success: true, narrative, metrics })
  } catch (error) {
    console.error('[trigger-test insight]', error)
    return NextResponse.json({ error: 'Could not write a summary. Try again.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanLimits } from '@/lib/plan-limits'
import { nextRunAt, readScheduleTiming } from '@/lib/schedule-time'

// GET — list user's scheduled queries
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const schedules = await prisma.scheduledQuery.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: schedules })
  } catch (error) {
    console.error('GET /api/scheduled-queries error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scheduled queries' },
      { status: 500 }
    )
  }
}

// POST — create a scheduled query
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const { name, question, sql, connectionId, connectionName, frequency, notifyEmails } = input

  const validFrequencies = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']
  if (!name || !sql || !frequency || !validFrequencies.includes(frequency as string)) {
    return NextResponse.json(
      {
        success: false,
        error: 'name, sql, and frequency (HOURLY/DAILY/WEEKLY/MONTHLY) are required',
      },
      { status: 400 }
    )
  }

  // The time, weekday or day of month the schedule runs at, on the person's clock
  const timingCheck = readScheduleTiming(frequency as string, input)
  if ('error' in timingCheck) {
    return NextResponse.json({ success: false, error: timingCheck.error }, { status: 400 })
  }
  const { timing } = timingCheck

  // Check plan limits — scheduled queries are PRO/ENTERPRISE only
  const limitCheck = await checkPlanLimits(session.user.id, 'SCHEDULED_QUERY')
  if (!limitCheck.allowed) {
    const message =
      limitCheck.limit === 0
        ? `Scheduled queries require a Pro or Enterprise plan. Upgrade to automate your queries.`
        : `Scheduled query limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade to add more.`
    return NextResponse.json(
      { success: false, error: message, limitReached: true },
      { status: 403 }
    )
  }

  // Validate notifyEmails: must be an array of strings if provided
  const validatedEmails: string[] = Array.isArray(notifyEmails)
    ? notifyEmails.filter((e: unknown) => typeof e === 'string' && e.includes('@')).slice(0, 20)
    : []

  try {
    const schedule = await prisma.scheduledQuery.create({
      data: {
        userId: session.user.id,
        name: name as string,
        question: (question as string) || '',
        sql: sql as string,
        connectionId: (connectionId as string) || null,
        connectionName: (connectionName as string) || null,
        frequency: frequency as 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
        notifyEmails: validatedEmails,
        ...timing,
        nextRunAt: nextRunAt({ frequency: frequency as string, ...timing }),
      },
    })

    return NextResponse.json({ success: true, data: schedule }, { status: 201 })
  } catch (error) {
    console.error('POST /api/scheduled-queries error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create scheduled query' },
      { status: 500 }
    )
  }
}

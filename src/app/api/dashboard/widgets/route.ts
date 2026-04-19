import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanLimits } from '@/lib/plan-limits'

// GET /api/dashboard/widgets — list user's pinned widgets
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const widgets = await prisma.dashboardWidget.findMany({
      where: { userId: session.user.id },
      orderBy: { position: 'asc' },
    })

    return NextResponse.json({ success: true, data: widgets })
  } catch (error) {
    console.error('GET /api/dashboard/widgets error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch widgets' }, { status: 500 })
  }
}

// POST /api/dashboard/widgets — pin a query result
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

  const { title, question, sql, connectionId, connectionName } = body as Record<string, any>

  if (!title || !sql) {
    return NextResponse.json({ success: false, error: 'title and sql are required' }, { status: 400 })
  }

  // Check plan limits — dashboard widgets are PRO/ENTERPRISE only
  const limitCheck = await checkPlanLimits(session.user.id, 'DASHBOARD_WIDGET')
  if (!limitCheck.allowed) {
    const message = limitCheck.limit === 0
      ? `Dashboard widgets require a Pro or Enterprise plan. Upgrade to pin query results.`
      : `Widget limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade to add more.`
    return NextResponse.json({ success: false, error: message, limitReached: true }, { status: 403 })
  }

  try {
    // Get max position for ordering
    const last = await prisma.dashboardWidget.findFirst({
      where: { userId: session.user.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const widget = await prisma.dashboardWidget.create({
      data: {
        userId: session.user.id,
        title,
        question: question || '',
        sql,
        connectionId: connectionId || null,
        connectionName: connectionName || null,
        position: (last?.position ?? -1) + 1,
      },
    })

    return NextResponse.json({ success: true, data: widget }, { status: 201 })
  } catch (error) {
    console.error('POST /api/dashboard/widgets error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create widget' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nextRunAt } from '@/lib/schedule-time'

// PATCH — enable/disable a schedule
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const schedule = await prisma.scheduledQuery.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!schedule) {
    return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
  }

  const enabled = typeof body.enabled === 'boolean' ? body.enabled : schedule.enabled
  // A resumed schedule waits for its next time instead of running for the ones it missed.
  const resumed = enabled && !schedule.enabled

  const updated = await prisma.scheduledQuery.update({
    where: { id },
    data: { enabled, ...(resumed ? { nextRunAt: nextRunAt(schedule) } : {}) },
  })

  return NextResponse.json({ success: true, data: updated })
}

// DELETE — remove a schedule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  const schedule = await prisma.scheduledQuery.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!schedule) {
    return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 })
  }

  await prisma.scheduledQuery.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

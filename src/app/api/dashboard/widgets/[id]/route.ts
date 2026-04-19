import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/dashboard/widgets/[id] — unpin a widget
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  const widget = await prisma.dashboardWidget.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!widget) {
    return NextResponse.json({ success: false, error: 'Widget not found' }, { status: 404 })
  }

  await prisma.dashboardWidget.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

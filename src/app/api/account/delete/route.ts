import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/encryption'

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

  // Delete all user data in order (Prisma cascades handle most relations)
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
    ...(user.email ? [
      prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
      prisma.passwordResetToken.deleteMany({ where: { email: user.email } }),
    ] : []),
    prisma.user.delete({ where: { id: userId } }),
  ])

  return NextResponse.json({ success: true })
}

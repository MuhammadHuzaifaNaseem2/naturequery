import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword, hashPassword, validatePasswordComplexity } from '@/lib/encryption'

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

  const { currentPassword, newPassword } = body as Record<string, string>

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: 'All fields are required' }, { status: 400 })
  }

  const validation = validatePasswordComplexity(newPassword)
  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.password) {
      return NextResponse.json(
        { success: false, error: 'No password set on this account (OAuth account)' },
        { status: 400 }
      )
    }

    const isValid = await verifyPassword(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ success: false, error: 'New password must be different from current password' }, { status: 400 })
    }

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed, passwordChangedAt: new Date() },
    })

    // Send notification email (non-fatal)
    try {
      const { sendPasswordChangedEmail } = await import('@/lib/email')
      await sendPasswordChangedEmail(user.email)
    } catch {}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/account/change-password error:', error)
    return NextResponse.json({ success: false, error: 'Failed to change password' }, { status: 500 })
  }
}

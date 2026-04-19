/**
 * 2FA Status API Route
 * Returns whether 2FA is enabled for the current user
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { twoFactorEnabled: true },
        })

        return NextResponse.json({
            success: true,
            twoFactorEnabled: user?.twoFactorEnabled ?? false,
        })
    } catch (error) {
        console.error('2FA status error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch 2FA status' },
            { status: 500 }
        )
    }
}

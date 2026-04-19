/**
 * 2FA Disable API Route
 * Disables Two-Factor Authentication for user
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        // Clear 2FA data
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                backupCodes: [],
            },
        })

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: '2FA_DISABLED',
                resource: 'user',
                resourceId: session.user.id,
            },
        })

        return NextResponse.json({
            success: true,
            message: '2FA disabled successfully',
        })
    } catch (error) {
        console.error('2FA disable error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to disable 2FA' },
            { status: 500 }
        )
    }
}

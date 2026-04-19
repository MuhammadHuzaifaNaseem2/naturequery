import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateBackupCodes, hashBackupCode } from '@/lib/totp'

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        // Verify user has 2FA enabled
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { twoFactorEnabled: true },
        })

        if (!user?.twoFactorEnabled) {
            return NextResponse.json(
                { success: false, error: '2FA is not enabled' },
                { status: 400 }
            )
        }

        // Generate new backup codes
        const backupCodes = generateBackupCodes(10)
        const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code))

        // Update in database
        await prisma.user.update({
            where: { id: session.user.id },
            data: { backupCodes: hashedBackupCodes },
        })

        return NextResponse.json({
            success: true,
            data: { backupCodes },
        })
    } catch (error) {
        console.error('Regenerate backup codes error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to regenerate backup codes' },
            { status: 500 }
        )
    }
}

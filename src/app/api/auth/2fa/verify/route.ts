/**
 * 2FA Verification API Route
 * Verifies TOTP code and enables 2FA on the user account
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { verifyTOTPCode } from '@/lib/totp'

export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        const { code, secret, hashedBackupCodes } = await request.json()

        if (!code || !secret) {
            return NextResponse.json({ success: false, error: 'Code and secret are required' }, { status: 400 })
        }

        // Verify the TOTP code against the secret
        const isValid = verifyTOTPCode(secret, code)

        if (!isValid) {
            // Audit log failure
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    action: '2FA_VERIFY_FAILED',
                    resource: 'user',
                    resourceId: session.user.id,
                },
            }).catch(console.error)

            return NextResponse.json({ success: false, error: 'Invalid code' }, { status: 401 })
        }

        // Encrypt the secret before storing
        const encryptedSecret = encrypt(secret)

        // Save to database: enable 2FA
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                twoFactorEnabled: true,
                twoFactorSecret: encryptedSecret,
                backupCodes: hashedBackupCodes || [],
            },
        })

        // Audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: '2FA_ENABLED',
                resource: 'user',
                resourceId: session.user.id,
            },
        })

        return NextResponse.json({
            success: true,
            message: '2FA enabled successfully',
        })
    } catch (error) {
        console.error('2FA verification error:', error)
        return NextResponse.json(
            { success: false, error: 'Verification failed' },
            { status: 500 }
        )
    }
}

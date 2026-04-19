/**
 * 2FA Setup API Route
 * Generates TOTP secret and QR code for user
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateTOTPSecret, generateQRCode, generateBackupCodes, hashBackupCode, formatSecretForDisplay } from '@/lib/totp'

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id || !session.user.email) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        // Generate TOTP secret
        const { secret, otpauth } = generateTOTPSecret(session.user.email)

        // Generate QR code
        const qrCodeDataURL = await generateQRCode(otpauth)

        // Generate backup codes
        const backupCodes = generateBackupCodes(10)

        // Hash backup codes for storage
        const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code))

        // Format secret for manual entry
        const formattedSecret = formatSecretForDisplay(secret)

        return NextResponse.json({
            success: true,
            data: {
                secret,
                formattedSecret,
                qrCode: qrCodeDataURL,
                backupCodes,
                hashedBackupCodes,
            },
        })
    } catch (error) {
        console.error('2FA setup error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to setup 2FA' },
            { status: 500 }
        )
    }
}

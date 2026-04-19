/**
 * TOTP (Time-based One-Time Password) Utility
 * Handles 2FA authentication with authenticator apps
 */

import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import crypto from 'crypto'

const APP_NAME = 'NatureQuery'
const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(userEmail: string): {
    secret: string
    otpauth: string
} {
    // Generate a random secret
    const secret = new Secret({ size: 20 })

    // Create TOTP instance
    const totp = new TOTP({
        issuer: APP_NAME,
        label: userEmail,
        algorithm: 'SHA1',
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD,
        secret: secret,
    })

    return {
        secret: secret.base32, // Base32 encoded secret for manual entry
        otpauth: totp.toString(), // otpauth:// URL for QR code
    }
}

/**
 * Generate QR code as data URL for the TOTP secret
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 300,
            margin: 1,
        })
        return qrCodeDataURL
    } catch (error) {
        console.error('Error generating QR code:', error)
        throw new Error('Failed to generate QR code')
    }
}

/**
 * Verify a TOTP code against a secret
 * Allows ±1 time window for clock skew
 */
export function verifyTOTPCode(secret: string, token: string): boolean {
    try {
        const totp = new TOTP({
            issuer: APP_NAME,
            algorithm: 'SHA1',
            digits: TOTP_DIGITS,
            period: TOTP_PERIOD,
            secret: Secret.fromBase32(secret),
        })

        // Verify with ±4 window (allows up to 2 minutes of clock skew on each side)
        const delta = totp.validate({ token, window: 4 })

        if (delta === null) {
            console.warn('[2FA] TOTP validation failed. Server time:', new Date().toISOString())
        }

        // delta is null if invalid, or a number indicating time window offset
        return delta !== null
    } catch (error) {
        console.error('Error verifying TOTP code:', error)
        return false
    }
}

/**
 * Generate backup recovery codes
 * Returns array of 10 codes in format: XXXX-XXXX-XXXX
 */
export function generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = []

    for (let i = 0; i < count; i++) {
        // Generate 12 random characters (alphanumeric)
        const code = crypto.randomBytes(6).toString('hex').toUpperCase()

        // Format as XXXX-XXXX-XXXX
        const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
        codes.push(formatted)
    }

    return codes
}

/**
 * Hash a backup code for secure storage
 */
export function hashBackupCode(code: string): string {
    // Remove dashes and convert to lowercase for consistent hashing
    const normalized = code.replace(/-/g, '').toLowerCase()
    return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Verify a backup code against a hashed code
 */
export function verifyBackupCode(code: string, hashedCode: string): boolean {
    const normalized = code.replace(/-/g, '').toLowerCase()
    const hash = crypto.createHash('sha256').update(normalized).digest('hex')
    return hash === hashedCode
}

/**
 * Generate a trusted device token
 */
export function generateDeviceToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Format secret for manual entry (groups of 4 characters)
 * Example: JBSW Y3DP EHPK 3PXP
 */
export function formatSecretForDisplay(secret: string): string {
    return secret.match(/.{1,4}/g)?.join(' ') || secret
}

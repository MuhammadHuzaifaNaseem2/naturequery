import crypto from 'crypto'
import { prisma } from './prisma'

/**
 * Generate a secure random verification token
 */
export function generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex')
}

/**
 * Create and store a verification token for email verification
 */
export async function createVerificationToken(email: string): Promise<string> {
    const token = generateVerificationToken()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
        where: { identifier: email }
    })

    // Create new token
    await prisma.verificationToken.create({
        data: {
            identifier: email,
            token,
            expires,
        },
    })

    return token
}

/**
 * Verify a token and return the email if valid
 */
export async function verifyToken(token: string): Promise<string | null> {
    const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
    })

    if (!verificationToken) {
        return null
    }

    // Check if token has expired
    if (verificationToken.expires < new Date()) {
        // Delete expired token
        await prisma.verificationToken.delete({
            where: { token },
        })
        return null
    }

    return verificationToken.identifier
}

/**
 * Delete a verification token after use
 */
export async function deleteVerificationToken(token: string): Promise<void> {
    await prisma.verificationToken.delete({
        where: { token },
    }).catch(() => {
        // Token might already be deleted, ignore error
    })
}

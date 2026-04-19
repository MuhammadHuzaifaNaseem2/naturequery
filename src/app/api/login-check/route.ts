/**
 * Pre-check API Route
 * Validates email + password and returns whether 2FA is required.
 * This is needed because NextAuth v5 doesn't expose custom error
 * messages from authorize() to the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/encryption'
import { rateLimitAsync } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json({ valid: false, error: 'Invalid credentials' }, { status: 401 })
        }

        // Rate limit: 10 attempts per minute per email
        const limiter = await rateLimitAsync(`login:${email}`, { maxRequests: 10, windowSeconds: 60 })
        if (!limiter.allowed) {
            return NextResponse.json({ valid: false, error: 'Too many attempts. Try again later.' }, { status: 429 })
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: { password: true, twoFactorEnabled: true, emailVerified: true },
        })

        if (!user || !user.password) {
            return NextResponse.json({ valid: false, error: 'Invalid credentials' }, { status: 401 })
        }

        const isPasswordValid = await verifyPassword(password, user.password)
        if (!isPasswordValid) {
            return NextResponse.json({ valid: false, error: 'Invalid credentials' }, { status: 401 })
        }

        if (!user.emailVerified) {
            return NextResponse.json({ valid: false, error: 'Please verify your email before signing in. Check your inbox for the verification link.' }, { status: 401 })
        }

        return NextResponse.json({
            valid: true,
            requiresTwoFactor: user.twoFactorEnabled,
        })
    } catch (error) {
        console.error('Pre-check error:', error)
        return NextResponse.json({ valid: false, error: 'Something went wrong' }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, deleteVerificationToken } from '@/lib/token-generator'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json(
                { error: 'Verification token is required' },
                { status: 400 }
            )
        }

        // Verify the token and get the email
        const email = await verifyToken(token)

        if (!email) {
            return NextResponse.json(
                { error: 'Invalid or expired verification token' },
                { status: 400 }
            )
        }

        // Find the user
        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            )
        }

        // Check if already verified
        if (user.emailVerified) {
            return NextResponse.json(
                { message: 'Email already verified', alreadyVerified: true },
                { status: 200 }
            )
        }

        // Update user to mark email as verified
        await prisma.user.update({
            where: { email },
            data: { emailVerified: new Date() },
        })

        // Delete the verification token
        await deleteVerificationToken(token)

        // Log the verification
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'EMAIL_VERIFIED',
                resource: 'user',
                resourceId: user.id,
            },
        })

        return NextResponse.json(
            { message: 'Email verified successfully! You can now sign in.' },
            { status: 200 }
        )
    } catch (error) {
        console.error('Email verification error:', error)
        return NextResponse.json(
            { error: 'Failed to verify email' },
            { status: 500 }
        )
    }
}

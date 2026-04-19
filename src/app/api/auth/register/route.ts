import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePasswordComplexity } from '@/lib/encryption'
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit'
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters')
        .refine(
            (pw: string) => validatePasswordComplexity(pw).valid,
            'Password must contain at least 3 of: uppercase, lowercase, number, special character',
        ),
})

export async function POST(request: Request) {
    try {
        // Rate limit: 5 registration attempts per minute per IP
        const ip = getClientIp(request)
        const limiter = await rateLimitAsync(`register:${ip}`, { maxRequests: 5, windowSeconds: 60 })
        if (!limiter.allowed) {
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(limiter.retryAfterSeconds) },
                }
            )
        }

        const body = await request.json()

        // Validate input
        const validatedData = registerSchema.parse(body)

        // Validate email domain (check if it's a real email that can receive mail)
        const { validateEmailDomain } = await import('@/lib/email-validator')
        const emailValidation = await validateEmailDomain(validatedData.email)

        if (!emailValidation.valid) {
            return NextResponse.json(
                { error: emailValidation.error || 'Invalid email address' },
                { status: 400 }
            )
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 400 }
            )
        }

        // Hash password
        const hashedPassword = await hashPassword(validatedData.password)

        // Create user
        const isDev = process.env.NODE_ENV !== 'production'
        const emailVerified = isDev ? new Date() : null

        const user = await prisma.user.create({
            data: {
                name: validatedData.name,
                email: validatedData.email,
                password: hashedPassword,
                role: 'ANALYST',
                emailVerified,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        })

        // Create FREE subscription (Default)
        await prisma.subscription.create({
            data: {
                userId: user.id,
                plan: 'FREE',
                status: 'ACTIVE',
            },
        })

        // Log registration
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'REGISTER',
                resource: 'user',
                resourceId: user.id,
            },
        })

        // Generate verification token and send email (non-fatal)
        if (!isDev) {
            try {
                const { createVerificationToken } = await import('@/lib/token-generator')
                const { sendVerificationEmail } = await import('@/lib/email')
                const token = await createVerificationToken(user.email)
                await sendVerificationEmail(user.email, token)
            } catch (emailError) {
                console.error('Registration email failed:', emailError)
            }
        }

        return NextResponse.json(
            {
                message: isDev 
                    ? 'Account created and auto-verified! You can sign in now.' 
                    : 'Account created! Please check your email to verify.',
                requiresVerification: !isDev,
                email: user.email,
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            )
        }

        console.error('Registration error:', error)
        return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
        )
    }
}

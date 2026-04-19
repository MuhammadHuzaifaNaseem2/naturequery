import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import { prisma } from './prisma'
import { verifyPassword, decrypt } from './encryption'
import { rateLimitAsync } from './rate-limit'
import { verifyTOTPCode, verifyBackupCode } from './totp'
import { auditLogin, auditLogout } from './audit-immutable'
import { sendLoginNotificationEmail } from './email'
import { CredentialsSignin } from 'next-auth'

class CustomAuthError extends CredentialsSignin {
    constructor(code: string) {
        super()
        this.code = code
    }
}


const authConfig: NextAuthConfig = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: PrismaAdapter(prisma) as any, // known type mismatch between NextAuth v5 and @auth/prisma-adapter
    trustHost: true, // required for NextAuth v5 OAuth callbacks on non-Vercel hosts (including localhost)
    session: {
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    pages: {
        signIn: '/login',
        signOut: '/login',
        error: '/login',
        verifyRequest: '/verify-email',
    },
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                twoFactorCode: { label: '2FA Code', type: 'text' },
            },
            async authorize(credentials, request) {
                const email = credentials?.email as string | undefined
                const password = credentials?.password as string | undefined

                if (!email || !password) {
                    throw new CustomAuthError('Invalid credentials')
                }

                // Rate limit: 10 login attempts per minute per email
                // Use separate key for 2FA attempts to avoid double-counting
                const twoFactorCode = credentials?.twoFactorCode as string | undefined
                const rateLimitKey = twoFactorCode ? `2fa:${email}` : `login:${email}`
                const limiter = await rateLimitAsync(rateLimitKey, { maxRequests: 10, windowSeconds: 60 })
                if (!limiter.allowed) {
                    throw new CustomAuthError('Too many login attempts. Please try again later.')
                }

                const user = await prisma.user.findUnique({
                    where: { email },
                    include: { subscription: true },
                })

                if (!user || !user.password) {
                    throw new CustomAuthError('Invalid credentials')
                }

                // ── Brute-force lockout check ────────────────────────────
                const MAX_ATTEMPTS = 5
                const LOCKOUT_MINUTES = 15

                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    const minutesLeft = Math.ceil(
                        (user.lockedUntil.getTime() - Date.now()) / 60000
                    )
                    throw new CustomAuthError(
                        `Account locked. Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
                    )
                }

                const isPasswordValid = await verifyPassword(password, user.password)

                if (!isPasswordValid) {
                    const newAttempts = (user.loginAttempts ?? 0) + 1
                    const shouldLock = newAttempts >= MAX_ATTEMPTS

                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            loginAttempts: newAttempts,
                            lockedUntil: shouldLock
                                ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                                : null,
                        },
                    })

                    if (shouldLock) {
                        throw new CustomAuthError(
                            `Account locked for ${LOCKOUT_MINUTES} minutes after too many failed attempts.`
                        )
                    }

                    const attemptsLeft = MAX_ATTEMPTS - newAttempts
                    throw new CustomAuthError(
                        `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`
                    )
                }

                // Check if email is verified (skip check in development)
                const isProduction = process.env.NODE_ENV === 'production'
                if (isProduction && !user.emailVerified) {
                    throw new CustomAuthError('Please verify your email before signing in. Check your inbox for the verification link.')
                }

                // ── Reset failed attempts on successful login ─────────────
                if (user.loginAttempts > 0 || user.lockedUntil) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { loginAttempts: 0, lockedUntil: null },
                    })
                }

                // 2FA check
                if (user.twoFactorEnabled && user.twoFactorSecret) {
                    if (!twoFactorCode) {
                        throw new CustomAuthError('2FA_REQUIRED')
                    }

                    // Decrypt the stored secret
                    const secret = decrypt(user.twoFactorSecret)

                    // Try TOTP code first
                    const isValidTotp = verifyTOTPCode(secret, twoFactorCode)

                    if (!isValidTotp) {
                        // Try backup code
                        let backupCodeValid = false
                        let usedCodeIndex = -1

                        for (let i = 0; i < user.backupCodes.length; i++) {
                            if (verifyBackupCode(twoFactorCode, user.backupCodes[i])) {
                                backupCodeValid = true
                                usedCodeIndex = i
                                break
                            }
                        }

                        if (!backupCodeValid) {
                            throw new CustomAuthError('Invalid 2FA code')
                        }

                        // Remove used backup code
                        if (usedCodeIndex >= 0) {
                            const updatedCodes = [...user.backupCodes]
                            updatedCodes.splice(usedCodeIndex, 1)
                            await prisma.user.update({
                                where: { id: user.id },
                                data: { backupCodes: updatedCodes },
                            })

                            // Audit log backup code usage
                            await prisma.auditLog.create({
                                data: {
                                    userId: user.id,
                                    action: '2FA_BACKUP_CODE_USED',
                                    resource: 'user',
                                    resourceId: user.id,
                                },
                            }).catch(console.error)
                        }
                    }
                }

                // Log successful login — immutable hash chain
                const ipAddress =
                    request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    request?.headers?.get('x-real-ip') ||
                    'Unknown'
                const userAgent = request?.headers?.get('user-agent') || ''
                // Log successful login + send notification (non-blocking)
                auditLogin(user.id, ipAddress, userAgent).catch(console.error)
                sendLoginNotificationEmail(user.email, ipAddress, userAgent, new Date()).catch(console.error)

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                    plan: (user.subscription?.plan ?? 'FREE') as any,
                    onboardingCompleted: user.onboardingCompleted,
                    passwordChangedAt: (user as any).passwordChangedAt?.getTime() ?? null,
                }
            },
        }),
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                Google({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    allowDangerousEmailAccountLinking: true,
                }),
            ]
            : []),
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? [
                GitHub({
                    clientId: process.env.GITHUB_CLIENT_ID,
                    clientSecret: process.env.GITHUB_CLIENT_SECRET,
                    allowDangerousEmailAccountLinking: true,
                }),
            ]
            : []),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === 'google' || account?.provider === 'github') {
                const email = user.email
                if (!email) return true

                // Check if user exists but doesn't have this provider linked
                const existingUser = await prisma.user.findUnique({
                    where: { email },
                    include: { accounts: true }
                })

                if (existingUser) {
                    const isLinked = existingUser.accounts.some(
                        acc => acc.provider === account.provider
                    )

                    if (!isLinked) {
                        // Manually link the account to bypass OAuthAccountNotLinked conflicts
                        await prisma.account.create({
                            data: {
                                userId: existingUser.id,
                                type: account.type,
                                provider: account.provider,
                                providerAccountId: account.providerAccountId,
                                access_token: account.access_token,
                                expires_at: account.expires_at,
                                token_type: account.token_type,
                                scope: account.scope,
                                id_token: account.id_token,
                            }
                        })
                    }
                }
            }
            return true
        },
        async jwt({ token, user, trigger, session }) {
            // ── Initial login: embed user data directly into the JWT ──────
            if (user) {
                token.id = user.id
                token.role = (user as any).role ?? 'ANALYST'
                token.plan = (user as any).plan ?? 'FREE'
                token.onboardingCompleted = (user as any).onboardingCompleted ?? false
                // Embed passwordChangedAt at login time so we can detect stale sessions
                token.passwordChangedAt = (user as any).passwordChangedAt ?? null
                // Track when we last verified against the DB (now = login time)
                token.lastDbCheckAt = Date.now()
                
                // Fix HTTP 431: Prevent massive Base64 strings from crashing browser cookies
                if (token.picture?.startsWith('data:image/')) {
                    token.picture = `/api/user/avatar?t=${Date.now()}`
                }
                
                return token
            }

            // ── Handle explicit session updates (e.g. name/email/role change) ──
            if (trigger === 'update' && session) {
                if (session.name !== undefined) token.name = session.name
                if (session.email !== undefined) token.email = session.email
                if (session.image !== undefined) {
                    token.picture = session.image?.startsWith('data:image/') 
                        ? `/api/user/avatar?t=${Date.now()}` 
                        : session.image
                }
                // If the caller explicitly passed role/onboarding, update the token
                if (session.role !== undefined) token.role = session.role
                if (session.onboardingCompleted !== undefined) token.onboardingCompleted = session.onboardingCompleted
                // Force a fresh DB check on next interval
                token.lastDbCheckAt = 0
            }

            // ── Periodic DB sync (every 5 minutes, NOT every request) ────────
            // This catches role changes, account deletion, and password resets
            // without hammering the DB on every single API call.
            const isDev = process.env.NODE_ENV === 'development'
            const DB_CHECK_INTERVAL_MS = isDev ? 5 * 60 * 1000 : 1 * 60 * 1000
            const lastCheck = (token.lastDbCheckAt as number) || 0
            const now = Date.now()

            if (token.id && now - lastCheck > DB_CHECK_INTERVAL_MS) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { role: true, onboardingCompleted: true, image: true, subscription: { select: { plan: true } } },
                    })

                    if (!dbUser) {
                        // User deleted — kill the session
                        return null as any
                    }

                    token.role = dbUser.role
                    token.plan = (dbUser.subscription?.plan ?? 'FREE') as any
                    token.onboardingCompleted = dbUser.onboardingCompleted
                    // Fix HTTP 431: Convert base64 to dynamic URL so it fits in cookie
                    if (dbUser.image) {
                        token.picture = dbUser.image.startsWith('data:image/') 
                            ? `/api/user/avatar?t=${Date.now()}`
                            : dbUser.image
                    }

                    // Check if password was changed after this token was issued
                    try {
                        const pwUser = await (prisma.user as any).findUnique({
                            where: { id: token.id as string },
                            select: { passwordChangedAt: true },
                        })
                        if (pwUser?.passwordChangedAt) {
                            const tokenIssuedAt = token.passwordChangedAt as number | null
                            const dbChangedAt = (pwUser.passwordChangedAt as Date).getTime()
                            if (!tokenIssuedAt || dbChangedAt > tokenIssuedAt) {
                                return null as any
                            }
                        }
                    } catch {
                        // passwordChangedAt not yet in Prisma client — skip until prisma generate
                    }

                    token.lastDbCheckAt = now
                } catch (err) {
                    // DB unreachable — keep using cached token data, retry next interval
                    console.warn('[auth] Periodic DB check failed, using cached token:', err)
                }
            }

            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.role = token.role as any
                session.user.plan = token.plan as any
                session.user.onboardingCompleted = (token.onboardingCompleted as boolean) ?? false
                session.user.image = token.picture // Ensure image reflects token (dynamic avatar URL)
            }
            session.onboardingCompleted = (token.onboardingCompleted as boolean) ?? false
            return session
        },
    },
    events: {
        async signOut(message) {
            const token = 'token' in message ? message.token : null
            if (token?.id) {
                await auditLogout(token.id as string).catch(console.error)
            }
        },
    },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

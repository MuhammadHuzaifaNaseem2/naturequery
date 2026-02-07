import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import { prisma } from './prisma'
import { verifyPassword } from './encryption'
import { rateLimit } from './rate-limit'

const authConfig: NextAuthConfig = {
    adapter: PrismaAdapter(prisma) as any,
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
            },
            async authorize(credentials) {
                const email = credentials?.email as string | undefined
                const password = credentials?.password as string | undefined

                if (!email || !password) {
                    throw new Error('Invalid credentials')
                }

                // Rate limit: 10 login attempts per minute per email
                const limiter = rateLimit(`login:${email}`, { maxRequests: 10, windowSeconds: 60 })
                if (!limiter.allowed) {
                    throw new Error('Too many login attempts. Please try again later.')
                }

                const user = await prisma.user.findUnique({
                    where: { email },
                })

                if (!user || !user.password) {
                    throw new Error('Invalid credentials')
                }

                const isPasswordValid = await verifyPassword(password, user.password)

                if (!isPasswordValid) {
                    throw new Error('Invalid credentials')
                }

                // Log successful login
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        action: 'LOGIN',
                        resource: 'user',
                        resourceId: user.id,
                    },
                })

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                }
            },
        }),
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                Google({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                }),
            ]
            : []),
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? [
                GitHub({
                    clientId: process.env.GITHUB_CLIENT_ID,
                    clientSecret: process.env.GITHUB_CLIENT_SECRET,
                }),
            ]
            : []),
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id
                token.role = (user as any).role
            }

            // Handle session updates
            if (trigger === 'update' && session) {
                token.name = session.name
                token.email = session.email
            }

            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                ;(session.user as any).role = token.role as string
            }
            return session
        },
    },
    events: {
        async signOut(message) {
            const token = 'token' in message ? message.token : null
            if (token?.id) {
                await prisma.auditLog.create({
                    data: {
                        userId: token.id as string,
                        action: 'LOGOUT',
                        resource: 'user',
                        resourceId: token.id as string,
                    },
                })
            }
        },
    },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

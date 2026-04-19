'use server'

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/encryption'
import { rateLimitAsync } from '@/lib/rate-limit'

export async function preFlightCheck(email?: string, password?: string) {
  if (!email || !password) return { error: 'Invalid credentials' }

  const limiter = await rateLimitAsync(`login-preflight:${email}`, {
    maxRequests: 10,
    windowSeconds: 60,
  })
  if (!limiter.allowed) {
    return { error: 'Too many login attempts. Please try again later.' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.password) return { error: 'Invalid credentials' }

  // Lockout check
  const MAX_ATTEMPTS = 5
  const LOCKOUT_MINUTES = 15

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return {
      error: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    }
  }

  const isPasswordValid = await verifyPassword(password, user.password)
  if (!isPasswordValid) {
    const newAttempts = (user.loginAttempts ?? 0) + 1
    const shouldLock = newAttempts >= MAX_ATTEMPTS
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    })
    if (shouldLock) {
      return {
        error: `Account locked for ${LOCKOUT_MINUTES} minutes after too many failed attempts.`,
      }
    }
    const attemptsLeft = MAX_ATTEMPTS - newAttempts
    return {
      error: `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`,
    }
  }

  // Reset on success (non-blocking)
  if (user.loginAttempts > 0 || user.lockedUntil) {
    prisma.user
      .update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      })
      .catch((e) => console.error('[preFlightCheck] Failed to reset attempts:', e))
  }

  if (!user.emailVerified) {
    return { error: 'Please verify your email before signing in.' }
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return { requires2FA: true }
  }

  return { ok: true }
}

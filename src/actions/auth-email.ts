'use server'

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendPasswordChangedEmail,
  isEmailConfigured,
} from '@/lib/email'
import { hashPassword, validatePasswordComplexity } from '@/lib/encryption'
import { rateLimitAsync } from '@/lib/rate-limit'

// ---------- Password Reset ----------

export async function requestPasswordReset(email: string) {
  // Rate limit: 10 attempts per hour per email (generous for dev/testing)
  const limiter = await rateLimitAsync(`password-reset:${email}`, {
    maxRequests: 10,
    windowSeconds: 3600,
  })
  if (!limiter.allowed) {
    throw new Error('Too many password reset requests. Please wait a moment and try again.')
  }

  // Always return success shape to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { success: true, emailConfigured: isEmailConfigured(), devUrl: null }
  }

  // Delete any existing tokens for this email
  await prisma.passwordResetToken.deleteMany({ where: { email } })

  // Create a new token (expires in 1 hour)
  const token = crypto.randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: {
      email,
      token,
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  })

  // Send email — non-fatal so token is always saved and usable
  let emailSent = false
  const url = await sendPasswordResetEmail(email, token)
    .then((u) => {
      emailSent = true
      return u
    })
    .catch((err) => {
      console.error('Password reset email failed (non-fatal):', err)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return `${appUrl}/reset-password?token=${token}`
    })

  const configured = isEmailConfigured() && emailSent

  return {
    success: true,
    emailConfigured: configured,
    // Show the link in dev OR when email sending failed
    devUrl: !configured && process.env.NODE_ENV === 'development' ? url : null,
  }
}

export async function resetPassword(token: string, newPassword: string) {
  // Validate password complexity
  const validation = validatePasswordComplexity(newPassword)
  if (!validation.valid) {
    throw new Error(validation.error!)
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  })

  if (!resetToken) {
    throw new Error('Invalid or expired reset link')
  }

  if (resetToken.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
    throw new Error('This reset link has expired. Please request a new one.')
  }

  const hashedPassword = await hashPassword(newPassword)

  const user = await prisma.user.findUnique({
    where: { email: resetToken.email },
    select: { id: true },
  })

  await prisma.user.update({
    where: { email: resetToken.email },
    data: { password: hashedPassword, passwordChangedAt: new Date() },
  })

  // Invalidate all existing sessions for this user
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } })
  }

  // Clean up used token
  await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })

  // Audit log
  if (user) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET',
        resource: 'user',
        resourceId: user.id,
      },
    })
  }

  return { success: true }
}

// ---------- Email Verification ----------

export async function requestEmailVerification(email: string) {
  // Rate limit: 10 verification requests per hour per email
  const limiter = await rateLimitAsync(`email-verification:${email}`, {
    maxRequests: 10,
    windowSeconds: 3600,
  })
  if (!limiter.allowed) {
    throw new Error('Too many verification requests. Please try again later.')
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.emailVerified) {
    return { success: true, emailConfigured: isEmailConfigured(), devUrl: null }
  }

  // Delete existing tokens
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  // Send email — non-fatal so token is always saved and usable
  let emailSent = false
  const url = await sendVerificationEmail(email, token)
    .then((u) => {
      emailSent = true
      return u
    })
    .catch((err) => {
      console.error('Verification email failed (non-fatal):', err)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return `${appUrl}/verify-email?token=${token}`
    })

  const configured = isEmailConfigured() && emailSent

  return {
    success: true,
    emailConfigured: configured,
    devUrl: !configured && process.env.NODE_ENV === 'development' ? url : null,
  }
}

export async function verifyEmail(token: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!verificationToken) {
    throw new Error('Invalid or expired verification link')
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: verificationToken.identifier, token } },
    })
    throw new Error('This verification link has expired. Please request a new one.')
  }

  await prisma.user.update({
    where: { email: verificationToken.identifier },
    data: { emailVerified: new Date() },
  })

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: verificationToken.identifier, token } },
  })

  return { success: true }
}

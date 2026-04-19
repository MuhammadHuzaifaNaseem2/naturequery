'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey, hashApiKey } from '@/lib/encryption'
import { checkPlanLimits } from '@/lib/plan-limits'
import { rateLimitAsync } from '@/lib/rate-limit'
import { IdSchema } from '@/lib/validation'
import { z } from 'zod'

export async function createApiKey(name: string, expiresInDays?: number) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Rate limit
  const rl = await rateLimitAsync(`apikey_create:${session.user.id}`, {
    maxRequests: 5,
    windowSeconds: 60,
  })
  if (!rl.allowed) return { success: false, error: 'Too many requests' }

  // Validation
  const schema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    expiresInDays: z.number().int().min(1).max(3650).optional(),
  })
  const validated = schema.safeParse({ name, expiresInDays })
  if (!validated.success) return { success: false, error: validated.error.issues[0].message }

  // Check plan limits — API keys are PRO/ENTERPRISE only
  const limitCheck = await checkPlanLimits(session.user.id, 'API_KEY')
  if (!limitCheck.allowed) {
    const message =
      limitCheck.limit === 0
        ? `API access requires a Pro or Enterprise plan. Upgrade to create API keys.`
        : `API key limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade for more keys.`
    return { success: false, error: message }
  }

  const { key, hash, prefix } = generateApiKey('rp_')

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      key: hash,
      prefix,
      userId: session.user.id,
      expiresAt,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE_API_KEY',
      resource: 'apiKey',
      resourceId: apiKey.id,
    },
  })

  // Return the full key only once — it cannot be retrieved again
  return {
    success: true,
    data: {
      id: apiKey.id,
      name: apiKey.name,
      key, // plaintext, shown once
      prefix: apiKey.prefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    },
  }
}

export async function listApiKeys() {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { success: true, data: keys }
}

export async function revokeApiKey(keyId: string) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Validation
  if (!IdSchema.safeParse(keyId).success) return { success: false, error: 'Invalid ID' }

  // Ensure key belongs to user
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId: session.user.id },
  })
  if (!key) return { success: false, error: 'API key not found' }

  await prisma.apiKey.delete({ where: { id: keyId } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'REVOKE_API_KEY',
      resource: 'apiKey',
      resourceId: keyId,
    },
  })

  return { success: true }
}

/**
 * Validate an API key from a request header.
 * Returns the user ID if valid, or null.
 */
export async function validateApiKey(rawKey: string) {
  if (!rawKey) return null

  const hash = hashApiKey(rawKey)
  const apiKey = await prisma.apiKey.findUnique({ where: { key: hash } })

  if (!apiKey) return null

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })

  return apiKey.userId
}

'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey, hashApiKey } from '@/lib/encryption'

export async function createApiKey(name: string, expiresInDays?: number) {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  // Limit to 10 active keys per user
  const count = await prisma.apiKey.count({ where: { userId: session.user.id } })
  if (count >= 10) return { success: false, error: 'Maximum of 10 API keys allowed' }

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
